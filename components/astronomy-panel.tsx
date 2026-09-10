'use client';
import { useI18n } from '../lib/i18n/provider';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  MAX_TIME,
  MIN_TIME,
  utcLabel,
  validTime,
} from '../lib/simulation-time';
import {
  localDayForTime,
  type SkyEvent,
  type SkyLocation,
  type SkyQuery,
  type SkyResults,
} from '../lib/sky-events';
import { currentLocation } from '../lib/geolocation';
import { LocateFixed } from 'lucide-react';
// Vite generates the default constructor; it is not an export of the worker source.
// oxlint-disable-next-line import/default
import AstronomyWorker from '../workers/astronomy.worker?worker';

export default function AstronomyPanel({
  open,
  onOpenChange,
  time,
  onSeek,
  onEclipse,
  location,
  onLocationChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  time: number;
  onSeek: (ms: number, live?: boolean) => void;
  onEclipse: (ms: number, kind: 'solar' | 'lunar') => void;
  location: SkyLocation;
  onLocationChange: (location: SkyLocation) => void;
}) {
  const { t, locale } = useI18n();
  const [date, setDate] = useState('');
  const [latitude, setLatitude] = useState(String(location.latitude)),
    [longitude, setLongitude] = useState(String(location.longitude)),
    [height, setHeight] = useState(String(location.height)),
    [offset, setOffset] = useState(String(location.utcOffset));
  const [result, setResult] = useState<{
      query: SkyQuery;
      data: SkyResults;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [locating, setLocating] = useState(false),
    [locationMessage, setLocationMessage] = useState('');
  const [locationValues, setLocationValues] = useState<
    Record<string, string | number>
  >({});
  const locationRequest = useRef(0);
  const worker = useRef<Worker | null>(null),
    opened = useRef(false);
  useEffect(() => {
    if (open && !opened.current) {
      queueMicrotask(() => {
        if (!opened.current) return;
        setDate(utcLabel(time).replace(' ', 'T'));
        setLatitude(String(location.latitude));
        setLongitude(String(location.longitude));
        setHeight(String(location.height));
        setOffset(String(location.utcOffset));
        setResult(null);
        setError('');
      });
    }
    if (!open) {
      locationRequest.current++;
      worker.current?.terminate();
      worker.current = null;
      queueMicrotask(() => {
        setBusy(false);
        setLocating(false);
      });
    }
    opened.current = open;
  }, [open, time, location]);
  useEffect(
    () => () => {
      worker.current?.terminate();
      locationRequest.current++;
    },
    [],
  );
  function clearResults() {
    locationRequest.current++;
    setLocating(false);
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setResult(null);
    setError('');
  }
  async function locate() {
    clearResults();
    setLocationMessage('');
    setLocating(true);
    const request = ++locationRequest.current;
    try {
      const fix = await currentLocation(
        navigator.geolocation,
        window.isSecureContext,
      );
      if (request !== locationRequest.current) return;
      setLatitude(fix.latitude.toFixed(5));
      setLongitude(fix.longitude.toFixed(5));
      const localDate = new Date(date.slice(0, 10) + 'T12:00:00');
      const nextOffset = Number.isFinite(localDate.getTime())
        ? -localDate.getTimezoneOffset() / 60
        : Number(offset);
      if (Number.isFinite(localDate.getTime())) setOffset(String(nextOffset));
      onLocationChange({
        latitude: fix.latitude,
        longitude: fix.longitude,
        height: Number(height) || 0,
        utcOffset: nextOffset,
      });
      setLocationMessage(
        '已定位，精度约 ±{{accuracy}} 米。时差按设备时区 {{zone}} 的所选日期填写，请核对；海拔保留手动值。',
      );
      setLocationValues({
        accuracy: Math.ceil(fix.accuracy),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      if (request === locationRequest.current)
        setLocationMessage(
          error instanceof Error
            ? error.message
            : '定位失败，请手动填写经纬度。',
        );
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  }
  function seek(ms: number, live = false) {
    if (!validTime(ms)) {
      setError('请选择 1700—2200 年内的有效时间。');
      return;
    }
    onSeek(ms, live);
    onOpenChange(false);
  }
  function calculate() {
    clearResults();
    const start = Date.parse(date + 'Z');
    const numericLocation = [latitude, longitude, height, offset].map(Number);
    if (
      !validTime(start) ||
      numericLocation.some((value) => !Number.isFinite(value))
    ) {
      setError('请填写有效的时间和地点。');
      return;
    }
    const [numericLatitude, numericLongitude, numericHeight, utcOffset] =
      numericLocation;
    const query = {
      start,
      day: localDayForTime(start, utcOffset),
      latitude: numericLatitude,
      longitude: numericLongitude,
      height: numericHeight,
      utcOffset,
    };
    setBusy(true);
    let task: Worker;
    try {
      task = new AstronomyWorker();
    } catch {
      setBusy(false);
      setError('计算模块无法启动，请刷新后重试。');
      return;
    }
    worker.current = task;
    task.onmessage = (
      event: MessageEvent<{ result?: SkyResults; error?: string }>,
    ) => {
      if (worker.current !== task) return;
      setBusy(false);
      setError(event.data.error ?? '');
      if (event.data.result) setResult({ query, data: event.data.result });
      task.terminate();
      worker.current = null;
    };
    task.onerror = () => {
      if (worker.current === task) {
        setBusy(false);
        setError('计算模块加载失败，请刷新后重试。');
        task.terminate();
        worker.current = null;
      }
    };
    task.postMessage(query);
  }
  const format = (ms: number | null | undefined) =>
    ms == null
      ? t('当天无此事件')
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'short',
          timeStyle: 'short',
          hourCycle: 'h23',
          timeZone: 'UTC',
        }).format(ms + (result?.query.utcOffset ?? 0) * 3600000);
  const eventCard = (
    title: string,
    event: SkyEvent | null,
    local = false,
    kind: 'solar' | 'lunar' = 'solar',
  ) => (
    <article className="sky-event">
      <span>{t(title)}</span>
      {event ? (
        <>
          <h3>{t(event.kind)}</h3>
          <strong>{format(event.peak)}</strong>
          <p>
            {t('食甚时间')}
            {local && event.altitude !== undefined
              ? t(' · 太阳高度 {{v0}}°', { v0: event.altitude.toFixed(1) })
              : ''}
          </p>
          {event.begin !== undefined && (
            <p>
              {local ? t('初亏') : t('半影食始')} {format(event.begin)}
              <br />
              {local ? t('复圆') : t('半影食终')} {format(event.end)}
            </p>
          )}
          {event.obscuration !== undefined && (
            <p>
              {t('食甚遮掩太阳面积约 {{percent}}%', {
                percent: (event.obscuration * 100).toFixed(1),
              })}
            </p>
          )}
          {!local && event.altitude !== undefined && (
            <p>
              {t(
                '此地点食甚时月亮在{{horizon}}（{{altitude}}°）；其他阶段是否可见需另看月出月落。',
                {
                  horizon: t(event.altitude > 0 ? '地平线上方' : '地平线下方'),
                  altitude: event.altitude.toFixed(1),
                },
              )}
            </p>
          )}
          <button
            className="secondary-action"
            onClick={() => {
              onEclipse(event.peak, kind);
              onOpenChange(false);
            }}
          >
            {t('观察食甚阴影')}
          </button>
        </>
      ) : (
        <p>{t('在支持的日期范围内未找到下一次。')}</p>
      )}
    </article>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog astronomy-dialog"
      >
        <DialogTitle>{t('天象推演')}</DialogTitle>
        <DialogDescription>
          {t('选择模拟时间探索下一次日食与月食；观测点用于判断当地可见性。')}
        </DialogDescription>
        <div className="astro-form">
          <label className="wide">
            {t('模拟时间（UTC）')}
            <input
              aria-label={t('模拟时间（UTC）')}
              type="datetime-local"
              step="1"
              min={new Date(MIN_TIME).toISOString().slice(0, 19)}
              max={new Date(MAX_TIME).toISOString().slice(0, 19)}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearResults();
              }}
            />
          </label>
          <button
            className="primary-action"
            onClick={() => seek(Date.parse(date + 'Z'))}
          >
            {t('应用时间并暂停')}
          </button>
          <button
            className="secondary-action"
            onClick={() => seek(Date.now(), true)}
          >
            {t('回到现在 · 实时运行')}
          </button>
          <p className="wide little-note">
            {t('支持 1700—2200 年。所有天体共享此时间；切换目标保留模拟进度。')}
          </p>
          <button
            className="secondary-action wide location-button"
            onClick={locating ? clearResults : locate}
          >
            <LocateFixed size={16} />
            {locating ? t('正在定位… 点击取消') : t('使用当前位置')}
          </button>
          {locationMessage && (
            <output className="wide little-note">
              {t(locationMessage, locationValues)}
            </output>
          )}
          <label>
            {t('纬度（北正南负）')}
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(e) => {
                const value = e.target.value;
                setLatitude(value);
                setLocationMessage('');
                clearResults();
                if (value.trim() && Number.isFinite(Number(value)))
                  onLocationChange({ ...location, latitude: Number(value) });
              }}
            />
          </label>
          <label>
            {t('经度（东正西负）')}
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(e) => {
                const value = e.target.value;
                setLongitude(value);
                setLocationMessage('');
                clearResults();
                if (value.trim() && Number.isFinite(Number(value)))
                  onLocationChange({ ...location, longitude: Number(value) });
              }}
            />
          </label>
          <label>
            {t('海拔（米）')}
            <input
              type="number"
              min="-500"
              max="10000"
              value={height}
              onChange={(e) => {
                const value = e.target.value;
                setHeight(value);
                clearResults();
                if (value.trim() && Number.isFinite(Number(value)))
                  onLocationChange({ ...location, height: Number(value) });
              }}
            />
          </label>
          <label>
            {t('UTC 时差（小时）')}
            <input
              type="number"
              min="-12"
              max="14"
              step="0.25"
              value={offset}
              onChange={(e) => {
                const value = e.target.value;
                setOffset(value);
                clearResults();
                if (value.trim() && Number.isFinite(Number(value)))
                  onLocationChange({ ...location, utcOffset: Number(value) });
              }}
            />
          </label>
          <p className="wide little-note">
            {t(
              '初始地点为北京，可定位或手动修改。经纬度采用 WGS84（不是国内地图的偏移坐标），只在本页计算使用。时差需包含当日夏令时；当地可见性不考虑地形、建筑和实际天气。',
            )}
          </p>
          <button
            className="primary-action wide"
            onClick={calculate}
            disabled={busy}
          >
            {busy ? t('正在计算天象…') : t('计算下一次食象')}
          </button>
          {busy && (
            <button className="secondary-action wide" onClick={clearResults}>
              {t('取消计算')}
            </button>
          )}
          {error && (
            <p role="alert" className="wide astro-error">
              {t(error)}
            </p>
          )}
        </div>
        {result && (
          <section aria-live="polite" className="sky-results">
            <p>
              {t('观测点')}
              {result.query.latitude}°, {result.query.longitude}° · UTC{' '}
              {result.query.utcOffset >= 0 ? '+' : ''}
              {result.query.utcOffset}
              <br />
              {t('下一次食象从 {{date}} 起查找。', {
                date: format(result.query.start),
              })}
            </p>
            {eventCard(t('全球下一次日食 · 不代表本地可见'), result.data.solar)}
            {eventCard(
              t('该地点下一次至少部分可见的日食'),
              result.data.localSolar,
              true,
            )}
            {eventCard(t('全球下一次月食'), result.data.lunar, false, 'lunar')}
          </section>
        )}
        <p className="little-note">
          {t('天象由')}{' '}
          <a
            href="https://github.com/cosinekitty/astronomy"
            target="_blank"
            rel="noreferrer"
          >
            Astronomy Engine
          </a>{' '}
          {t(
            '独立计算。“观察食甚阴影”会聚焦地球或月球，暂停于食甚；点击播放可按 1 分钟/秒观察影区移动。表面食影按物理尺度计算，三维天体间距仍有放大，不能用画面重叠判断日月食。未来与历史 UTC 受地球自转预测误差影响。',
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
