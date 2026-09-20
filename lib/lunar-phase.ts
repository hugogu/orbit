/**
 * Computed lunar phase, almanac and observing figures for the Moon.
 *
 * Everything here is calculated by Astronomy Engine from the simulation clock
 * and the observation point; nothing is tabulated. The editorial explanation of
 * what a phase *is* lives in `lib/event-guide.ts`, and eclipse circumstances
 * stay in `lib/sky-events.ts` — this module only marks the days they fall on.
 *
 * Text is written in the source language and translated at presentation time,
 * like every other catalog in `lib/`.
 */
import {
  Body,
  Equator,
  Horizon,
  Illumination,
  KM_PER_AU,
  MoonPhase,
  NextLunarEclipse,
  NextMoonQuarter,
  Observer,
  SearchAltitude,
  SearchHourAngle,
  SearchLunarEclipse,
  SearchMoonPhase,
  SearchMoonQuarter,
  SearchRiseSet,
} from 'astronomy-engine';
import { DAY_MS, MAX_TIME, MIN_TIME, validTime } from './simulation-time';
import { moonRadii } from './eclipse-shadows';
import {
  altitude,
  eclipseKinds,
  localDayForTime,
  validateLocation,
  type SkyLocation,
} from './sky-events';

const MOON_RADIUS_KM = moonRadii.Moon;
/** Longer than any synodic month (29.27–29.83 days), so a search cannot miss one. */
const LUNATION_LIMIT = 40;
/** Astronomical twilight: the Sun 18° below the horizon, by convention unrefracted. */
const DARKNESS_ALTITUDE = -18;
/** One screen of principal phases: three lunations, the span a planner reads. */
export const QUARTER_LIST_SIZE = 12;

/** The eight conventional phase names, in the order a lunation runs through them. */
export const phaseNames = [
  '新月',
  '蛾眉月',
  '上弦月',
  '盈凸月',
  '满月',
  '亏凸月',
  '下弦月',
  '残月',
] as const;
/** The four principal phases, in the order Astronomy Engine numbers them. */
export const quarterNames = ['新月', '上弦月', '满月', '下弦月'] as const;
/** Why an observing window is qualified, or why there is none. */
export const observingNotes = {
  polarDay: '极昼：这几天太阳整日不落，没有夜间观月窗口。',
  polarNight: '极夜：太阳整日不升，窗口按整日的月出月落给出。',
  noDarkness: '此地当夜没有天文暗夜，太阳始终高于地平线下 18°。',
  belowHorizon: '今夜月亮始终在地平线下，要到白天才升起。',
} as const;

/** Compass points, so an azimuth carries a direction beside its number. */
export const compassPoints = [
  '北',
  '东北',
  '东',
  '东南',
  '南',
  '西南',
  '西',
  '西北',
] as const;

/** How near a principal phase still carries its name: about half a day either side. */
const PRINCIPAL_WINDOW = 7.5;
/**
 * Name a phase from the Sun–Moon elongation.
 *
 * The four principal phases are instants, so their names are kept for the days
 * around them and the rest of the lunation is a crescent or a gibbous Moon.
 * Drawing that line at the quarters rather than at 45° sectors is what keeps
 * the name from contradicting the illuminated fraction printed beside it: a
 * crescent is always less than half lit, a gibbous Moon always more.
 */
export function phaseName(elongation: number) {
  const angle = ((elongation % 360) + 360) % 360;
  const nearest = Math.round(angle / 90) % 4;
  const offset = Math.abs(((angle - nearest * 90 + 540) % 360) - 180);
  if (offset <= PRINCIPAL_WINDOW) return phaseNames[nearest * 2];
  return angle < 90
    ? phaseNames[1]
    : angle < 180
      ? phaseNames[3]
      : angle < 270
        ? phaseNames[5]
        : phaseNames[7];
}
/** The compass point nearest an azimuth measured clockwise from north. */
export function compassPoint(azimuth: number) {
  const sector = (((azimuth % 360) + 360) % 360) / 45;
  return compassPoints[Math.round(sector) % 8];
}
/** Right ascension reads in hours and minutes, the way a catalog prints it. */
export function rightAscensionLabel(hours: number) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 60
    ? `${(whole + 1) % 24}h00m`
    : `${whole}h${String(minutes).padStart(2, '0')}m`;
}

export type MoonMoment = {
  time: number;
  /** Geocentric elongation from the Sun: 0 new, 90 first quarter, 180 full, 270 last. */
  elongation: number;
  /** The Sun–Moon–Earth angle, 0° at full moon: what actually shades the disc. */
  phaseAngle: number;
  /** Illuminated fraction of the disc, 0–1. */
  illumination: number;
  /** Days since the new moon that opened this lunation. */
  age: number;
  /** The length of that lunation, in days. */
  lunation: number;
  phase: string;
  waxing: boolean;
  /** Centre-to-centre distance from the Earth. */
  distanceKm: number;
  /** Geocentric apparent diameter, in arcminutes. */
  apparentDiameter: number;
  /** Topocentric apparent coordinates, the pair the altitude and azimuth follow. */
  ra: number;
  dec: number;
  altitude: number;
  azimuth: number;
};

function observerFor(place: SkyLocation) {
  validateLocation(place);
  return new Observer(place.latitude, place.longitude, place.height);
}
/** Arcminutes subtended by the lunar disc at this distance. */
function apparentDiameter(distanceKm: number) {
  return (2 * Math.atan(MOON_RADIUS_KM / distanceKm) * 180 * 60) / Math.PI;
}
/**
 * The lunation containing this moment. A backward search answers with the new
 * moon that opened it and a forward one with the moon that closes it, so the
 * age and the month's own length come from the same pair.
 */
function lunationAt(time: number) {
  const opened = SearchMoonPhase(0, new Date(time), -LUNATION_LIMIT);
  const closes = SearchMoonPhase(0, new Date(time), LUNATION_LIMIT);
  if (!opened || !closes) return { age: Number.NaN, lunation: Number.NaN };
  const start = opened.date.getTime();
  return {
    age: (time - start) / DAY_MS,
    lunation: (closes.date.getTime() - start) / DAY_MS,
  };
}

/** Everything the phase panel shows for one instant. */
export function moonMomentAt(time: number, place: SkyLocation): MoonMoment {
  if (!validTime(time)) throw new Error('请选择 1700—2200 年内的有效日期。');
  const observer = observerFor(place);
  const date = new Date(time);
  const illumination = Illumination(Body.Moon, date);
  const elongation = MoonPhase(date);
  const distanceKm = illumination.geo_dist * KM_PER_AU;
  const equator = Equator(Body.Moon, date, observer, true, true);
  const horizon = Horizon(date, observer, equator.ra, equator.dec, 'normal');
  return {
    time,
    elongation,
    phaseAngle: illumination.phase_angle,
    illumination: illumination.phase_fraction,
    ...lunationAt(time),
    phase: phaseName(elongation),
    waxing: elongation < 180,
    distanceKm,
    apparentDiameter: apparentDiameter(distanceKm),
    ra: equator.ra,
    dec: equator.dec,
    altitude: horizon.altitude,
    azimuth: horizon.azimuth,
  };
}

export type MoonQuarterEvent = {
  /** 0 new moon, 1 first quarter, 2 full moon, 3 last quarter. */
  quarter: number;
  name: string;
  time: number;
};
/**
 * The principal phases from a moment onward. The series is walked rather than
 * stepped by a mean month, so it never drifts across the range.
 */
export function moonQuarters(
  start: number,
  count = QUARTER_LIST_SIZE,
): MoonQuarterEvent[] {
  if (!validTime(start)) throw new Error('请选择 1700—2200 年内的有效日期。');
  const events: MoonQuarterEvent[] = [];
  let quarter = SearchMoonQuarter(new Date(start));
  while (events.length < count && quarter.time.date.getTime() <= MAX_TIME) {
    events.push({
      quarter: quarter.quarter,
      name: quarterNames[quarter.quarter],
      time: quarter.time.date.getTime(),
    });
    quarter = NextMoonQuarter(quarter);
  }
  return events;
}

export type ObservingWindow = {
  /** The night this answers: sunset to the following sunrise. */
  nightStart: number;
  nightEnd: number;
  /** Astronomical darkness inside that night, where the Sun reaches −18°. */
  darkStart: number | null;
  darkEnd: number | null;
  /** When the Moon is above the horizon during that night, if it ever is. */
  start: number | null;
  end: number | null;
  /** The Moon at its highest inside that window. */
  best: { time: number; altitude: number; azimuth: number } | null;
  /** Illuminated fraction and phase at the best moment. */
  illumination: number;
  phase: string;
  /** What qualifies the window, or why there is none. */
  note: string;
};

/** The night in progress, or the next one; null where the Sun does not set. */
function nightAround(time: number, observer: Observer) {
  const sunUp = altitude(Body.Sun, time, observer) > 0;
  const opening = SearchRiseSet(
    Body.Sun,
    observer,
    -1,
    new Date(time),
    // Under way, the night opened at the sunset behind us; in daylight it opens
    // at the one ahead.
    sunUp ? 2 : -2,
  );
  // Only daylight with no sunset ahead is a polar day. A night already under
  // way with no sunset behind it is a polar night, which simply started before
  // the search window: it opens here instead.
  if (!opening && sunUp) return null;
  const start = opening ? opening.date.getTime() : time;
  const closing = SearchRiseSet(Body.Sun, observer, 1, new Date(start), 2);
  // The Sun staying down caps the night at a full day rather than inventing a
  // sunrise for it.
  return {
    start,
    end: closing ? closing.date.getTime() : start + DAY_MS,
    polar: !closing,
  };
}

/**
 * When to look tonight: the stretch of the coming night — or the one already
 * under way — with the Moon above the horizon, and the astronomical darkness
 * inside it.
 */
export function moonObservingWindow(
  time: number,
  place: SkyLocation,
): ObservingWindow {
  if (!validTime(time)) throw new Error('请选择 1700—2200 年内的有效日期。');
  const observer = observerFor(place);
  const night = nightAround(time, observer);
  if (!night)
    return {
      nightStart: time,
      nightEnd: time,
      darkStart: null,
      darkEnd: null,
      start: null,
      end: null,
      best: null,
      illumination: Illumination(Body.Moon, new Date(time)).phase_fraction,
      phase: phaseName(MoonPhase(new Date(time))),
      note: observingNotes.polarDay,
    };
  const { start: nightStart, end: nightEnd } = night;
  const span = (from: number) => Math.max((nightEnd - from) / DAY_MS, 1 / 1440);
  const dusk = SearchAltitude(
    Body.Sun,
    observer,
    -1,
    new Date(nightStart),
    span(nightStart),
    DARKNESS_ALTITUDE,
  )?.date.getTime();
  const dawn =
    dusk === undefined
      ? undefined
      : SearchAltitude(
          Body.Sun,
          observer,
          1,
          new Date(dusk),
          span(dusk),
          DARKNESS_ALTITUDE,
        )?.date.getTime();
  // The Moon is either already up when the Sun goes down, or it rises later.
  const upAtDusk = altitude(Body.Moon, nightStart, observer) > 0;
  const rising = upAtDusk
    ? nightStart
    : SearchRiseSet(
        Body.Moon,
        observer,
        1,
        new Date(nightStart),
        span(nightStart),
      )?.date.getTime();
  const start = rising !== undefined && rising <= nightEnd ? rising : null;
  let end: number | null = null;
  let best: ObservingWindow['best'] = null;
  if (start !== null) {
    const setting = SearchRiseSet(
      Body.Moon,
      observer,
      -1,
      new Date(start),
      span(start),
    )?.date.getTime();
    end = setting !== undefined && setting < nightEnd ? setting : nightEnd;
    best = highestBetween(start, end, observer);
  }
  const moment = best?.time ?? start ?? time;
  return {
    nightStart,
    nightEnd,
    darkStart: dusk ?? null,
    darkEnd: dawn ?? null,
    start,
    end,
    best,
    illumination: Illumination(Body.Moon, new Date(moment)).phase_fraction,
    phase: phaseName(MoonPhase(new Date(moment))),
    note:
      start === null
        ? observingNotes.belowHorizon
        : night.polar
          ? observingNotes.polarNight
          : dusk === undefined
            ? observingNotes.noDarkness
            : '',
  };
}

/** The Moon's highest point inside a span: its culmination, or the better edge. */
function highestBetween(start: number, end: number, observer: Observer) {
  const culmination = SearchHourAngle(
    Body.Moon,
    observer,
    0,
    new Date(start),
    1,
  );
  const peak = culmination.time.date.getTime();
  if (peak >= start && peak <= end)
    return {
      time: peak,
      altitude: culmination.hor.altitude,
      azimuth: culmination.hor.azimuth,
    };
  const edges = [start, end].map((time) => {
    const equator = Equator(Body.Moon, new Date(time), observer, true, true);
    const horizon = Horizon(
      new Date(time),
      observer,
      equator.ra,
      equator.dec,
      'normal',
    );
    return { time, altitude: horizon.altitude, azimuth: horizon.azimuth };
  });
  return edges[0].altitude >= edges[1].altitude ? edges[0] : edges[1];
}

export type LunarDay = {
  /** Local calendar date, YYYY-MM-DD. */
  day: string;
  /** Local noon, the instant every instantaneous value in this row is taken at. */
  noon: number;
  age: number;
  illumination: number;
  elongation: number;
  phase: string;
  distanceKm: number;
  apparentDiameter: number;
  ra: number;
  dec: number;
  rise: number | null;
  set: number | null;
  transit: { time: number; altitude: number; azimuth: number } | null;
  /** A principal phase whose exact moment falls on this local day. */
  quarter?: MoonQuarterEvent;
  /** A lunar eclipse whose maximum falls on this local day. */
  eclipse?: {
    kind: string;
    peak: number;
    obscuration: number;
    altitude: number;
  };
};
export type LunarMonth = {
  month: string;
  days: LunarDay[];
  /** Whether a neighbouring month is still inside the supported range. */
  previous: string | null;
  next: string | null;
};
export type LunarMonthQuery = SkyLocation & { month: string };

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
export function validateMonth(month: string) {
  if (!MONTH_PATTERN.test(month) || !monthStartsIn(month))
    throw new Error('请选择 1700—2200 年内的有效月份。');
}
function monthStartsIn(month: string) {
  const start = Date.parse(`${month}-01T12:00:00Z`);
  return Number.isFinite(start) && start >= MIN_TIME && start <= MAX_TIME;
}
/** The local month a moment falls in, as YYYY-MM. */
export function monthForTime(time: number, utcOffset: number) {
  return localDayForTime(time, utcOffset).slice(0, 7);
}
/** Step a month key, or null once the neighbour leaves the supported range. */
export function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split('-').map(Number);
  const moved = new Date(Date.UTC(year, index - 1 + delta, 1, 12));
  const next = moved.toISOString().slice(0, 7);
  return monthStartsIn(next) ? next : null;
}

/**
 * One row per local day of a month. Instantaneous values are read at local
 * noon; rise, transit and set are the day's own events, and the Moon skips
 * some of them because it rises about fifty minutes later each day.
 */
export function lunarMonth(query: LunarMonthQuery): LunarMonth {
  validateMonth(query.month);
  const observer = observerFor(query);
  const [year, index] = query.month.split('-').map(Number);
  const count = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const first =
    Date.parse(`${query.month}-01T00:00:00Z`) - query.utcOffset * 3600000;
  const last = first + count * DAY_MS;
  const quarters = new Map<string, MoonQuarterEvent>();
  let quarter = SearchMoonQuarter(new Date(first - 1));
  while (quarter.time.date.getTime() < last) {
    const time = quarter.time.date.getTime();
    quarters.set(localDayForTime(time, query.utcOffset), {
      quarter: quarter.quarter,
      name: quarterNames[quarter.quarter],
      time,
    });
    quarter = NextMoonQuarter(quarter);
  }
  const eclipses = new Map<string, LunarDay['eclipse']>();
  let eclipse = SearchLunarEclipse(new Date(first));
  while (eclipse.peak.date.getTime() < last) {
    const peak = eclipse.peak.date.getTime();
    eclipses.set(localDayForTime(peak, query.utcOffset), {
      kind: '月' + eclipseKinds[eclipse.kind],
      peak,
      obscuration: eclipse.obscuration,
      altitude: altitude(Body.Moon, peak, observer),
    });
    eclipse = NextLunarEclipse(eclipse.peak);
  }
  const days: LunarDay[] = [];
  for (let offset = 0; offset < count; offset++) {
    const midnight = first + offset * DAY_MS;
    const noon = midnight + DAY_MS / 2;
    const day = localDayForTime(midnight, query.utcOffset);
    const within = (time: number | undefined) =>
      time !== undefined && time >= midnight && time < midnight + DAY_MS
        ? time
        : null;
    const event = (direction: 1 | -1) =>
      within(
        SearchRiseSet(
          Body.Moon,
          observer,
          direction,
          new Date(midnight),
          1,
        )?.date.getTime(),
      );
    const culmination = SearchHourAngle(
      Body.Moon,
      observer,
      0,
      new Date(midnight),
      1,
    );
    const peak = within(culmination.time.date.getTime());
    const illumination = Illumination(Body.Moon, new Date(noon));
    const elongation = MoonPhase(new Date(noon));
    const distanceKm = illumination.geo_dist * KM_PER_AU;
    const equator = Equator(Body.Moon, new Date(noon), observer, true, true);
    days.push({
      day,
      noon,
      age: lunationAt(noon).age,
      illumination: illumination.phase_fraction,
      elongation,
      phase: phaseName(elongation),
      distanceKm,
      apparentDiameter: apparentDiameter(distanceKm),
      ra: equator.ra,
      dec: equator.dec,
      rise: event(1),
      set: event(-1),
      transit:
        peak === null
          ? null
          : {
              time: peak,
              altitude: culmination.hor.altitude,
              azimuth: culmination.hor.azimuth,
            },
      ...(quarters.has(day) ? { quarter: quarters.get(day) } : {}),
      ...(eclipses.has(day) ? { eclipse: eclipses.get(day) } : {}),
    });
  }
  return {
    month: query.month,
    days,
    previous: shiftMonth(query.month, -1),
    next: shiftMonth(query.month, 1),
  };
}

/**
 * The lit region of the disc as an SVG path, in a box centred on the origin.
 *
 * The terminator is the projected edge of the lit hemisphere, so it is a
 * semi-ellipse whose width is the cosine of the elongation: it coincides with
 * the limb at new and full moon and collapses to a straight line at the
 * quarters. The path therefore encloses exactly the illuminated fraction at
 * every angle, which is why no artwork is needed.
 *
 * The lit limb is drawn on the right, as a waxing Moon appears from the
 * northern hemisphere; a waning Moon reuses the same shape mirrored.
 */
export function phaseDiscPath(elongation: number, radius: number) {
  const waxing = elongation < 180;
  const angle = ((waxing ? elongation : 360 - elongation) * Math.PI) / 180;
  const width = Math.abs(radius * Math.cos(angle));
  // The terminator bulges toward the lit limb while the Moon is a crescent and
  // away from it once it is gibbous; that is the sign of the cosine.
  const sweep = Math.cos(angle) > 0 ? 0 : 1;
  const round = (value: number) => Number(value.toFixed(3));
  return {
    waxing,
    path: `M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius} A ${round(width)} ${radius} 0 0 ${sweep} 0 ${-radius} Z`,
  };
}
