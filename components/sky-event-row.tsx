import type { ReactNode } from 'react';
import {
  ChevronDown,
  CircleDot,
  Eclipse,
  Eye,
  Moon,
  Orbit,
} from 'lucide-react';
import type { PlannerTab } from '../lib/planet-events';

export const eventIcons = {
  solar: Eclipse,
  lunar: Moon,
  opposition: Orbit,
  transit: CircleDot,
};

/** Keep the date and the jump action visible while circumstances stay folded. */
export default function SkyEventRow({
  kind,
  title,
  peak,
  timeLabel,
  viewLabel,
  visibleLabel,
  onView,
  children,
}: {
  kind: PlannerTab;
  title: string;
  peak: number;
  timeLabel: string;
  viewLabel: string;
  visibleLabel?: string;
  onView: () => void;
  children?: ReactNode;
}) {
  const Icon = eventIcons[kind];
  return (
    <article className="sky-event">
      <details>
        <summary className="sky-event-summary">
          <span className={`sky-event-icon sky-event-icon-${kind}`}>
            <Icon size={19} aria-hidden="true" />
          </span>
          <span className="sky-event-label">
            <span className="sky-event-heading">
              <span className="sky-event-name">{title}</span>
              {visibleLabel && (
                <span className="sky-event-tag">{visibleLabel}</span>
              )}
            </span>
            <time dateTime={new Date(peak).toISOString()}>{timeLabel}</time>
          </span>
          <ChevronDown
            className="sky-event-chevron"
            size={14}
            aria-hidden="true"
          />
        </summary>
        <div className="sky-event-details">{children}</div>
      </details>
      <button
        className="secondary-action sky-event-view"
        aria-label={viewLabel}
        title={viewLabel}
        onClick={onView}
      >
        <Eye size={17} aria-hidden="true" />
      </button>
    </article>
  );
}
