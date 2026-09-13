'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Progress } from './ui/progress';
import { useI18n } from '../lib/i18n/provider';
import {
  eclipseProgress,
  solarCircumstance,
  solarPathWidth,
  type EclipseProgressEvent,
} from '../lib/eclipse-progress';
import { utcLabel } from '../lib/simulation-time';

const names: Record<string, string> = {
  'solar-total': '日全食',
  'solar-annular': '日环食',
  'solar-partial': '日偏食',
  'solar-hybrid': '全环食',
  'lunar-total': '月全食',
  'lunar-partial': '月偏食',
  'lunar-penumbral': '月半影食',
};
export default function EclipseProgressPanel({
  event,
  time,
  onSeek,
  onObserve,
}: {
  event: EclipseProgressEvent;
  time: number;
  onSeek: (time: number) => void;
  onObserve: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia(
      '(min-width: 901px) and (min-height: 601px)',
    );
    const sync = () => setExpanded(wide.matches);
    queueMicrotask(sync);
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);
  const progress = eclipseProgress(event, time);
  const second = Math.floor(time / 1000) * 1000;
  const current = useMemo(
    () => (event.type === 'solar' ? solarCircumstance(second) : null),
    [event.type, second],
  );
  const width = useMemo(
    () => (event.type === 'solar' ? solarPathWidth(second) : null),
    [event.type, second],
  );
  const phaseTime = (ms: number) => {
    const label = utcLabel(ms);
    return label.slice(0, 10) === utcLabel(event.peak).slice(0, 10)
      ? label.slice(11, 19)
      : label.slice(5, 19);
  };
  return (
    <section
      className="eclipse-progress panel"
      aria-label={t('天象进展')}
      data-expanded={expanded}
    >
      <button
        className="eclipse-progress-heading"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="eclipse-progress-details"
      >
        <span>
          <strong>
            {t(names[`${event.type}-${event.kind}`])} · {t('进行中')}
          </strong>
          <small>{utcLabel(event.peak).slice(0, 10)} · UTC</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <Progress value={progress.fraction * 100} aria-label={t('天象进展')} />
      <div className="eclipse-progress-phase">
        <span>{t(progress.stage)}</span>
        <span>{Math.round(progress.fraction * 100)}%</span>
      </div>
      <div className="eclipse-progress-details" id="eclipse-progress-details">
        {current && (
          <dl className="eclipse-circumstances">
            <div>
              <dt>{t('当前影轴位置')}</dt>
              <dd>
                {Math.abs(current.latitude).toFixed(1)}°
                {current.latitude < 0 ? 'S' : 'N'}　
                {Math.abs(current.longitude).toFixed(1)}°
                {current.longitude < 0 ? 'W' : 'E'}
              </dd>
            </div>
            <div>
              <dt>{t('中心处太阳遮掩率')}</dt>
              <dd>{(current.obscuration * 100).toFixed(1)}%</dd>
            </div>
            {width !== null && (
              <div>
                <dt>{t('此处食带宽度约')}</dt>
                <dd>{Math.round(width)} km</dd>
              </div>
            )}
          </dl>
        )}
        <ol className="eclipse-contacts">
          {event.phases.map((phase) => (
            <li key={phase.key} data-past={phase.time <= time}>
              <button
                onClick={() => onSeek(phase.time)}
                aria-label={t('跳到{{phase}}', { phase: t(phase.key) })}
              >
                <span>{t(phase.key)}</span>
                <time dateTime={new Date(phase.time).toISOString()}>
                  {phaseTime(phase.time)}
                </time>
              </button>
            </li>
          ))}
        </ol>
        <p className="eclipse-progress-note">
          {t(
            event.type === 'lunar'
              ? '月食进度为全球阶段；当地能否看到取决于月亮是否在地平线上方。'
              : event.path?.coverage === 'partial'
                ? '浅金色为整场偏食覆盖区，本次没有全食或环食带。'
                : '浅金色为完整全食／环食带，亮点为当前影轴位置。',
          )}
        </p>
        {event.type === 'solar' && (
          <p className="eclipse-progress-note">
            {t('全球进程 · 球形地球近似；各地见食时间不同。')}
          </p>
        )}
        <button className="eclipse-observe" onClick={onObserve}>
          {t('观察此天象')}
        </button>
      </div>
    </section>
  );
}
