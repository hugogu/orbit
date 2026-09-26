import tzLookup from '@photostructure/tz-lookup';
import { fromZonedTime } from 'date-fns-tz';
import { zoneOffsetHours } from './geolocation';
import { utcLabel, validTime } from './simulation-time';
import type { SkyLocation } from './sky-events';

export type ObserverClock = Pick<SkyLocation, 'timeZone' | 'utcOffset'>;

/** Coordinates stay on the device; a manual offset can override border estimates. */
export function locateTimeZone(
  location: SkyLocation,
  time: number,
): SkyLocation {
  const timeZone = tzLookup(location.latitude, location.longitude);
  return {
    ...location,
    timeZone,
    utcOffset: zoneOffsetHours(time, timeZone) ?? location.utcOffset,
  };
}

export function observerOffset(time: number, clock: ObserverClock) {
  return (
    (clock.timeZone ? zoneOffsetHours(time, clock.timeZone) : undefined) ??
    clock.utcOffset
  );
}

export function observerTimeLabel(time: number, clock: ObserverClock) {
  return utcLabel(time + observerOffset(time, clock) * 3600000);
}

export function utcOffsetLabel(hours: number) {
  const seconds = Math.round(Math.abs(hours) * 3600);
  const minutes = Math.floor(seconds / 60);
  return `UTC${hours < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${seconds % 60 ? ':' + String(seconds % 60).padStart(2, '0') : ''}`;
}

/** Reject a daylight-saving gap instead of silently seeking to a different hour. */
export function parseObserverTime(
  input: string,
  clock: ObserverClock,
  openedAt?: number,
) {
  const normalized = input.length === 16 ? `${input}:00` : input;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) return null;
  // Opening and accepting an unchanged field must preserve the instant even
  // during the repeated hour when daylight saving ends.
  if (
    openedAt !== undefined &&
    validTime(openedAt) &&
    observerTimeLabel(openedAt, clock).replace(' ', 'T') === normalized
  )
    return openedAt;
  const time = clock.timeZone
    ? fromZonedTime(normalized, clock.timeZone).getTime()
    : Date.parse(`${normalized}Z`) - clock.utcOffset * 3600000;
  if (
    !validTime(time) ||
    observerTimeLabel(time, clock).replace(' ', 'T') !== normalized
  )
    return null;
  return time;
}
