'use client';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import ConceptHint from './concept-hint';
import { currentLocation } from '../lib/geolocation';
import type {
  ChosenLocationSource,
  ObserverLocationSource,
  SkyLocation,
} from '../lib/sky-events';

// The observation point only decides sunrise, sunset and local eclipse
// visibility, so it is edited beside the day's Sun times on Earth rather than
// inside the event planner.
export default function ObserverLocation({
  location,
  source,
  onChange,
}: {
  location: SkyLocation;
  source: ObserverLocationSource;
  onChange: (location: SkyLocation, source: ChosenLocationSource) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false),
    [locating, setLocating] = useState(false),
    [message, setMessage] = useState(''),
    [values, setValues] = useState<Record<string, string | number>>({});
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function locate() {
    if (locating) {
      request.current++;
      setLocating(false);
      return;
    }
    setMessage('');
    setLocating(true);
    const pending = ++request.current;
    try {
      const fix = await currentLocation(
        navigator.geolocation,
        window.isSecureContext,
      );
      if (pending !== request.current) return;
      // The device reports a place, not a time zone, so the offset follows the
      // browser's own zone at the simulated day; height stays as entered.
      const utcOffset = -new Date().getTimezoneOffset() / 60;
      onChange({ ...location, ...fix, utcOffset }, 'device');
      setMessage(
        '已定位，精度约 ±{{accuracy}} 米。时差按设备时区 {{zone}} 填写，请核对；海拔保留手动值。',
      );
      setValues({
        accuracy: Math.ceil(fix.accuracy),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      if (pending === request.current)
        setMessage(
          error instanceof Error
            ? error.message
            : '定位失败，请手动填写经纬度。',
        );
    } finally {
      if (pending === request.current) setLocating(false);
    }
  }
  const field = (
    label: string,
    key: keyof SkyLocation,
    range: { min: number; max: number; step?: string },
  ) => (
    <label>
      {t(label)}
      <input
        type="number"
        min={range.min}
        max={range.max}
        step={range.step ?? 'any'}
        value={location[key]}
        onChange={(e) => {
          const value = Number(e.target.value);
          setMessage('');
          if (e.target.value.trim() && Number.isFinite(value))
            onChange({ ...location, [key]: value }, 'manual');
        }}
      />
    </label>
  );
  const offset = `${location.utcOffset >= 0 ? '+' : ''}${location.utcOffset}`;
  return (
    <div className="observer-location">
      <p className="little-note observer-line">
        <span className="observer-readout">
          {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
            latitude: location.latitude.toFixed(4),
            longitude: location.longitude.toFixed(4),
            offset,
          })}
          <ConceptHint
            label={t(
              source === 'fallback'
                ? '当前使用北京参考坐标，可用右侧按钮定位或手动调整。'
                : '用于日出日落与日月食的当地可见性判断。',
            )}
          />
        </span>
        <span className="observer-actions">
          <button
            className="icon-button"
            aria-label={locating ? t('正在定位… 点击取消') : t('使用当前位置')}
            title={locating ? t('正在定位… 点击取消') : t('使用当前位置')}
            aria-busy={locating}
            onClick={locate}
          >
            <LocateFixed size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={t('调整观测地点')}
            title={t('调整观测地点')}
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal size={15} />
          </button>
        </span>
      </p>
      {message && <output className="little-note">{t(message, values)}</output>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel={t('Close')}
          className="orbit-dialog observer-dialog"
        >
          <DialogTitle>{t('观测地点')}</DialogTitle>
          <DialogDescription>
            {t('用于计算日出日落，以及日月食在此地的可见性。')}
          </DialogDescription>
          <div className="astro-form">
            {field('纬度（北正南负）', 'latitude', { min: -90, max: 90 })}
            {field('经度（东正西负）', 'longitude', { min: -180, max: 180 })}
            {field('海拔（米）', 'height', {
              min: -500,
              max: 10000,
              step: '1',
            })}
            {field('UTC 时差（小时）', 'utcOffset', {
              min: -12,
              max: 14,
              step: '0.25',
            })}
            <p className="wide little-note">
              {t(
                '经纬度采用 WGS84（不是国内地图的偏移坐标），只在本页计算使用。时差需包含当日夏令时；当地可见性不考虑地形、建筑和实际天气。',
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
