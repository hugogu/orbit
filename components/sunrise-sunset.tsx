'use client';
import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  calculateDailySunEvents,
  localDayForTime,
  type ChosenLocationSource,
  type ObserverLocationSource,
  type SkyLocation,
} from '../lib/sky-events';
import ConceptHint from './concept-hint';
import ObserverLocation from './observer-location';

export default function SunriseSunset({
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
  const day = localDayForTime(time, location.utcOffset);
  const result = useMemo(
    () =>
      locationSource === 'pending'
        ? null
        : calculateDailySunEvents({ ...location, day }),
    [day, location, locationSource],
  );
  const format = (ms: number | null) =>
    ms == null
      ? t('当天无此事件')
      : new Intl.DateTimeFormat(locale, {
          timeStyle: 'short',
          hourCycle: 'h23',
          timeZone: 'UTC',
        }).format(ms + location.utcOffset * 3600000);
  return (
    <section className="daily-sun" aria-label={t('当日日出日落')}>
      <div className="daily-sun-heading">
        <span className="concept-heading">
          {t('日出 / 日落')}
          <ConceptHint label={t('按太阳上缘和标准大气折射计算')} />
        </span>
        <small>
          {day} · {t('当地时间')}
        </small>
      </div>
      {result ? (
        <>
          <div className="facts daily-sun-facts">
            <div>
              <span>{t('日出')}</span>
              <strong>{format(result.rise)}</strong>
            </div>
            <div>
              <span>{t('日落')}</span>
              <strong>{format(result.set)}</strong>
            </div>
          </div>
          {result.daylight !== '按太阳上缘和标准大气折射计算' && (
            <p className="little-note">{t(result.daylight)}。</p>
          )}
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
    </section>
  );
}
