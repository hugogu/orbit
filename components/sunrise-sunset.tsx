'use client';
import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  calculateDailySunEvents,
  localDayForTime,
  type SkyLocation,
} from '../lib/sky-events';

export default function SunriseSunset({
  time,
  location,
}: {
  time: number;
  location: SkyLocation;
}) {
  const { t, locale } = useI18n();
  const day = localDayForTime(time, location.utcOffset);
  const result = useMemo(
    () => calculateDailySunEvents({ ...location, day }),
    [day, location],
  );
  const format = (ms: number | null) =>
    ms == null
      ? t('当天无此事件')
      : new Intl.DateTimeFormat(locale, {
          timeStyle: 'short',
          hourCycle: 'h23',
          timeZone: 'UTC',
        }).format(ms + location.utcOffset * 3600000);
  const offset = `${location.utcOffset >= 0 ? '+' : ''}${location.utcOffset}`;
  return (
    <section className="daily-sun" aria-label={t('当日日出日落')}>
      <div className="daily-sun-heading">
        <span>{t('日出 / 日落')}</span>
        <small>
          {day} · {t('当地时间')}
        </small>
      </div>
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
      <p className="little-note">
        {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
          latitude: location.latitude.toFixed(4),
          longitude: location.longitude.toFixed(4),
          offset,
        })}
        <br />
        {t(result.daylight)}。{t('可在“天象推演”中修改观测地点。')}
      </p>
    </section>
  );
}
