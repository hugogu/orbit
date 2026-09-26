'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { MAX_TIME, MIN_TIME } from '../lib/simulation-time';
import {
  observerTimeLabel,
  observerOffset,
  parseObserverTime,
  utcOffsetLabel,
  type ObserverClock,
} from '../lib/observer-time';

// Jumping to a moment belongs with the playback controls rather than in the
// event planner: both move the one simulation clock the whole scene shares.
export default function TimeJump({
  open,
  onOpenChange,
  time,
  clock,
  onSeek,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  time: number;
  clock: ObserverClock;
  onSeek: (ms: number, live?: boolean) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(''),
    [error, setError] = useState(''),
    [snapshot, setSnapshot] = useState({ time, clock });
  useEffect(() => {
    if (!open) return;
    let live = true;
    // Deferred so opening the dialog does not cascade a render in this effect.
    queueMicrotask(() => {
      if (!live) return;
      setSnapshot({ time, clock });
      setDate(observerTimeLabel(time, clock).replace(' ', 'T'));
      setError('');
    });
    return () => {
      live = false;
    };
    // The field opens on the current moment; a running clock must not retype it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  function seek() {
    const ms = parseObserverTime(date, snapshot.clock, snapshot.time);
    if (ms === null) {
      setError('请选择 1700—2200 年内有效的当地时间；夏令时跳过的时刻不可用。');
      return;
    }
    onSeek(ms);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog time-jump-dialog"
      >
        <DialogTitle>{t('跳到指定时间')}</DialogTitle>
        <DialogDescription>
          {t('所有天体共享此时间；切换目标保留模拟进度。')}
        </DialogDescription>
        <div className="astro-form">
          <label className="wide">
            {t('观测地当地时间 · {{zone}}', {
              zone:
                snapshot.clock.timeZone ??
                utcOffsetLabel(observerOffset(snapshot.time, snapshot.clock)),
            })}
            <input
              aria-label={t('观测地当地时间 · {{zone}}', {
                zone:
                  snapshot.clock.timeZone ??
                  utcOffsetLabel(observerOffset(snapshot.time, snapshot.clock)),
              })}
              type="datetime-local"
              step="1"
              min={observerTimeLabel(MIN_TIME, snapshot.clock).replace(
                ' ',
                'T',
              )}
              max={observerTimeLabel(MAX_TIME, snapshot.clock).replace(
                ' ',
                'T',
              )}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError('');
              }}
            />
          </label>
          <button className="primary-action wide" onClick={seek}>
            {t('应用时间并暂停')}
          </button>
          {error && (
            <p role="alert" className="wide astro-error">
              {t(error)}
            </p>
          )}
          <p className="wide little-note">
            {t('支持 1700—2200 年。用播放条上的“现在”可随时回到实时运行。')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
