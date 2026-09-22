/**
 * Turning sandbox quantities into scene units.
 *
 * A sandbox run always draws at true distances: the illustrated layout gives
 * each body its own hand-authored distance, so a physical trajectory rendered
 * through it would simply be wrong. Sizes keep the same choice the rest of the
 * observatory offers.
 */
import { AU_SCENE_UNITS, kmToScene } from '../display-scale';
import { bodies } from '../solar';
import type { Vec3 } from './physics';

/** Illustrated radius of a body the viewer created, in scene units. */
const DEFAULT_ILLUSTRATED_RADIUS = 0.32;
const EARTH_RADIUS_KM = 6371;

export function scenePosition(position: Vec3): [number, number, number] {
  return [
    position[0] * AU_SCENE_UNITS,
    position[1] * AU_SCENE_UNITS,
    position[2] * AU_SCENE_UNITS,
  ];
}

/**
 * Display radius in scene units.
 *
 * At true size the radius is simply itself. Otherwise the catalogue's authored
 * size is stretched by the cube root of the change the viewer made, so a body
 * ten times heavier reads as clearly bigger without swallowing its neighbours
 * — the same compression the illustrated layout already uses between Mercury
 * and Jupiter.
 */
export function sandboxRadius(
  radiusKm: number,
  sourceId: string | null,
  realSizes: boolean,
) {
  if (realSizes) return radiusKm * kmToScene('distance');
  const body = sourceId
    ? bodies.find((item) => item.id === sourceId)
    : undefined;
  const authored = body
    ? body.size * (body.id === 'sun' ? 0.09 : 0.32)
    : DEFAULT_ILLUSTRATED_RADIUS;
  return authored * Math.cbrt(radiusKm / (body?.radius ?? EARTH_RADIUS_KM));
}

/**
 * Fastest rotation the display will turn a body, in turns per real second.
 *
 * A body's true spin is its period against the chosen time rate, and at the
 * rates a sandbox run uses that is routinely hundreds of turns a second —
 * far past what a frame can sample. The body then strobes: it appears to
 * creep backwards at a rate that says nothing about the simulation, which is
 * exactly the impression that the spin is unconnected to the clock. Holding
 * the rendered rate at a value the eye can follow keeps it proportional to
 * the time rate wherever it can be seen at all.
 */
export const MAX_VISIBLE_TURNS_PER_SECOND = 0.4;

/** How far to turn a body this frame, in radians, sign carrying direction. */
export function spinStep(
  spinDays: number,
  daysPerSecond: number,
  seconds: number,
) {
  if (!spinDays || !Number.isFinite(spinDays)) return 0;
  const turnsPerSecond = daysPerSecond / spinDays;
  const limited =
    Math.sign(turnsPerSecond) *
    Math.min(Math.abs(turnsPerSecond), MAX_VISIBLE_TURNS_PER_SECOND);
  return limited * seconds * Math.PI * 2;
}

/** Whether the shown rotation is slower than the body's own, and so only indicative. */
export function spinIsSlowed(spinDays: number, daysPerSecond: number) {
  return (
    !!spinDays &&
    Math.abs(daysPerSecond / spinDays) > MAX_VISIBLE_TURNS_PER_SECOND
  );
}
