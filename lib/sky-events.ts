import {
  Body,
  Observer,
  SearchRiseSet,
  SearchGlobalSolarEclipse,
  NextGlobalSolarEclipse,
  SearchLunarEclipse,
  NextLunarEclipse,
  SearchLocalSolarEclipse,
  NextLocalSolarEclipse,
  Equator,
  Horizon,
  type LocalSolarEclipseInfo,
} from 'astronomy-engine';
import { DAY_MS, MAX_TIME, validTime } from './simulation-time';

export type SkyLocation = {
  latitude: number;
  longitude: number;
  height: number;
  utcOffset: number;
};
// Where the observation point came from: only a chosen one is worth storing,
// and only a resolved one is worth calculating against.
export type ObserverLocationSource =
  | 'pending'
  | 'device'
  | 'manual'
  | 'fallback';
export type ChosenLocationSource = Extract<
  ObserverLocationSource,
  'device' | 'manual'
>;
export type DailySunQuery = SkyLocation & { day: string };
export type DailySunResults = {
  rise: number | null;
  set: number | null;
  daylight: string;
};

// Use a stable reference point until the user chooses a location in the
// observer settings. Browser geolocation is intentionally opt-in.
export const fallbackSkyLocation: SkyLocation = {
  latitude: 39.9042,
  longitude: 116.4074,
  height: 43,
  utcOffset: 8,
};
// One screen of upcoming events per kind keeps the panel instant to read and
// cheap enough to recalculate whenever the simulation clock is moved.
export const ECLIPSE_LIST_SIZE = 5;
/** What the observer sees, when this eclipse reaches their own horizon. */
export type LocalCircumstances = {
  kind: string;
  peak: number;
  begin: number;
  end: number;
  altitude: number;
  obscuration: number;
};
export type SkyEvent = {
  /** The eclipse's global classification. */
  kind: string;
  /** The global peak: for a solar eclipse, the axis' closest approach. */
  peak: number;
  /** A lunar eclipse's penumbral span. */
  begin?: number;
  end?: number;
  /** The Moon's altitude at peak, for a lunar eclipse. */
  altitude?: number;
  obscuration?: number;
  local?: LocalCircumstances;
};
export type EclipseQuery = SkyLocation & {
  start: number;
  count?: number;
  /**
   * A follow-up page continues a sequence the reader is already holding, so it
   * skips the hunt for the next locally visible eclipse: the first page either
   * found one or proved there is none, and repeating it would both cost the
   * long walk again and duplicate the entry.
   */
  page?: boolean;
};
export type EclipsePage = {
  events: SkyEvent[];
  /**
   * Where the following page starts, or null once the range is exhausted. It
   * is one tick past the last event listed, because a page includes an eclipse
   * that falls exactly on its start and would otherwise repeat it.
   */
  next: number | null;
};
export type EclipseList = { solar: EclipsePage; lunar: EclipsePage };
const kinds: Record<string, string> = {
  total: '全食',
  annular: '环食',
  partial: '偏食',
  penumbral: '半影食',
};
export function validateEclipseQuery(q: EclipseQuery) {
  if (!validTime(q.start)) throw new Error('请选择 1700—2200 年内的有效日期。');
  validateLocation(q);
}
function validateLocation(q: SkyLocation) {
  for (const [value, min, max] of [
    [q.latitude, -90, 90],
    [q.longitude, -180, 180],
    [q.height, -500, 10000],
    [q.utcOffset, -12, 14],
  ])
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error('请检查经纬度、海拔和 UTC 时差。');
}
function validateDay(day: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !validTime(Date.parse(day + 'T12:00:00Z')) ||
    new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) !== day
  )
    throw new Error('请选择 1700—2200 年内的有效日期。');
}
export function localDayForTime(time: number, utcOffset: number) {
  return new Date(time + utcOffset * 3600000).toISOString().slice(0, 10);
}
export function calculateDailySunEvents(q: DailySunQuery): DailySunResults {
  validateDay(q.day);
  validateLocation(q);
  const observer = new Observer(q.latitude, q.longitude, q.height);
  const midnight = Date.parse(q.day + 'T00:00:00Z') - q.utcOffset * 3600000;
  const daily = (direction: 1 | -1) => {
    const t = SearchRiseSet(
      Body.Sun,
      observer,
      direction,
      new Date(midnight),
      1,
    )?.date.getTime();
    return t !== undefined && t >= midnight && t < midnight + DAY_MS ? t : null;
  };
  const rise = daily(1),
    set = daily(-1);
  const daylight =
    rise === null && set === null
      ? altitude(Body.Sun, midnight + DAY_MS / 2, observer) > 0
        ? '极昼：全天太阳不落'
        : '极夜：全天太阳不升'
      : rise === null || set === null
        ? '当天仅有一次升落事件'
        : '按太阳上缘和标准大气折射计算';
  return { rise, set, daylight };
}
export function altitude(body: Body, ms: number, observer: Observer) {
  const date = new Date(ms),
    eq = Equator(body, date, observer, true, true);
  return Horizon(date, observer, eq.ra, eq.dec, 'normal').altitude;
}
function localSolarVisible(e: LocalSolarEclipseInfo, observer: Observer) {
  if ([e.partial_begin, e.peak, e.partial_end].some((x) => x.altitude > 0))
    return true;
  const start = e.partial_begin.time.date.getTime(),
    end = e.partial_end.time.date.getTime();
  const rise = SearchRiseSet(
    Body.Sun,
    observer,
    1,
    new Date(start),
    (end - start) / DAY_MS,
  );
  return !!rise && rise.date.getTime() < end;
}
function localCircumstances(e: LocalSolarEclipseInfo): LocalCircumstances {
  return {
    kind: '日' + kinds[e.kind],
    peak: e.peak.time.date.getTime(),
    begin: e.partial_begin.time.date.getTime(),
    end: e.partial_end.time.date.getTime(),
    altitude: e.peak.altitude,
    obscuration: e.obscuration,
  };
}
// The global and local searches skip different eclipses, so they are walked as
// two ordered series: a global entry is annotated when the local cursor lands on
// the same peak. Half a day of tolerance covers the two searches' own precision
// without ever reaching a neighbouring new moon.
const PEAK_TOLERANCE = DAY_MS / 2;
export function calculateEclipseList(q: EclipseQuery): EclipseList {
  validateEclipseQuery(q);
  const count = q.count ?? ECLIPSE_LIST_SIZE;
  const observer = new Observer(q.latitude, q.longitude, q.height);
  const within = (ms: number) => ms >= q.start && ms <= MAX_TIME;
  let local: LocalSolarEclipseInfo | null = SearchLocalSolarEclipse(
    new Date(q.start),
    observer,
  );
  const nextVisibleLocal = () => {
    while (local && local.peak.time.date.getTime() <= MAX_TIME) {
      if (localSolarVisible(local, observer)) return local;
      local = NextLocalSolarEclipse(local.peak.time, observer);
    }
    local = null;
    return null;
  };
  const solar: SkyEvent[] = [];
  let global = SearchGlobalSolarEclipse(new Date(q.start));
  while (solar.length < count && global.peak.date.getTime() <= MAX_TIME) {
    const peak = global.peak.date.getTime();
    // Each search begins at a new moon, so it can land back on the eclipse the
    // cursor has just passed. That one is stepped over, not read as the end of
    // the series, or every following page would come back empty.
    if (peak >= q.start) {
      // Advance past local eclipses the global series has already left behind.
      while (local && local.peak.time.date.getTime() < peak - PEAK_TOLERANCE)
        local = NextLocalSolarEclipse(local.peak.time, observer);
      const here =
        local &&
        Math.abs(local.peak.time.date.getTime() - peak) < PEAK_TOLERANCE
          ? local
          : null;
      solar.push({
        kind: '日' + kinds[global.kind],
        peak,
        ...(here && localSolarVisible(here, observer)
          ? { local: localCircumstances(here) }
          : {}),
      });
    }
    global = NextGlobalSolarEclipse(global.peak);
  }
  // The cursor follows the global run alone. An appended visible eclipse sits
  // beyond it, and continuing from there would skip everything in between.
  const solarNext =
    solar.length === count && global.peak.date.getTime() <= MAX_TIME
      ? solar.at(-1)!.peak + 1
      : null;
  // A locally visible eclipse can be decades beyond the listed ones, so it is
  // appended rather than left out; the list stays in chronological order. Its
  // own global entry is looked up directly instead of walking there one new
  // moon at a time.
  if (!q.page && !solar.some((event) => event.local)) {
    const visible = nextVisibleLocal();
    const peak = visible?.peak.time.date.getTime();
    if (visible && peak !== undefined && within(peak)) {
      const counterpart = SearchGlobalSolarEclipse(new Date(peak - DAY_MS));
      solar.push({
        kind: '日' + kinds[counterpart.kind],
        peak: counterpart.peak.date.getTime(),
        local: localCircumstances(visible),
      });
    }
  }
  const lunar: SkyEvent[] = [];
  let moon = SearchLunarEclipse(new Date(q.start));
  while (lunar.length < count && moon.peak.date.getTime() <= MAX_TIME) {
    const peak = moon.peak.date.getTime();
    if (peak >= q.start)
      lunar.push({
        kind: '月' + kinds[moon.kind],
        peak,
        begin: peak - moon.sd_penum * 60000,
        end: peak + moon.sd_penum * 60000,
        altitude: altitude(Body.Moon, peak, observer),
        obscuration: moon.obscuration,
      });
    moon = NextLunarEclipse(moon.peak);
  }
  const lunarNext =
    lunar.length === count && moon.peak.date.getTime() <= MAX_TIME
      ? lunar.at(-1)!.peak + 1
      : null;
  return {
    solar: { events: solar, next: solarNext },
    lunar: { events: lunar, next: lunarNext },
  };
}

/**
 * Join a freshly loaded page onto the list already on screen. The previewed
 * visible eclipse sits ahead of the run, so paging eventually reaches that same
 * eclipse from the other direction; entries closer together than any two real
 * eclipses can be are therefore one, and the earlier copy wins.
 */
export function mergeEvents(current: SkyEvent[], incoming: SkyEvent[]) {
  const all = [...current, ...incoming].sort((a, b) => a.peak - b.peak);
  return all.filter(
    (event, index) =>
      index === 0 || event.peak - all[index - 1].peak > PEAK_TOLERANCE,
  );
}
