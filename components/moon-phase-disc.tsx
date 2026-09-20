'use client';
import { useId } from 'react';
import { phaseDiscPath } from '../lib/lunar-phase';

/** The path is written at this radius and scaled by the viewBox, not by numbers. */
const RADIUS = 100;

/**
 * The lunar disc drawn from the phase angle rather than picked from a set of
 * pictures, so every date in the supported range has its own shape.
 *
 * The view is geocentric with celestial north up. Seen from the southern
 * hemisphere the same Moon appears turned about, which `flip` mirrors.
 *
 * The graphic is decorative: every place it appears already names the phase in
 * text beside it, so it is hidden from assistive technology rather than read
 * out a second time.
 */
export default function MoonPhaseDisc({
  elongation,
  size = 104,
  flip = false,
}: {
  elongation: number;
  size?: number;
  flip?: boolean;
}) {
  // A gradient is referenced by id, and the page holds many of these discs —
  // the panel renders in both the desktop aside and the mobile sheet. A shared
  // id would send every one of them to the first copy, which is inside a hidden
  // subtree, and an unresolvable paint server draws nothing at all.
  const gradient = `moon-disc-${useId().replaceAll(':', '')}`;
  const { path, waxing } = phaseDiscPath(elongation, RADIUS);
  // The path is drawn with its lit limb on the right; a waning Moon is the same
  // shape mirrored, and the southern hemisphere mirrors whichever it already is.
  const mirrored = waxing === flip;
  const box = RADIUS + 2;
  return (
    <svg
      className="moon-disc"
      viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradient} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fbf3e2" />
          <stop offset="65%" stopColor="#ecdcba" />
          <stop offset="100%" stopColor="#c8b48c" />
        </radialGradient>
      </defs>
      {/* The unlit hemisphere stays visible, the way earthshine leaves it. */}
      <circle r={RADIUS} className="moon-disc-dark" />
      <g transform={mirrored ? 'scale(-1 1)' : undefined}>
        <path d={path} fill={`url(#${gradient})`} />
      </g>
      <circle r={RADIUS} className="moon-disc-rim" />
    </svg>
  );
}
