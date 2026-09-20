'use client';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  compassPoint,
  moonMomentAt,
  moonObservingWindow,
  rightAscensionLabel,
  type MoonMoment,
  type ObservingWindow,
} from '../lib/lunar-phase';
import {
  localDayForTime,
  type ChosenLocationSource,
  type ObserverLocationSource,
  type SkyLocation,
} from '../lib/sky-events';
import ConceptHint from './concept-hint';
import LunarCalendar from './lunar-calendar';
import MoonPhaseDisc from './moon-phase-disc';
import ObserverLocation from './observer-location';

/**
 * The Moon's own phase readout, computed for the simulated moment and the
 * observation point rather than illustrated. Sits in the Moon's information
 * panel, where Earth carries its sunrise and sunset card.
 */
export default function MoonPhasePanel({
  time,
  location,
  locationSource,
  onLocationChange,
}: {
  time: number;
  location: SkyLocation;
  locationSource: ObserverLocationSource;
  onLocationChange: (
    location: SkyLocation,
    source: ChosenLocationSource,
  ) => void;
}) {
  const { t, locale } = useI18n();
  const [calendar, setCalendar] = useState(false);
  const ready = locationSource !== 'pending';
  // Both answers are a few milliseconds of Astronomy Engine, so they are read
  // straight from the clock rather than from a worker, and recomputed only when
  // the moment or the observation point actually changes.
  const readout = useMemo<{
    moment: MoonMoment;
    window: ObservingWindow;
  } | null>(() => {
    if (!ready) return null;
    try {
      return {
        moment: moonMomentAt(time, location),
        window: moonObservingWindow(time, location),
      };
    } catch {
      return null;
    }
  }, [ready, time, location]);
  const clock = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms + location.utcOffset * 3600000);
  const span = (from: number, to: number) => `${clock(from)} – ${clock(to)}`;
  const number = (value: number, digits = 1) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const fact = (label: string, value: string, unit?: string) => (
    <div key={label}>
      <span>{t(label)}</span>
      <strong>
        {value} {unit && <small>{unit}</small>}
      </strong>
    </div>
  );
  return (
    <section className="moon-phase" aria-label={t('当前月相')}>
      <div className="daily-sun-heading">
        <span className="concept-heading">
          {t('月相')}
          <ConceptHint
            label={t(
              '月面按相位角实时绘制，取地心视角、天球北极朝上；南半球看到的月面左右相反，已按观测点纬度镜像。月龄从上一次朔起算，视直径为地心值。',
            )}
          />
        </span>
        <small>
          {localDayForTime(time, location.utcOffset)} · {t('当地时间')}
        </small>
      </div>
      {readout ? (
        <>
          <div className="moon-phase-hero">
            <MoonPhaseDisc
              elongation={readout.moment.elongation}
              flip={location.latitude < 0}
              size={84}
            />
            <div className="moon-phase-summary">
              <strong>{t(readout.moment.phase)}</strong>
              <p>
                {t('照明 {{percent}}% · 月龄 {{age}} 天', {
                  percent: number(readout.moment.illumination * 100),
                  age: number(readout.moment.age),
                })}
              </p>
              <p className="little-note">
                {t('本轮朔望月 {{length}} 天', {
                  length: number(readout.moment.lunation, 2),
                })}
              </p>
            </div>
          </div>
          <div className="facts moon-phase-facts">
            {fact('相位角', `${number(readout.moment.elongation)}°`)}
            {fact(
              '地月距离',
              Math.round(readout.moment.distanceKm).toLocaleString(locale),
              'km',
            )}
            {fact('视直径', `${number(readout.moment.apparentDiameter, 2)}′`)}
            {fact(
              '高度角',
              `${number(readout.moment.altitude)}°`,
              t(readout.moment.altitude > 0 ? '地平线上方' : '地平线下方'),
            )}
            {fact(
              '方位角',
              `${number(readout.moment.azimuth)}°`,
              t(compassPoint(readout.moment.azimuth)),
            )}
            {fact(
              '赤经 / 赤纬',
              `${rightAscensionLabel(readout.moment.ra)} / ${number(readout.moment.dec)}°`,
            )}
          </div>
          <div className="moon-window">
            <span className="concept-heading">
              {t('今晚观月窗口')}
              <ConceptHint
                label={t(
                  '取当前所在或即将到来的一夜，从日落到次日日出之间月亮位于地平线以上的时段；天文暗夜指太阳低于地平线 18° 的时间。不考虑地形、建筑和天气。',
                )}
              />
            </span>
            {readout.window.start !== null && readout.window.end !== null ? (
              <>
                <strong>
                  {span(readout.window.start, readout.window.end)}
                </strong>
                {readout.window.best && (
                  <p>
                    {t('最高在 {{time}}，高度 {{altitude}}°（{{direction}}）', {
                      time: clock(readout.window.best.time),
                      altitude: number(readout.window.best.altitude),
                      direction: t(compassPoint(readout.window.best.azimuth)),
                    })}
                  </p>
                )}
                {readout.window.darkStart !== null &&
                  readout.window.darkEnd !== null && (
                    <p>
                      {t('天文暗夜 {{span}}', {
                        span: span(
                          readout.window.darkStart,
                          readout.window.darkEnd,
                        ),
                      })}
                    </p>
                  )}
              </>
            ) : (
              <strong>{t('今夜无观月窗口')}</strong>
            )}
            {readout.window.note && (
              <p className="little-note">{t(readout.window.note)}</p>
            )}
          </div>
          <button
            className="secondary-action moon-calendar-action"
            onClick={() => setCalendar(true)}
          >
            {t('月相日历与四相时刻')}
            <CalendarDays size={15} />
          </button>
        </>
      ) : (
        <p className="little-note">{t('正在加载观测点…')}</p>
      )}
      <ObserverLocation
        time={time}
        location={location}
        source={locationSource}
        onChange={onLocationChange}
      />
      <LunarCalendar
        open={calendar}
        onOpenChange={setCalendar}
        time={time}
        location={location}
      />
    </section>
  );
}
