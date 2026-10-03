import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Observer,
  SearchHourAngle,
  SearchRiseSet,
} from 'astronomy-engine';
import { DAY_MS } from './simulation-time';
import { fallbackSkyLocation } from './sky-events';
import type { Locale } from './i18n';

/** Published event editions have a fixed UTC identity, unlike recurring concepts. */
export type EventOccurrence = {
  id: string;
  body: 'saturn';
  kind: 'opposition';
  concept: 'opposition';
  date: string;
  peak: number;
  /** A night-time frame at the explicitly named reference site. */
  chartTime: number;
};

export const eventOccurrences: EventOccurrence[] = [
  ['2026-10-04', '2026-10-04T12:25:47.700Z'],
  ['2027-10-18', '2027-10-18T00:31:23.468Z'],
  ['2028-10-30', '2028-10-30T17:30:33.872Z'],
].map(([date, peak]) => ({
  id: `saturn-opposition-${date}`,
  body: 'saturn',
  kind: 'opposition',
  concept: 'opposition',
  date,
  peak: Date.parse(peak),
  chartTime: Date.parse(`${date}T14:00:00Z`),
}));

export function eventOccurrence(id: string) {
  return eventOccurrences.find((event) => event.id === id);
}

/** Only link a calculated card when an edition of that actual event exists. */
export function occurrenceForPlanetEvent(
  kind: string,
  body: string,
  peak: number,
) {
  return eventOccurrences.find(
    (event) =>
      event.kind === kind &&
      event.body === body &&
      Math.abs(event.peak - peak) < 60_000,
  );
}

export const occurrenceReferenceLocation = { ...fallbackSkyLocation };
export const occurrenceImageSize = { width: 1400, height: 820 };

export function occurrenceImagePath(event: EventOccurrence, locale: Locale) {
  return `/events/sky/${event.id}-${locale}.webp`;
}

/** Each edition reads its own ephemeris; no measurements are copied between years. */
export function occurrenceCircumstances(event: EventOccurrence) {
  const place = occurrenceReferenceLocation;
  const observer = new Observer(place.latitude, place.longitude, place.height);
  const light = Illumination(Body.Saturn, new Date(event.peak));
  const eq = Equator(
    Body.Saturn,
    new Date(event.chartTime),
    observer,
    true,
    true,
  );
  const sky = Horizon(
    new Date(event.chartTime),
    observer,
    eq.ra,
    eq.dec,
    'normal',
  );
  const localDate = new Date(event.chartTime + place.utcOffset * 3_600_000)
    .toISOString()
    .slice(0, 10);
  // Noon to noon keeps an observing night together across local midnight.
  const start =
    Date.parse(`${localDate}T12:00:00Z`) - place.utcOffset * 3_600_000;
  const end = start + DAY_MS;
  const within = (ms: number | undefined) =>
    ms !== undefined && ms >= start && ms < end ? ms : null;
  const riseSet = (direction: 1 | -1) =>
    within(
      SearchRiseSet(
        Body.Saturn,
        observer,
        direction,
        new Date(start),
        1,
      )?.date.getTime(),
    );
  return {
    distance: light.geo_dist,
    magnitude: light.mag,
    ringTilt: light.ring_tilt!,
    altitude: sky.altitude,
    azimuth: sky.azimuth,
    rise: riseSet(1),
    transit: within(
      SearchHourAngle(
        Body.Saturn,
        observer,
        0,
        new Date(start),
      ).time.date.getTime(),
    ),
    set: riseSet(-1),
  };
}
