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
import { compassPoints } from '../lib/lunar-phase';

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
  const bearing = (azimuth: number | null) =>
    azimuth === null
      ? null
      : `${t(compassPoints[Math.round(azimuth / 45) % 8])} · ${Math.round(azimuth) % 360}°`;
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
              {bearing(result.riseAzimuth) && <small>{bearing(result.riseAzimuth)}</small>}
            </div>
            <div>
              <span>{t('日落')}</span>
              <strong>{format(result.set)}</strong>
              {bearing(result.setAzimuth) && <small>{bearing(result.setAzimuth)}</small>}
            </div>
          </div>
          {result.daylight !== '按太阳上缘和标准大气折射计算' && (
            <p className="little-note">{t(result.daylight)}。</p>
          )}
          <p className="little-note">{t('方位角从真北顺时针计；按理想地平线估算。地形、建筑、天气和大气会影响实际观测。不要直视太阳或用无防护光学设备指向太阳。')}</p>
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
