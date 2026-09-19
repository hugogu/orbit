'use client';
import { useI18n } from '../lib/i18n/provider';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  ECLIPSE_LIST_SIZE,
  type EclipseList,
  type EclipseQuery,
  type SkyEvent,
  type SkyLocation,
} from '../lib/sky-events';
// Vite generates the default constructor; it is not an export of the worker source.
// oxlint-disable-next-line import/default
import AstronomyWorker from '../workers/astronomy.worker?worker';

export default function AstronomyPanel({
  open,
  onOpenChange,
  time,
  onEclipse,
  location,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  time: number;
  onEclipse: (ms: number, kind: 'solar' | 'lunar') => void;
  location: SkyLocation;
}) {
  const { t, locale } = useI18n();
  const [result, setResult] = useState<{
      query: EclipseQuery;
      data: EclipseList;
    } | null>(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState('solar');
  // The list answers the moment the panel was opened on. Recalculating against
  // a running clock would rewrite the results under the reader for no gain:
  // the next eclipse is months away, and playback moves by days per second.
  useEffect(() => {
    if (!open) return;
    const query: EclipseQuery = { start: time, ...location };
    let live = true;
    // The reset is deferred so reopening the panel does not cascade a render
    // inside this effect; the worker's reply is a later task either way.
    queueMicrotask(() => {
      if (!live) return;
      setResult(null);
      setError('');
    });
    let task: Worker;
    try {
      task = new AstronomyWorker();
    } catch {
      queueMicrotask(() => {
        if (live) setError('计算模块无法启动，请刷新后重试。');
      });
      return () => {
        live = false;
      };
    }
    // One question, one answer: the worker is released as soon as it replies
    // rather than idling with the ephemeris loaded until the panel closes.
    task.onmessage = (
      event: MessageEvent<{ result?: EclipseList; error?: string }>,
    ) => {
      task.terminate();
      if (!live) return;
      setError(event.data.error ?? '');
      if (event.data.result) setResult({ query, data: event.data.result });
    };
    task.onerror = () => {
      task.terminate();
      if (live) setError('计算模块加载失败，请刷新后重试。');
    };
    task.postMessage(query);
    return () => {
      live = false;
      task.terminate();
    };
    // The opening moment and place are a snapshot; see the note above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const format = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms + (result?.query.utcOffset ?? 0) * 3600000);
  const eventCard = (event: SkyEvent, kind: 'solar' | 'lunar') => (
    <article className="sky-event" key={event.peak}>
      <div className="sky-event-heading">
        <h3>{t(event.kind)}</h3>
        {event.local && <span className="sky-event-tag">{t('本地可见')}</span>}
      </div>
      <strong>{format(event.peak)}</strong>
      <p>{kind === 'solar' ? t('全球食甚') : t('食甚时间')}</p>
      {event.begin !== undefined && event.end !== undefined && (
        <p>
          {t('半影食始')} {format(event.begin)}
          <br />
          {t('半影食终')} {format(event.end)}
        </p>
      )}
      {!!event.obscuration && (
        <p>
          {t('食甚遮掩月面约 {{percent}}%', {
            percent: (event.obscuration * 100).toFixed(1),
          })}
        </p>
      )}
      {event.altitude !== undefined && (
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
      {event.local && (
        <div className="sky-event-local">
          <p>
            {t(
              event.local.altitude > 0
                ? '此地为{{kind}}，食甚 {{peak}}（太阳高度 {{altitude}}°）'
                : '此地为{{kind}}，但食甚 {{peak}} 时太阳已落到地平线下（{{altitude}}°），只有日落前的阶段可见。',
              {
                kind: t(event.local.kind),
                peak: format(event.local.peak),
                altitude: event.local.altitude.toFixed(1),
              },
            )}
          </p>
          <p>
            {t('初亏')} {format(event.local.begin)}
            <br />
            {t('复圆')} {format(event.local.end)}
          </p>
          <p>
            {t('食甚遮掩太阳面积约 {{percent}}%', {
              percent: (event.local.obscuration * 100).toFixed(1),
            })}
          </p>
        </div>
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
    </article>
  );
  const list = (events: SkyEvent[] | undefined, kind: 'solar' | 'lunar') =>
    error ? (
      <p role="alert" className="astro-error">
        {t(error)}
      </p>
    ) : !events ? (
      <p className="little-note">{t('正在计算未来天象…')}</p>
    ) : events.length === 0 ? (
      <p className="little-note">{t('在支持的日期范围内未找到下一次。')}</p>
    ) : (
      <div className="sky-results">
        {events.map((event) => eventCard(event, kind))}
      </div>
    );
  // Both notes belong under either list, so they ride inside the scrolling
  // panel rather than taking permanent height from a phone's viewport.
  const notes = (
    <>
      <p className="little-note">
        {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
          latitude: location.latitude.toFixed(4),
          longitude: location.longitude.toFixed(4),
          offset: `${location.utcOffset >= 0 ? '+' : ''}${location.utcOffset}`,
        })}
        {t('，可在地球的天体信息中调整。')}
      </p>
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
    </>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog astronomy-dialog"
      >
        <DialogTitle>{t('天象推演')}</DialogTitle>
        <DialogDescription>
          {result
            ? t('从 {{date}} 起的 {{count}} 次食象，均为观测地点的当地时间。', {
                date: format(result.query.start),
                count: ECLIPSE_LIST_SIZE,
              })
            : t('正在从当前模拟时间查找接下来的食象。')}
        </DialogDescription>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="settings-tabs"
        >
          <TabsList className="settings-tabs-list" aria-label={t('天象分类')}>
            <TabsTrigger value="solar">{t('日食')}</TabsTrigger>
            <TabsTrigger value="lunar">{t('月食')}</TabsTrigger>
          </TabsList>
          <TabsContent value="solar" className="settings-tab-panel">
            {list(result?.data.solar, 'solar')}
            {notes}
          </TabsContent>
          <TabsContent value="lunar" className="settings-tab-panel">
            {list(result?.data.lunar, 'lunar')}
            {notes}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
