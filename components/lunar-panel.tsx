'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  QUARTER_LIST_SIZE,
  compassPoint,
  lunarMonth,
  monthForTime,
  moonMomentAt,
  moonObservingWindow,
  moonQuarters,
  rightAscensionLabel,
  shiftMonth,
  type LunarDay,
  type LunarMonth,
  type MoonMoment,
  type MoonQuarterEvent,
  type ObservingWindow,
} from '../lib/lunar-phase';
import { localDayForTime, type SkyLocation } from '../lib/sky-events';
import ConceptHint from './concept-hint';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import MoonPhaseDisc from './moon-phase-disc';

type Tab = 'now' | 'quarters' | 'calendar';
/** The moment and place the open panel answers; the clock keeps running behind it. */
type Anchor = { time: number; place: SkyLocation; month: string };

/**
 * The Moon's phase, its principal phase times and a month of daily readings,
 * opened from the observatory's own controls rather than from the Moon's
 * information panel: the figures are about the sky tonight, not about the body,
 * and one body's panel growing three times taller than every other body's is
 * not where a reader looks for them.
 */
export default function LunarPanel({
  open,
  onOpenChange,
  time,
  location,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  time: number;
  location: SkyLocation;
}) {
  const { t, locale } = useI18n();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [count, setCount] = useState(QUARTER_LIST_SIZE);
  const [tab, setTab] = useState<Tab>('now');
  // The list is a snapshot of the moment the panel opened: recalculating it
  // against the running clock would rewrite the answer under the reader. It is
  // deferred through a microtask, which is what the compiler lint rule asks of
  // an effect that seeds state.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const start = monthForTime(time, location.utcOffset);
      setAnchor({ time, place: location, month: start });
      setMonth(start);
      setCount(QUARTER_LIST_SIZE);
    });
    // The opening moment and place are deliberately a snapshot; see above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const quarters = useMemo<MoonQuarterEvent[]>(() => {
    if (!anchor) return [];
    try {
      return moonQuarters(anchor.time, count);
    } catch {
      return [];
    }
  }, [anchor, count]);
  // The moment's own readout is a few milliseconds of Astronomy Engine, and it
  // answers the anchored moment rather than the running clock, like both lists.
  const moment = useMemo<{
    phase: MoonMoment;
    window: ObservingWindow;
  } | null>(() => {
    if (!anchor) return null;
    try {
      return {
        phase: moonMomentAt(anchor.time, anchor.place),
        window: moonObservingWindow(anchor.time, anchor.place),
      };
    } catch {
      return null;
    }
  }, [anchor]);
  const calendar = useMemo<LunarMonth | null>(() => {
    if (!anchor || !month) return null;
    try {
      return lunarMonth({ ...anchor.place, month });
    } catch {
      return null;
    }
  }, [anchor, month]);
  const place = anchor?.place ?? location;
  const offset = place.utcOffset * 3600000;
  const format = (ms: number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, {
      ...options,
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms);
  // Every local reading is printed by shifting the instant into the fixed
  // offset and formatting it as UTC. Only the UTC column skips that shift: a
  // bare `format` of local noon is already on another date wherever the offset
  // passes twelve hours, which the observation point is allowed to do.
  const local = (ms: number, options: Intl.DateTimeFormatOptions) =>
    format(ms + offset, options);
  const localStamp = (ms: number) =>
    local(ms, { dateStyle: 'medium', timeStyle: 'short' });
  const utcStamp = (ms: number) =>
    format(ms, { dateStyle: 'medium', timeStyle: 'short' });
  const clock = (ms: number | null) =>
    ms === null ? '—' : local(ms, { timeStyle: 'short' });
  const number = (value: number, digits = 1) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const offsetLabel = `${place.utcOffset >= 0 ? '+' : ''}${place.utcOffset}`;
  const today = anchor ? localDayForTime(anchor.time, place.utcOffset) : '';

  const fact = (label: string, value: string, unit?: string) => (
    <div key={label}>
      <span>{t(label)}</span>
      <strong>
        {value} {unit && <small>{unit}</small>}
      </strong>
    </div>
  );
  const span = (from: number, to: number) =>
    `${clock(from)} \u2013 ${clock(to)}`;
  const nowTab = moment && (
    <>
      <div className="moon-phase-hero">
        <MoonPhaseDisc
          elongation={moment.phase.elongation}
          flip={place.latitude < 0}
          size={96}
        />
        <div className="moon-phase-summary">
          <strong>{t(moment.phase.phase)}</strong>
          <p>
            {t('照明 {{percent}}% · 月龄 {{age}} 天', {
              percent: number(moment.phase.illumination * 100),
              age: number(moment.phase.age),
            })}
          </p>
          <p className="little-note">
            {t('本轮朔望月 {{length}} 天', {
              length: number(moment.phase.lunation, 2),
            })}
          </p>
        </div>
      </div>
      <div className="facts moon-phase-facts">
        {/* Two different angles, each under its own name: the elongation is
            what the phase name and the drawn disc follow, while the phase
            angle is the one measured at the Moon. */}
        {fact('日月黄经差', `${number(moment.phase.elongation)}\u00b0`)}
        {fact('相位角', `${number(moment.phase.phaseAngle)}\u00b0`)}
        {fact(
          '地月距离',
          Math.round(moment.phase.distanceKm).toLocaleString(locale),
          'km',
        )}
        {fact('视直径', `${number(moment.phase.apparentDiameter, 2)}\u2032`)}
        {fact(
          '高度角',
          `${number(moment.phase.altitude)}\u00b0`,
          t(moment.phase.altitude > 0 ? '地平线上方' : '地平线下方'),
        )}
        {fact(
          '方位角',
          `${number(moment.phase.azimuth)}\u00b0`,
          t(compassPoint(moment.phase.azimuth)),
        )}
        {fact('赤经', rightAscensionLabel(moment.phase.ra))}
        {fact('赤纬', `${number(moment.phase.dec)}\u00b0`)}
      </div>
      <div className="moon-window">
        <span className="concept-heading">
          {t('今晚观月窗口')}
          <ConceptHint
            label={t(
              '取当前所在或即将到来的一夜，从日落到次日日出之间月亮位于地平线以上的时段；天文暗夜指太阳低于地平线 18\u00b0 的时间。不考虑地形、建筑和天气。',
            )}
          />
        </span>
        {moment.window.start !== null && moment.window.end !== null ? (
          <>
            <strong>{span(moment.window.start, moment.window.end)}</strong>
            {moment.window.best && (
              <p>
                {t(
                  '最高在 {{time}}，高度 {{altitude}}\u00b0（{{direction}}）',
                  {
                    time: clock(moment.window.best.time),
                    altitude: number(moment.window.best.altitude),
                    direction: t(compassPoint(moment.window.best.azimuth)),
                  },
                )}
              </p>
            )}
            {moment.window.darkStart !== null &&
              moment.window.darkEnd !== null && (
                <p>
                  {t('天文暗夜 {{span}}', {
                    span: span(moment.window.darkStart, moment.window.darkEnd),
                  })}
                </p>
              )}
          </>
        ) : (
          <strong>{t('今夜无观月窗口')}</strong>
        )}
        {moment.window.note && (
          <p className="little-note">{t(moment.window.note)}</p>
        )}
      </div>
    </>
  );

  const quarterTable = (
    <table className="sky-table quarter-table">
      <caption className="sr-only">
        {t('四大月相的精确时刻，当地时间与 UTC 并列。')}
      </caption>
      <thead>
        <tr>
          <th scope="col">{t('月相名称')}</th>
          <th scope="col">
            {t('当地时间')} (UTC{offsetLabel})
          </th>
          <th scope="col">UTC</th>
        </tr>
      </thead>
      <tbody>
        {quarters.map((event) => (
          <tr key={event.time}>
            <th scope="row">
              <span className="quarter-name">
                <MoonPhaseDisc
                  elongation={event.quarter * 90}
                  flip={place.latitude < 0}
                  size={22}
                />
                {t(event.name)}
              </span>
            </th>
            <td>{localStamp(event.time)}</td>
            <td>{utcStamp(event.time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const dayRow = (day: LunarDay) => (
    <tr key={day.day} className={day.day === today ? 'is-today' : undefined}>
      <th scope="row">
        <span className="calendar-day">
          <MoonPhaseDisc
            elongation={day.elongation}
            flip={place.latitude < 0}
            size={20}
          />
          {local(day.noon, { day: 'numeric', weekday: 'short' })}
        </span>
      </th>
      {/* The badges qualify the phase, and the date column stays narrow enough
          to stay pinned while the rest of the row scrolls. The neighbouring day
          can carry the same name, so the badge gives the exact moment rather
          than repeating it. */}
      <td>
        {t(day.phase)}
        {day.quarter && (
          <span className="sky-event-tag">
            {t('精确时刻 {{time}}', { time: clock(day.quarter.time) })}
          </span>
        )}
        {day.eclipse && (
          <span className="sky-event-tag eclipse-tag">
            {t(day.eclipse.kind)}
          </span>
        )}
      </td>
      <td>{number(day.age)}</td>
      <td>{number(day.illumination * 100)}%</td>
      <td>{clock(day.rise)}</td>
      <td>{clock(day.transit?.time ?? null)}</td>
      <td>{clock(day.set)}</td>
      <td>
        {day.transit
          ? `${number(day.transit.altitude)}° ${t(compassPoint(day.transit.azimuth))}`
          : '—'}
      </td>
      <td>{Math.round(day.distanceKm).toLocaleString(locale)}</td>
      <td>{number(day.apparentDiameter, 2)}′</td>
      <td>
        {rightAscensionLabel(day.ra)} / {number(day.dec)}°
      </td>
    </tr>
  );

  const eclipses = calendar?.days.filter((day) => day.eclipse) ?? [];
  const calendarTable = calendar && (
    <>
      <div className="calendar-nav">
        <button
          className="icon-button"
          aria-label={t('上一个月')}
          title={t('上一个月')}
          disabled={!calendar.previous}
          onClick={() => setMonth(shiftMonth(calendar.month, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        {/* The heading names the month key itself, not an instant, so it is
            read from the middle of the month and left unshifted. */}
        <strong>
          {format(Date.parse(`${calendar.month}-15T00:00:00Z`), {
            year: 'numeric',
            month: 'long',
          })}
        </strong>
        <button
          className="icon-button"
          aria-label={t('下一个月')}
          title={t('下一个月')}
          disabled={!calendar.next}
          onClick={() => setMonth(shiftMonth(calendar.month, 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="sky-table-scroll">
        <table className="sky-table calendar-table">
          <caption className="sr-only">
            {t('每日月相、月出月落与月球位置，均为观测地点的当地时间。')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('日期')}</th>
              <th scope="col">{t('月相名称')}</th>
              <th scope="col">{t('月龄')}</th>
              <th scope="col">{t('照明')}</th>
              <th scope="col">{t('月出')}</th>
              <th scope="col">{t('中天')}</th>
              <th scope="col">{t('月落')}</th>
              <th scope="col">{t('中天高度')}</th>
              <th scope="col">
                {t('地月距离')} <small>km</small>
              </th>
              <th scope="col">{t('视直径')}</th>
              <th scope="col">{t('赤经 / 赤纬')}</th>
            </tr>
          </thead>
          <tbody>{calendar.days.map(dayRow)}</tbody>
        </table>
      </div>
      {eclipses.length > 0 && (
        <div className="sky-results calendar-eclipses">
          {eclipses.map((day) => (
            <article className="sky-event" key={day.day}>
              <div className="sky-event-heading">
                <h3>{t(day.eclipse!.kind)}</h3>
                <span className="sky-event-tag eclipse-tag">
                  {t('本月月食')}
                </span>
              </div>
              <strong>{localStamp(day.eclipse!.peak)}</strong>
              <p>{t('食甚时间')}</p>
              {!!day.eclipse!.obscuration && (
                <p>
                  {t('食甚遮掩月面约 {{percent}}%', {
                    percent: (day.eclipse!.obscuration * 100).toFixed(1),
                  })}
                </p>
              )}
              <p>
                {t(
                  '此地点食甚时月亮在{{horizon}}（{{altitude}}°）；其他阶段是否可见需另看月出月落。',
                  {
                    horizon: t(
                      day.eclipse!.altitude > 0 ? '地平线上方' : '地平线下方',
                    ),
                    altitude: day.eclipse!.altitude.toFixed(1),
                  },
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );

  const notes = (
    <>
      <p className="little-note">
        {t('观测点：{{latitude}}°，{{longitude}}° · UTC{{offset}}', {
          latitude: place.latitude.toFixed(4),
          longitude: place.longitude.toFixed(4),
          offset: offsetLabel,
        })}
        {t('，可在地球的天体信息中调整。')}
      </p>
      <p className="little-note">
        {t('月相与位置由')}{' '}
        <a
          href="https://github.com/cosinekitty/astronomy"
          target="_blank"
          rel="noreferrer"
        >
          Astronomy Engine
        </a>{' '}
        {t(
          '独立计算。地月距离与视直径为地心值，赤经赤纬、高度角与中天高度为观测点的视位置，不考虑地形、建筑和天气。',
        )}
      </p>
    </>
  );
  // What is true of a table of days is not true of a single moment, so the
  // caveat about local noon and skipped events rides with the calendar alone.
  const calendarNote = (
    <p className="little-note">
      {t(
        '每行的月龄、照明、距离、视直径与赤经赤纬取当地正午的瞬时值；月出、中天与月落是当日事件，月亮每天晚升约 50 分钟，因此某些日期本就没有其中之一，表中留空。',
      )}
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog astronomy-dialog lunar-dialog"
      >
        <DialogTitle>{t('月相与观月')}</DialogTitle>
        <DialogDescription>
          {anchor
            ? t('以 {{date}} 为准，均为观测地点的当地时间。', {
                date: localStamp(anchor.time),
              })
            : t('正在从当前模拟时间计算月相。')}
        </DialogDescription>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value) as Tab)}
          className="settings-tabs"
        >
          <TabsList className="settings-tabs-list" aria-label={t('月相分类')}>
            <TabsTrigger value="now">{t('当前月相')}</TabsTrigger>
            <TabsTrigger value="quarters">{t('四相时刻')}</TabsTrigger>
            <TabsTrigger value="calendar">{t('每日月历')}</TabsTrigger>
          </TabsList>
          <TabsContent value="now" className="settings-tab-panel">
            {nowTab ?? (
              <p className="little-note">{t('正在从当前模拟时间计算月相。')}</p>
            )}
            <p className="little-note">
              {t(
                '月面按日月黄经差实时绘制，取地心视角、天球北极朝上；南半球看到的月面左右相反，已按观测点纬度镜像。日月黄经差从朔起算（0\u00b0 朔、90\u00b0 上弦、180\u00b0 望、270\u00b0 下弦），决定月相名称与月面形状；相位角是在月球上看太阳与地球的夹角（望时接近 0\u00b0），两者相加约为 180\u00b0。月龄从上一次朔起算，视直径为地心值。',
              )}
            </p>
            {notes}
          </TabsContent>
          <TabsContent value="quarters" className="settings-tab-panel">
            {quarters.length === 0 ? (
              <p className="little-note">
                {t('在支持的日期范围内未找到下一次。')}
              </p>
            ) : (
              <>
                {quarterTable}
                {quarters.length === count ? (
                  <button
                    className="secondary-action load-more"
                    onClick={() => setCount(count + QUARTER_LIST_SIZE)}
                  >
                    {t('继续加载更多')}
                  </button>
                ) : (
                  <p className="little-note">
                    {t('已列出支持范围内（至 2200 年）的全部月相时刻。')}
                  </p>
                )}
              </>
            )}
            {notes}
          </TabsContent>
          <TabsContent value="calendar" className="settings-tab-panel">
            {calendarTable ?? (
              <p className="little-note">{t('正在从当前模拟时间计算月相。')}</p>
            )}
            {calendarNote}
            {notes}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
