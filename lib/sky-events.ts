import {
  Body,
  Observer,
  SearchRiseSet,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchLocalSolarEclipse,
  NextLocalSolarEclipse,
  Equator,
  Horizon,
  type LocalSolarEclipseInfo,
} from 'astronomy-engine';
import { DAY_MS, MAX_TIME, validTime } from './simulation-time';

export type SkyQuery = {
  start: number;
  day: string;
  latitude: number;
  longitude: number;
  height: number;
  utcOffset: number;
};
export type SkyEvent = {
  kind: string;
  peak: number;
  begin?: number;
  end?: number;
  altitude?: number;
  obscuration?: number;
};
export type SkyResults = {
  rise: number | null;
  set: number | null;
  daylight: string;
  solar: SkyEvent | null;
  lunar: SkyEvent | null;
  localSolar: SkyEvent | null;
};
const kinds: Record<string, string> = {
  total: '全食',
  annular: '环食',
  partial: '偏食',
  penumbral: '半影食',
};
export function validateQuery(q: SkyQuery) {
  if (
    !validTime(q.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(q.day) ||
    !validTime(Date.parse(q.day + 'T12:00:00Z')) ||
    new Date(q.day + 'T12:00:00Z').toISOString().slice(0, 10) !== q.day
  )
    throw new Error('请选择 1700—2200 年内的有效日期。');
  for (const [value, min, max] of [
    [q.latitude, -90, 90],
    [q.longitude, -180, 180],
    [q.height, -500, 10000],
    [q.utcOffset, -12, 14],
  ])
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error('请检查经纬度、海拔和 UTC 时差。');
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
export function calculateSkyEvents(q: SkyQuery): SkyResults {
  validateQuery(q);
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
  const solar = SearchGlobalSolarEclipse(new Date(q.start));
  const lunar = SearchLunarEclipse(new Date(q.start));
  let local = SearchLocalSolarEclipse(new Date(q.start), observer);
  while (
    local.peak.time.date.getTime() <= MAX_TIME &&
    !localSolarVisible(local, observer)
  )
    local = NextLocalSolarEclipse(local.peak.time, observer);
  const within = (ms: number) => ms >= q.start && ms <= MAX_TIME;
  return {
    rise,
    set,
    daylight,
    solar: within(solar.peak.date.getTime())
      ? { kind: '日' + kinds[solar.kind], peak: solar.peak.date.getTime() }
      : null,
    lunar: within(lunar.peak.date.getTime())
      ? {
          kind: '月' + kinds[lunar.kind],
          peak: lunar.peak.date.getTime(),
          begin: lunar.peak.date.getTime() - lunar.sd_penum * 60000,
          end: lunar.peak.date.getTime() + lunar.sd_penum * 60000,
          altitude: altitude(Body.Moon, lunar.peak.date.getTime(), observer),
        }
      : null,
    localSolar: within(local.peak.time.date.getTime())
      ? {
          kind: '日' + kinds[local.kind],
          peak: local.peak.time.date.getTime(),
          begin: local.partial_begin.time.date.getTime(),
          end: local.partial_end.time.date.getTime(),
          altitude: local.peak.altitude,
          obscuration: local.obscuration,
        }
      : null,
  };
}
