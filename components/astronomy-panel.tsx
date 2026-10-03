'use client';
import { useI18n } from '../lib/i18n/provider';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  mergeEvents,
  type EclipseList,
  type EclipseQuery,
  type SkyEvent,
  type SkyLocation,
} from '../lib/sky-events';
import {
  type PlanetEvent,
  type PlanetEventList,
  type PlannerTab,
} from '../lib/planet-events';
import { catalogEntry, eventDetailsPath } from '../lib/seo';
import { occurrenceForPlanetEvent } from '../lib/event-occurrences';
// Vite generates the default constructor; it is not an export of the worker source.
// oxlint-disable-next-line import/default
import AstronomyWorker from '../workers/astronomy.worker?worker';

type Kind = 'solar' | 'lunar';
type PlannerList = EclipseList & PlanetEventList;
type Loaded = PlanetEventList & {
  /** The moment and place these events answer. */
  query: EclipseQuery;
  solar: SkyEvent[];
  lunar: SkyEvent[];
  next: Record<Kind, number | null>;
};
const samePlace = (a: SkyLocation, b: SkyLocation) =>
  a.latitude === b.latitude &&
  a.longitude === b.longitude &&
  a.height === b.height &&
  a.utcOffset === b.utcOffset;
// What is on screen still answers a later moment as long as the clock has not
// reached the first event listed: the next eclipse is months away, so reopening
// the panel after a few simulated days would only recompute the same answer,
// and would throw away however far the reader had paged.
function stillAnswers(
  loaded: Loaded | null,
  start: number,
  place: SkyLocation,
) {
  if (!loaded || !samePlace(loaded.query, place)) return false;
  const first = Math.min(
    loaded.solar[0]?.peak ?? Infinity,
    loaded.lunar[0]?.peak ?? Infinity,
    loaded.opposition[0]?.peak ?? Infinity,
    loaded.transit[0]?.peak ?? Infinity,
  );
  return start >= loaded.query.start && start <= first;
}

export default function AstronomyPanel({
  open,
  onOpenChange,
  tab,
  onTabChange,
  time,
  onEclipse,
  onPlanetEvent,
  location,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tab: PlannerTab;
  onTabChange: (kind: PlannerTab) => void;
  time: number;
  onEclipse: (ms: number, kind: Kind) => void;
  onPlanetEvent: (
    ms: number,
    body: string,
    kind: 'opposition' | 'transit',
  ) => void;
  location: SkyLocation;
}) {
  const { t, locale } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [busy, setBusy] = useState<'first' | Kind | null>(null),
    [error, setError] = useState('');
  const live = useRef(true),
    // Only the newest request may land: reopening the panel on a new moment
    // must not be overwritten by the answer to the moment before it.
    request = useRef(0);
  useEffect(() => {
    // Set on the way in as well as cleared on the way out. A development
    // double-invoke runs the cleanup between two mounts, and a flag that is
    // only ever cleared would discard every reply from then on.
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  // One question, one answer: each request gets its own worker and releases it
  // as soon as it replies, rather than idling with the ephemeris loaded.
  function ask(query: EclipseQuery, onDone: (list: PlannerList) => void) {
    const ticket = ++request.current;
    const stale = () => !live.current || ticket !== request.current;
    let task: Worker;
    try {
      task = new AstronomyWorker();
    } catch {
      setBusy(null);
      setError('计算模块无法启动，请刷新后重试。');
      return;
    }
    task.onmessage = (
      event: MessageEvent<{ result?: PlannerList; error?: string }>,
    ) => {
      task.terminate();
      if (stale()) return;
      setBusy(null);
      setError(event.data.error ?? '');
      if (event.data.result) onDone(event.data.result);
    };
    task.onerror = () => {
      task.terminate();
      if (stale()) return;
      setBusy(null);
      setError('计算模块加载失败，请刷新后重试。');
    };
    task.postMessage(query);
  }
  useEffect(() => {
    if (!open) return;
    const query: EclipseQuery = { start: time, ...location };
    // The decision is taken here rather than inside a state updater: an updater
    // must stay pure, and React may replay or discard one.
    if (stillAnswers(loaded, query.start, location)) return;
    // Deferred so opening the panel does not cascade a render in this effect.
    queueMicrotask(() => {
      if (!live.current) return;
      setLoaded(null);
      setError('');
      setBusy('first');
      ask(query, (list) =>
        setLoaded({
          query,
          solar: list.solar.events,
          lunar: list.lunar.events,
          opposition: list.opposition,
          transit: list.transit,
          next: { solar: list.solar.next, lunar: list.lunar.next },
        }),
      );
    });
    // The opening moment and place are a snapshot; see the note above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  function loadMore(kind: Kind) {
    const start = loaded?.next[kind];
    if (!loaded || start == null || busy) return;
    setBusy(kind);
    setError('');
    ask({ ...loaded.query, start, page: true }, (list) =>
      setLoaded((current) =>
        current === null
          ? current
          : {
              ...current,
              [kind]: mergeEvents(current[kind], list[kind].events),
              next: { ...current.next, [kind]: list[kind].next },
            },
      ),
    );
  }
  // Every time and the observation point under them describe the same query:
  // the place the list was computed for, not whatever the app holds now. They
  // rejoin when the panel is reopened, where a changed place recalculates.
  const answered: SkyLocation = loaded?.query ?? location;
  const format = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms + answered.utcOffset * 3600000);
  const eventCard = (event: SkyEvent, kind: Kind) => (
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
  // Both notes belong under either list, so they ride inside the scrolling
  // panel rather than taking permanent height from a phone's viewport.
  const notes = (
    <>
      <p className="little-note">
        {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
          latitude: answered.latitude.toFixed(4),
          longitude: answered.longitude.toFixed(4),
          offset: `${answered.utcOffset >= 0 ? '+' : ''}${answered.utcOffset}`,
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
  const list = (kind: Kind) => {
    if (error)
      return (
        <p role="alert" className="astro-error">
          {t(error)}
        </p>
      );
    if (!loaded) return <p className="little-note">{t('正在计算未来天象…')}</p>;
    const events = loaded[kind];
    if (events.length === 0)
      return (
        <p className="little-note">{t('在支持的日期范围内未找到下一次。')}</p>
      );
    return (
      <>
        <div className="sky-results">
          {events.map((event) => eventCard(event, kind))}
        </div>
        {loaded.next[kind] === null ? (
          <p className="little-note">
            {t('已列出支持范围内（至 2200 年）的全部{{kind}}。', {
              kind: t(kind === 'solar' ? '日食' : '月食'),
            })}
          </p>
        ) : (
          <button
            className="secondary-action load-more"
            onClick={() => loadMore(kind)}
            disabled={busy !== null}
          >
            {busy === kind ? t('正在计算未来天象…') : t('继续加载更多')}
          </button>
        )}
      </>
    );
  };
  const planetList = (kind: 'opposition' | 'transit') => {
    if (error)
      return (
        <p role="alert" className="astro-error">
          {t(error)}
        </p>
      );
    if (!loaded) return <p className="little-note">{t('正在计算未来天象…')}</p>;
    const events = loaded[kind];
    return (
      <>
        <p className="little-note">
          {t(
            kind === 'opposition'
              ? '列出火星、木星、土星、天王星和海王星各自接下来的三次冲日。水星和金星没有冲日。'
              : '从地球只能看到水星和金星凌日，列出各自接下来的两次；外行星不会凌日。',
          )}
        </p>
        {events.length === 0 && (
          <p className="little-note">{t('在支持的日期范围内未找到下一次。')}</p>
        )}
        <div className="sky-results">
          {events.map((event: PlanetEvent) => {
            const edition = occurrenceForPlanetEvent(
              kind,
              event.body,
              event.peak,
            );
            return (
              <article
                className="sky-event"
                key={`${event.body}-${event.peak}`}
              >
                <div className="sky-event-heading">
                  <h3>
                    {t(
                      kind === 'opposition' ? '{{name}}冲日' : '{{name}}凌日',
                      {
                        name: t(catalogEntry(event.body)!.data.name),
                      },
                    )}
                  </h3>
                </div>
                <strong>{format(event.peak)}</strong>
                <p>
                  {t(
                    kind === 'opposition' ? '冲日时刻' : '凌日中心角距最小时刻',
                  )}
                </p>
                {kind === 'opposition' ? (
                  <>
                    <p>
                      {t('地心距离 {{distance}} AU · 视星等 {{magnitude}}', {
                        distance: event.distance.toFixed(3),
                        magnitude: event.magnitude.toFixed(1),
                      })}
                    </p>
                    <p>
                      {t(
                        '此地冲日时行星高度 {{altitude}}°；请在附近夜晚、行星升高时观测。',
                        {
                          altitude: event.altitude.toFixed(1),
                        },
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      {t('凌始')} {format(event.begin!)}
                      <br />
                      {t('凌终')} {format(event.end!)}
                    </p>
                    <p>
                      {t(
                        '此地凌日中点时太阳高度 {{altitude}}°；完整可见时段还取决于日出日落。',
                        {
                          altitude: event.altitude.toFixed(1),
                        },
                      )}
                    </p>
                  </>
                )}
                <button
                  className="secondary-action"
                  onClick={() => {
                    onPlanetEvent(event.peak, event.body, kind);
                    onOpenChange(false);
                  }}
                >
                  {t('观察此刻')}
                </button>
                {edition && (
                  <a
                    className="sky-event-guide-link"
                    href={eventDetailsPath(locale, edition.id)}
                  >
                    {t('本次事件介绍')}
                  </a>
                )}
              </article>
            );
          })}
        </div>
        <p className="little-note">
          {t(
            kind === 'opposition'
              ? '冲日按地心视黄经与太阳相差 180° 计算；并不保证恰在距离最近的时刻。日期由 Astronomy Engine 计算，仅列出至 2200 年的事件。'
              : '凌日接触时刻为地心计算，观测地点的接触时刻会有视差。必须在光学设备物镜前端牢固安装专用太阳滤镜，绝不可通过未加防护的设备看太阳。日期由 Astronomy Engine 计算，仅列出至 2200 年的事件。',
          )}
        </p>
        <p className="little-note">
          {t('三维观测台的大小与距离可以放大，请勿用画面重叠判断冲日或凌日。')}
        </p>
        <p className="little-note">
          {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
            latitude: answered.latitude.toFixed(4),
            longitude: answered.longitude.toFixed(4),
            offset: `${answered.utcOffset >= 0 ? '+' : ''}${answered.utcOffset}`,
          })}
          {t('，可在地球的天体信息中调整。')}
        </p>
      </>
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog astronomy-dialog"
      >
        <DialogTitle>{t('天象推演')}</DialogTitle>
        <DialogDescription>
          {loaded
            ? t('从 {{date}} 起的天象，均为观测地点的当地时间。', {
                date: format(loaded.query.start),
              })
            : t('正在从当前模拟时间查找接下来的天象。')}
        </DialogDescription>
        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(String(value) as PlannerTab)}
          className="settings-tabs"
        >
          <TabsList className="settings-tabs-list" aria-label={t('天象分类')}>
            <TabsTrigger value="solar">{t('日食')}</TabsTrigger>
            <TabsTrigger value="lunar">{t('月食')}</TabsTrigger>
            <TabsTrigger value="opposition">{t('行星冲日')}</TabsTrigger>
            <TabsTrigger value="transit">{t('行星凌日')}</TabsTrigger>
          </TabsList>
          <TabsContent value="solar" className="settings-tab-panel">
            {list('solar')}
            {notes}
          </TabsContent>
          <TabsContent value="lunar" className="settings-tab-panel">
            {list('lunar')}
            {notes}
          </TabsContent>
          <TabsContent value="opposition" className="settings-tab-panel">
            {planetList('opposition')}
          </TabsContent>
          <TabsContent value="transit" className="settings-tab-panel">
            {planetList('transit')}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
