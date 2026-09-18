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
 * the same muted palette as the badge: at this size the symbol has pixels to
 * spare, so it can sit quietly in a dark panel rather than glare out of it.
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
    const target = canvas.current;
    if (!target) return;
    let symbol;
    try {
      symbol = encode(link, { ecc: 'M', border: 0 });
    } catch {
      return;
    }
    const ratio =
      typeof window === 'undefined'
        ? 1
        : Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const { unit, side } = qrCanvasSize(size, symbol.size, ratio);
    target.width = side;
    target.height = side;
    // Present it at exactly the pixels it was drawn with, so the browser never
    // resamples the modules into each other.
    target.style.width = `${side / ratio}px`;
    target.style.height = `${side / ratio}px`;
    const context = target.getContext('2d');
    if (!context) return;
    context.fillStyle = qrBadgePalette.card;
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
  }, [link, size]);
  return <canvas ref={canvas} className="share-qr" aria-hidden="true" />;
}
