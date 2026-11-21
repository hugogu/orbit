'use client';
import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  moonMomentAt,
  moonObservingWindow,
  type MoonMoment,
  type ObservingWindow,
} from '../lib/lunar-phase';
import type { SkyLocation } from '../lib/sky-events';
import MoonPhaseDisc from './moon-phase-disc';
import BodySummaryCard from './body-summary-card';

/**
 * The Moon's phase at a glance, shown beside its information panel while the
 * Moon is the selected body.
 *
 * On compact screens the same readout is the Moon's entry to body details.
 */
export default function MoonPhaseCard({
  time,
  location,
  preview = false,
  onOpen,
}: {
  time: number;
  location: SkyLocation;
  preview?: boolean;
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
    <BodySummaryCard
      className={preview ? undefined : 'moon-phase-card'}
      name={preview ? t('月球') : t(phase.phase)}
      image={
        <MoonPhaseDisc
          elongation={phase.elongation}
          phaseAngle={phase.phaseAngle}
          flip={location.latitude < 0}
          size={46}
        />
      }
      onOpen={onOpen}
    >
      {preview && <small>{t(phase.phase)}</small>}
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
    </BodySummaryCard>
  );
}
