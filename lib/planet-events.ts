import {
  Body,
  Ecliptic,
  Equator,
  GeoVector,
  Horizon,
  Illumination,
  Observer,
  Search,
  SearchRelativeLongitude,
  SearchTransit,
} from 'astronomy-engine';
import { DAY_MS, MAX_TIME, validTime } from './simulation-time';
import type { EclipseQuery } from './sky-events';

export type PlannerTab = 'solar' | 'lunar' | 'opposition' | 'transit';
export type PlanetEvent = {
  body: string;
  peak: number;
  altitude: number;
  distance: number;
  magnitude: number;
  begin?: number;
  end?: number;
};
export type PlanetEventList = {
  opposition: PlanetEvent[];
  transit: PlanetEvent[];
};
const outerPlanets = [
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
];
const innerPlanets = [Body.Mercury, Body.Venus];

/** Apparent geocentric opposition, rather than instantaneous heliocentric alignment. */
export function nextOpposition(body: Body, start: number): number {
  if (!outerPlanets.includes(body))
    throw new Error('Opposition requires an outer planet.');
  let alignment = SearchRelativeLongitude(
    body,
    0,
    new Date(start - 2 * DAY_MS),
  );
  for (;;) {
    const peak = Search(
      (time) => {
        const sun = Ecliptic(GeoVector(Body.Sun, time, true)).elon;
        const planet = Ecliptic(GeoVector(body, time, true)).elon;
        return ((sun + 180 - planet + 540) % 360) - 180;
      },
      alignment.AddDays(-2),
      alignment.AddDays(2),
    );
    if (!peak) throw new Error('暂时无法计算，请调整日期后重试。');
    const ms = peak.date.getTime();
    if (ms >= start) return ms;
    alignment = SearchRelativeLongitude(body, 0, alignment.AddDays(3));
  }
}

/** Three oppositions and two transits per eligible planet, from the opening snapshot. */
export function calculatePlanetEvents(query: EclipseQuery): PlanetEventList {
  if (!validTime(query.start))
    throw new Error('暂时无法计算，请调整日期后重试。');
  const observer = new Observer(query.latitude, query.longitude, query.height);
  const at = (body: Body, peak: number): PlanetEvent => {
    const date = new Date(peak);
    const eq = Equator(body, date, observer, true, true);
    const light = Illumination(body, date);
    return {
      body: body.toLowerCase(),
      peak,
      altitude: Horizon(date, observer, eq.ra, eq.dec, 'normal').altitude,
      distance: light.geo_dist,
      magnitude: light.mag,
    };
  };
  const opposition: PlanetEvent[] = [],
    transit: PlanetEvent[] = [];
  for (const body of outerPlanets) {
    let start = query.start;
    for (let i = 0; i < 3; i++) {
      const peak = nextOpposition(body, start);
      if (peak > MAX_TIME) break;
      opposition.push(at(body, peak));
      start = peak + DAY_MS;
    }
  }
  for (const body of innerPlanets) {
    let start = query.start;
    for (let i = 0; i < 2; i++) {
      let event = SearchTransit(body, new Date(start));
      // A search begun during a transit can return the same event again.
      if (event.peak.date.getTime() < start)
        event = SearchTransit(body, event.finish.AddDays(1));
      const peak = event.peak.date.getTime();
      if (peak > MAX_TIME) break;
      const card = at(body, peak);
      const eq = Equator(Body.Sun, event.peak, observer, true, true);
      transit.push({
        ...card,
        altitude: Horizon(event.peak, observer, eq.ra, eq.dec, 'normal')
          .altitude,
        begin: event.start.date.getTime(),
        end: event.finish.date.getTime(),
      });
      start = event.finish.date.getTime() + DAY_MS;
    }
  }
  const byTime = (a: PlanetEvent, b: PlanetEvent) => a.peak - b.peak;
  return { opposition: opposition.sort(byTime), transit: transit.sort(byTime) };
}
