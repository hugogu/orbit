'use client';
import { useMemo } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  calculateDailySunEvents,
  localDayForTime,
  type SkyLocation,
} from '../lib/sky-events';
import ConceptHint from './concept-hint';

export default function SunriseSunset({
  time,
  location,
  locationSource,
}: {
  time: number;
  location: SkyLocation;
  locationSource: 'pending' | 'device' | 'manual' | 'fallback';
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
  const offset = `${location.utcOffset >= 0 ? '+' : ''}${location.utcOffset}`;
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
          <p className="little-note">
            <span className="observer-readout">
              {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
                latitude: location.latitude.toFixed(4),
                longitude: location.longitude.toFixed(4),
                offset,
              })}
              <ConceptHint
                label={t(
                  locationSource === 'fallback'
                    ? '无法获取设备位置，当前显示参考坐标。可在“天象推演”中手动设置。'
                    : '可在“天象推演”中修改观测地点。',
                )}
              />
            </span>
            <br />
            {t(result.daylight)}。
          </p>
        </>
      ) : (
        <p className="little-note">{t('正在获取当前位置…')}</p>
      )}
    </section>
  );
}
