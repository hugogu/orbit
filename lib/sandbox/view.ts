/**
 * What the scene and the panel need to know about a sandbox run, beyond the
 * physics itself.
 */
import type { Translate } from '../i18n';
import type { SandboxRun } from './run';

/**
 * Rates offered inside the sandbox, in simulated days per real second.
 *
 * The observatory's own presets reach ten years a second, which is fine for
 * replaying a solution that was solved in closed form. A sandbox integrates
 * instead, and at that rate a century of Mercury's motion arrives as an
 * accumulated phase error rather than a prediction. Half a year a second is
 * the fastest rate this model can carry without overstating what it knows: a
 * century still takes about three minutes to watch.
 */
export const sandboxSpeeds = [0.1, 0.5, 1, 5, 20, 60, 180];
export const defaultSandboxSpeed = 20;

/**
 * The fastest rate while the planets carry their moons.
 *
 * Accuracy is the step's to keep, and Io holds the step near 0.0028 days
 * whatever the rate; the rate only decides how many of those steps a second
 * has to fit. Twenty days a second is about 7,000 of them, a few percent of a
 * desktop core and within what a phone's frames can carry, where the full
 * range would ask for nine times as many and leave the run falling behind
 * the rate it shows.
 */
export const MOON_SPEED_LIMIT = 20;
export const moonSpeeds = sandboxSpeeds.filter(
  (speed) => speed <= MOON_SPEED_LIMIT,
);

export type SandboxView = {
  run: SandboxRun;
  /** Simulated days per real second. */
  speed: number;
  paused: boolean;
  /** Draw the untouched fork beside the edited system. */
  baseline: boolean;
  trails: boolean;
};

const DAYS_PER_YEAR = 365.25;

/** Elapsed simulated time, as years and days once a run passes a year. */
export function elapsedLabel(days: number, t: Translate) {
  const years = Math.floor(days / DAYS_PER_YEAR);
  return years > 0
    ? t('{{years}} 年 {{days}} 天', {
        years,
        days: Math.floor(days - years * DAYS_PER_YEAR),
      })
    : t('{{value}} 天', { value: days.toFixed(1) });
}

/**
 * A parameter reading as the panel shows it: plain digits in the locale's own
 * style, switching to exponent form where digits would stop being readable.
 */
export function formatReading(
  value: number,
  precision: number,
  locale: string,
) {
  if (!Number.isFinite(value)) return '—';
  const size = Math.abs(value);
  if (size !== 0 && (size >= 1e6 || size < 1e-3))
    return value.toExponential(Math.min(precision, 3));
  return value.toLocaleString(locale, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  });
}
