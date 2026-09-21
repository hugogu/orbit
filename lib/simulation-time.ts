export const DAY_MS = 86_400_000;
/** Star catalogues publish proper motion per Julian year. */
export const JULIAN_YEAR_DAYS = 365.25;
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const MIN_TIME = Date.UTC(1700, 0, 1);
export const MAX_TIME = Date.UTC(2200, 11, 31, 23, 59, 59);
export function validTime(ms: number) {
  return Number.isFinite(ms) && ms >= MIN_TIME && ms <= MAX_TIME;
}
export function advanceTime(
  ms: number,
  seconds: number,
  daysPerSecond: number,
  paused: boolean,
) {
  return Math.max(
    MIN_TIME,
    Math.min(MAX_TIME, ms + (paused ? 0 : seconds * daysPerSecond * DAY_MS)),
  );
}
export function utcLabel(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}
