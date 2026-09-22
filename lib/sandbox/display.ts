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
