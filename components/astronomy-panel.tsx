'use client';
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
import type { SkyEvent, SkyQuery, SkyResults } from '../lib/sky-events';
// Vite generates the default constructor; it is not an export of the worker source.
// oxlint-disable-next-line import/default
import AstronomyWorker from '../workers/astronomy.worker?worker';

export default function AstronomyPanel({
  open,
  onOpenChange,
  time,
  onSeek,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  time: number;
  onSeek: (ms: number, live?: boolean) => void;
}) {
  const [date, setDate] = useState(''),
    [day, setDay] = useState('');
  const [latitude, setLatitude] = useState('39.9042'),
    [longitude, setLongitude] = useState('116.4074'),
    [height, setHeight] = useState('0'),
    [offset, setOffset] = useState('8');
  const [result, setResult] = useState<{
      query: SkyQuery;
      data: SkyResults;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const worker = useRef<Worker | null>(null),
    opened = useRef(false);
  useEffect(() => {
    if (open && !opened.current) {
      queueMicrotask(() => {
        if (!opened.current) return;
        setDate(utcLabel(time).replace(' ', 'T'));
        setDay(
          new Date(
            time + Math.max(-12, Math.min(14, Number(offset) || 0)) * 3600000,
          )
            .toISOString()
            .slice(0, 10),
        );
        setResult(null);
        setError('');
      });
    }
    if (!open) {
      worker.current?.terminate();
      worker.current = null;
      queueMicrotask(() => setBusy(false));
    }
    opened.current = open;
  }, [open, time, offset]);
  useEffect(() => () => worker.current?.terminate(), []);
  function clearResults() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setResult(null);
    setError('');
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
    if (
      !validTime(start) ||
      [latitude, longitude, height, offset].some((x) => !x.trim())
    ) {
      setError('请填写有效的时间和地点。');
      return;
    }
    const query = {
      start,
      day,
      latitude: Number(latitude),
      longitude: Number(longitude),
      height: Number(height),
      utcOffset: Number(offset),
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
      ? '当天无此事件'
      : utcLabel(ms + (result?.query.utcOffset ?? 0) * 3600000).slice(0, 16);
  const eventCard = (title: string, event: SkyEvent | null, local = false) => (
    <article className="sky-event">
      <span>{title}</span>
      {event ? (
        <>
          <h3>{event.kind}</h3>
          <strong>{format(event.peak)}</strong>
          <p>
            食甚时间
            {local && event.altitude !== undefined
              ? ` · 太阳高度 ${event.altitude.toFixed(1)}°`
              : ''}
          </p>
          {event.begin !== undefined && (
            <p>
              {local ? '初亏' : '半影食始'} {format(event.begin)}
              <br />
              {local ? '复圆' : '半影食终'} {format(event.end)}
            </p>
          )}
          {event.obscuration !== undefined && (
            <p>食甚遮掩太阳面积约 {(event.obscuration * 100).toFixed(1)}%</p>
          )}
          {!local && event.altitude !== undefined && (
            <p>
              此地点食甚时月亮在
              {event.altitude > 0 ? '地平线上方' : '地平线下方'}（
              {event.altitude.toFixed(1)}°）；其他阶段是否可见需另看月出月落。
            </p>
          )}
          <button className="secondary-action" onClick={() => seek(event.peak)}>
            跳到食甚时刻
          </button>
        </>
      ) : (
        <p>在支持的日期范围内未找到下一次。</p>
      )}
    </article>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="orbit-dialog astronomy-dialog">
        <DialogTitle>日期与天象</DialogTitle>
        <DialogDescription>
          选择时间探索太阳系，按观测地点查询日出日落和下一次食象。
        </DialogDescription>
        <div className="astro-form">
          <label className="wide">
            模拟时间（UTC）
            <input
              aria-label="模拟时间（UTC）"
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
            应用时间并暂停
          </button>
          <button
            className="secondary-action"
            onClick={() => seek(Date.now(), true)}
          >
            回到现在 · 实时运行
          </button>
          <p className="wide little-note">
            支持 1700—2200 年。所有天体共享此时间；切换目标保留模拟进度。
          </p>
          <label>
            纬度（北正南负）
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(e) => {
                setLatitude(e.target.value);
                clearResults();
              }}
            />
          </label>
          <label>
            经度（东正西负）
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(e) => {
                setLongitude(e.target.value);
                clearResults();
              }}
            />
          </label>
          <label>
            海拔（米）
            <input
              type="number"
              min="-500"
              max="10000"
              value={height}
              onChange={(e) => {
                setHeight(e.target.value);
                clearResults();
              }}
            />
          </label>
          <label>
            UTC 时差（小时）
            <input
              type="number"
              min="-12"
              max="14"
              step="0.25"
              value={offset}
              onChange={(e) => {
                setOffset(e.target.value);
                clearResults();
              }}
            />
          </label>
          <label className="wide">
            日出日落日期（当地）
            <input
              type="date"
              min="1700-01-01"
              max="2200-12-31"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                clearResults();
              }}
            />
          </label>
          <p className="wide little-note">
            默认地点北京。时差请包含当日夏令时；查询结果统一使用此固定时差。日出日落未考虑山脉、建筑和实际天气。
          </p>
          <button
            className="primary-action wide"
            onClick={calculate}
            disabled={busy}
          >
            {busy ? '正在计算天象…' : '计算日出日落与下一次食象'}
          </button>
          {busy && (
            <button className="secondary-action wide" onClick={clearResults}>
              取消计算
            </button>
          )}
          {error && (
            <p role="alert" className="wide astro-error">
              {error}
            </p>
          )}
        </div>
        {result && (
          <section aria-live="polite" className="sky-results">
            <p>
              观测点 {result.query.latitude}°, {result.query.longitude}° · UTC{' '}
              {result.query.utcOffset >= 0 ? '+' : ''}
              {result.query.utcOffset}
              <br />
              下一次食象从 {format(result.query.start)} 起查找。
            </p>
            <article className="sky-event">
              <span>{result.query.day} · 日出 / 日落</span>
              <div className="rise-set">
                <strong>
                  日出
                  <br />
                  {format(result.data.rise)}
                </strong>
                <strong>
                  日落
                  <br />
                  {format(result.data.set)}
                </strong>
              </div>
              <p>{result.data.daylight}</p>
            </article>
            {eventCard('全球下一次日食 · 不代表本地可见', result.data.solar)}
            {eventCard(
              '该地点下一次至少部分可见的日食',
              result.data.localSolar,
              true,
            )}
            {eventCard('全球下一次月食', result.data.lunar)}
          </section>
        )}
        <p className="little-note">
          天象由{' '}
          <a
            href="https://github.com/cosinekitty/astronomy"
            target="_blank"
            rel="noreferrer"
          >
            Astronomy Engine
          </a>{' '}
          独立计算。三维天体和卫星距离经过放大，不能用画面重叠判断日月食。未来与历史
          UTC 受地球自转预测误差影响。
        </p>
      </DialogContent>
    </Dialog>
  );
}
