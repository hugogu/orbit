'use client';
import { useEffect, useRef } from 'react';
import { encode } from 'uqr';
import {
  qrCanvasSize,
  qrBadgePalette,
  qrQuietModules,
} from '../lib/share-image';

/**
 * The link at a size a camera can actually read. The badge burnt into the
 * shared frame is sized for that frame, so it lands far too small once the
 * preview scales the whole image down; this one is drawn at device resolution
 * and never resampled, which is what makes it scannable off a screen. It wears
 * the weight of the buttons beside it rather than the badge's muted tone: on
 * the frame the code lies on a picture and has to recede, while here it is a
 * control, and brightness only helps the camera.
 */
export default function ShareQr({
  link,
  size = 180,
}: {
  link: string;
  size?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const blank = () => {
      element.width = 0;
      element.height = 0;
      element.style.width = '0px';
      element.style.height = '0px';
    };
    let encoded: ReturnType<typeof encode> | undefined;
    try {
      encoded = encode(link, { ecc: 'M', border: 0 });
    } catch {
      /* Handled below, together with anything else that left it unset. */
    }
    if (!encoded) {
      // Blank it rather than leave the previous link's symbol standing: a
      // stale code would quietly send someone to a view nobody shared.
      blank();
      return;
    }
    const symbol = encoded;
    // The ratio the display reports, not a clamped one: drawing for fewer
    // pixels than it paints with hands the browser a canvas to rescale, which
    // is the one thing to avoid. The ceiling only bounds the canvas, far past
    // any display and zoom.
    const currentRatio = () => {
      const reported = window.devicePixelRatio;
      return Number.isFinite(reported) && reported > 0
        ? Math.min(8, reported)
        : 1;
    };
    let watched: MediaQueryList | null = null;
    let drawnAt = 0;
    // Zooming is the first thing someone does when a code will not scan, and
    // that moves the ratio, so follow it rather than keep the mount's value.
    // An arrow, so the narrowing above still holds inside it.
    const paint = () => {
      const ratio = currentRatio();
      if (ratio === drawnAt) return;
      drawnAt = ratio;
      const { unit, side } = qrCanvasSize(size, symbol.size, ratio);
      const context = element.getContext('2d');
      if (!context) {
        blank();
        return;
      }
      element.width = side;
      element.height = side;
      // Present it at exactly the pixels it was drawn with, so the browser
      // never resamples the modules into each other.
      element.style.width = `${side / ratio}px`;
      element.style.height = `${side / ratio}px`;
      context.fillStyle = qrBadgePalette.screen;
      context.fillRect(0, 0, side, side);
      context.fillStyle = qrBadgePalette.module;
      for (let row = 0; row < symbol.size; row++)
        for (let column = 0; column < symbol.size; column++)
          if (symbol.data[row][column])
            context.fillRect(
              (column + qrQuietModules) * unit,
              (row + qrQuietModules) * unit,
              unit,
              unit,
            );
      watched?.removeEventListener('change', paint);
      watched = window.matchMedia(`(resolution: ${ratio}dppx)`);
      watched.addEventListener('change', paint);
    };
    paint();
    // Moving the window between screens of different density changes the ratio
    // without the query above always noticing.
    window.addEventListener('resize', paint);
    return () => {
      window.removeEventListener('resize', paint);
      watched?.removeEventListener('change', paint);
    };
  }, [link, size]);
  return <canvas ref={canvas} className="share-qr" aria-hidden="true" />;
}
