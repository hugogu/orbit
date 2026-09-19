'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n/provider';
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

// Jumping to a moment belongs with the playback controls rather than in the
// event planner: both move the one simulation clock the whole scene shares.
export default function TimeJump({
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
  const { t } = useI18n();
  const [date, setDate] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    // Deferred so opening the dialog does not cascade a render in this effect.
    queueMicrotask(() => {
      if (!live) return;
      setDate(utcLabel(time).replace(' ', 'T'));
      setError('');
    });
    return () => {
      live = false;
    };
    // The field opens on the current moment; a running clock must not retype it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  function seek() {
    const ms = Date.parse(date + 'Z');
    if (!validTime(ms)) {
      setError('请选择 1700—2200 年内的有效时间。');
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
