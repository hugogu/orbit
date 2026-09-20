'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/provider';
import {
  QUARTER_LIST_SIZE,
  compassPoint,
  lunarMonth,
  monthForTime,
  moonQuarters,
  rightAscensionLabel,
  shiftMonth,
  type LunarDay,
  type LunarMonth,
  type MoonQuarterEvent,
} from '../lib/lunar-phase';
import { localDayForTime, type SkyLocation } from '../lib/sky-events';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import MoonPhaseDisc from './moon-phase-disc';

type Tab = 'quarters' | 'calendar';
/** The moment and place the open panel answers; the clock keeps running behind it. */
type Anchor = { time: number; place: SkyLocation; month: string };

export default function LunarCalendar({
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
  const [tab, setTab] = useState<Tab>('quarters');
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
  const localStamp = (ms: number) =>
    format(ms + offset, { dateStyle: 'medium', timeStyle: 'short' });
  const utcStamp = (ms: number) =>
    format(ms, { dateStyle: 'medium', timeStyle: 'short' });
  const clock = (ms: number | null) =>
    ms === null ? '—' : format(ms + offset, { timeStyle: 'short' });
  const number = (value: number, digits = 1) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const offsetLabel = `${place.utcOffset >= 0 ? '+' : ''}${place.utcOffset}`;
  const today = anchor ? localDayForTime(anchor.time, place.utcOffset) : '';

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
          {format(day.noon, { day: 'numeric', weekday: 'short' })}
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
          '独立计算。每行的月龄、照明、距离、视直径与赤经赤纬取当地正午的瞬时值；月出、中天与月落是当日事件，月亮每天晚升约 50 分钟，因此某些日期本就没有其中之一，表中留空。地月距离与视直径为地心值，赤经赤纬与中天高度为观测点的视位置，不考虑地形、建筑和天气。',
        )}
      </p>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog astronomy-dialog lunar-dialog"
      >
        <DialogTitle>{t('月相日历')}</DialogTitle>
        <DialogDescription>
          {anchor
            ? t('从 {{date}} 起的月相，均为观测地点的当地时间。', {
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
            <TabsTrigger value="quarters">{t('四相时刻')}</TabsTrigger>
            <TabsTrigger value="calendar">{t('每日月历')}</TabsTrigger>
          </TabsList>
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
            {notes}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
