'use client';
import { useEffect, useRef } from 'react';
import { projectMoonTexture, shadeMoonDisc } from '../lib/moon-disc';

let texturePromise: Promise<ImageData> | undefined;
function moonTexture() {
  return (texturePromise ??= new Promise<ImageData>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Moon texture canvas unavailable');
        context.drawImage(image, 0, 0);
        resolve(context.getImageData(0, 0, canvas.width, canvas.height));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Moon texture unavailable'));
    image.src = '/textures/2k_moon.jpg';
  }).catch((error: unknown) => {
    texturePromise = undefined;
    throw error;
  }));
}

/** Textured sphere with phase-derived sunlight, in the almanac's north-up view.
 * A southern view rotates both the surface and the light, never mirrors maria.
 * Decorative: adjacent text already describes the phase.
 */
export default function MoonPhaseDisc({
  elongation,
  phaseAngle = Math.abs(180 - (((elongation % 360) + 360) % 360)),
  size = 104,
  flip = false,
}: {
  elongation: number;
  phaseAngle?: number;
  size?: number;
  flip?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const projection = useRef<ReturnType<typeof projectMoonTexture> | null>(null);
  useEffect(() => {
    let live = true;
    const target = canvas.current;
    if (!target) return;
    void moonTexture()
      .then((texture) => {
        if (!live) return;
        const resolution = Math.ceil(
          size * Math.min(window.devicePixelRatio || 1, 2),
        );
        if (projection.current?.size !== resolution) {
          projection.current = projectMoonTexture(texture, resolution);
        }
        const context = target.getContext('2d');
        if (!context) return;
        target.width = target.height = resolution;
        const waxing = ((elongation % 360) + 360) % 360 < 180;
        context.putImageData(
          new ImageData(
            shadeMoonDisc(projection.current, phaseAngle, waxing),
            resolution,
            resolution,
          ),
          0,
          0,
        );
      })
      .catch(() => {
        // Keep the dark disc if texture loading fails; a later update can retry.
      });
    return () => {
      live = false;
    };
  }, [elongation, phaseAngle, size]);
  return (
    <canvas
      ref={canvas}
      className="moon-disc"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        transform: flip ? 'rotate(180deg)' : undefined,
      }}
      aria-hidden="true"
    />
  );
}
