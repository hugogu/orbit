import type { ReactNode } from 'react';
import { CircleDot, Eclipse, Moon, Orbit } from 'lucide-react';
import type { PlannerTab } from '../lib/planet-events';

export const eventIcons = {
  solar: Eclipse,
  lunar: Moon,
  opposition: Orbit,
  transit: CircleDot,
};

const planets: Record<string, ReactNode> = {
  mars: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9" cy="9" r="2" />
      <path d="M14 14h3m-6 3h1" />
    </>
  ),
  jupiter: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5 7h14M3 11h18M4 16h7m6 0h3" />
      <ellipse cx="14" cy="16" rx="3" ry="1.5" />
    </>
  ),
  saturn: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M6.2 10.5C.3 12 .2 15.8 3 16.5c3.8 1 13.2-2.3 17-6 2.8-2.8 1.6-4-2.2-3" />
    </>
  ),
  uranus: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <ellipse cx="12" cy="12" rx="3" ry="10" transform="rotate(30 12 12)" />
    </>
  ),
  neptune: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M4 10c3-4 5 4 8 0s5 4 8 0M4 15c3-4 5 4 8 0s5 4 8 0" />
    </>
  ),
};

/** Schematic silhouettes: distinguish events without depending on their translated names. */
export default function SkyEventIcon({
  kind,
  variant,
}: {
  kind: PlannerTab;
  variant?: string;
}) {
  let drawing: ReactNode;
  if (kind === 'solar') {
    if (variant === '日全食')
      drawing = (
        <>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </>
      );
    if (variant === '日环食')
      drawing = (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5.5" strokeWidth="2.5" />
        </>
      );
    if (variant === '日偏食')
      drawing = (
        <path
          d="M18 5.5a8.5 8.5 0 1 0 0 13 7 7 0 0 1 0-13Z"
          fill="currentColor"
          fillOpacity=".3"
        />
      );
  } else if (kind === 'lunar') {
    if (variant === '月全食')
      drawing = (
        <>
          <circle
            cx="12"
            cy="12"
            r="8.5"
            fill="currentColor"
            fillOpacity=".45"
          />
          <circle cx="9" cy="9" r="2" />
          <path d="M13 16h3m0-7h1" />
        </>
      );
    if (variant === '月偏食')
      drawing = (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path
            d="M12 3.5a8.5 8.5 0 0 1 0 17c-5-4-5-13 0-17Z"
            fill="currentColor"
            fillOpacity=".45"
          />
        </>
      );
    if (variant === '月半影食')
      drawing = (
        <>
          <circle cx="12" cy="12" r="9.5" strokeDasharray="2 3" />
          <circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity=".15" />
          <path d="M9 10h1m3 4h2" />
        </>
      );
  } else if (kind === 'opposition') {
    drawing = planets[variant ?? ''];
  } else if (variant === 'mercury' || variant === 'venus') {
    drawing = (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5 16 14-8" strokeDasharray="2 3" />
        <circle
          cx="12"
          cy="12"
          r={variant === 'mercury' ? 2 : 4}
          fill="currentColor"
          stroke="none"
        />
      </>
    );
  }
  if (!drawing) {
    const Icon = eventIcons[kind];
    return <Icon size={22} aria-hidden="true" />;
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {drawing}
    </svg>
  );
}
