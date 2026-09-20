'use client';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import {
  moonMomentAt,
  moonObservingWindow,
  type MoonMoment,
  type ObservingWindow,
} from '../lib/lunar-phase';
import type { SkyLocation } from '../lib/sky-events';
import MoonPhaseDisc from './moon-phase-disc';

/**
 * The Moon's phase at a glance, shown beside its information panel while the
 * Moon is the selected body.
 *
 * It carries only what is worth reading without opening anything — the drawn
 * disc, the phase's name, how lit and how old it is, and when it is up
 * tonight — and opens the full panel for everything else. The eclipse progress
 * card is the same idea for an eclipse in progress, and the two never appear
 * together: during an eclipse that card is the one with something to say.
 */
export default function MoonPhaseCard({
  time,
  location,
  onOpen,
}: {
  time: number;
  location: SkyLocation;
  onOpen: () => void;
}) {
  const { t, locale } = useI18n();
  const readout = useMemo<{
    phase: MoonMoment;
    window: ObservingWindow;
  } | null>(() => {
    try {
      return {
        phase: moonMomentAt(time, location),
        window: moonObservingWindow(time, location),
      };
    } catch {
      return null;
    }
  }, [time, location]);
  if (!readout) return null;
  const number = (value: number, digits = 1) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const clock = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms + location.utcOffset * 3600000);
  const { phase, window } = readout;
  return (
    <section className="moon-phase-card panel" aria-label={t('当前月相')}>
      <button className="moon-phase-card-open" onClick={onOpen}>
        <MoonPhaseDisc
          elongation={phase.elongation}
          flip={location.latitude < 0}
          size={46}
        />
        <span className="moon-phase-card-text">
          <strong>{t(phase.phase)}</strong>
          {/* One fact per line: combined they are wider than the card can give
              in English, and a truncated number reads as a defect. */}
          <small>
            {t('照明 {{percent}}%', {
              percent: number(phase.illumination * 100),
            })}
          </small>
          <small>{t('月龄 {{age}} 天', { age: number(phase.age) })}</small>
          <small>
            {window.start !== null && window.end !== null
              ? t('今晚 {{span}}', {
                  span: `${clock(window.start)} – ${clock(window.end)}`,
                })
              : t('今夜无观月窗口')}
          </small>
        </span>
        <ChevronRight className="moon-phase-card-chevron" aria-hidden="true" />
      </button>
    </section>
  );
}
