/**
 * Turning sandbox quantities into scene units.
 *
 * The run stays in one inertial frame at physical distances. Illustrated sizes
 * spread nearby moons on screen so enlarged planets do not hide them. This
 * display map never changes the positions the integrator records or advances.
 */
import { AU_SCENE_UNITS, displayRadius, kmToScene } from '../display-scale';
import { moonRadii } from '../eclipse-shadows';
import { moonSemimajorKm } from '../satellite-elements';
import { orbitingMoons } from '../moon-orbits';
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
  const moon = sourceId
    ? orbitingMoons.find((item) => item.id === sourceId)
    : undefined;
  const authored = body
    ? body.size * (body.id === 'sun' ? 0.09 : 0.32)
    : moon
      ? displayRadius(moon.id, 'distance', false)
      : DEFAULT_ILLUSTRATED_RADIUS;
  const reference =
    body?.radius ?? (moon ? moonRadii[moon.en] : EARTH_RADIUS_KM);
  return authored * Math.cbrt(radiusKm / reference);
}

type Anchor = [distance: number, shown: number];
const moonAnchors = new Map<string, Anchor[]>();

function anchorsFor(parentId: string): Anchor[] {
  const cached = moonAnchors.get(parentId);
  if (cached) return cached;
  const planet = bodies.find((body) => body.id === parentId);
  const anchors: Anchor[] = planet
    ? [
        [
          planet.radius * kmToScene('distance'),
          sandboxRadius(planet.radius, planet.id, false),
        ],
        ...orbitingMoons
          .filter((moon) => moon.parentId === parentId)
          .map(
            (moon): Anchor => [
              moonSemimajorKm(moon) * kmToScene('distance'),
              moon.distance * 0.32,
            ],
          )
          .sort((a, b) => a[0] - b[0]),
      ]
    : [];
  moonAnchors.set(parentId, anchors);
  return anchors;
}

/**
 * Illustrated distance from a moon's original planet, in scene units.
 * Physics and recorded positions stay inertial. The mapping is continuous
 * across departure and fades to true distance beyond the moon system.
 */
export function moonDisplayDistance(
  parentId: string,
  distance: number,
  realSizes: boolean,
) {
  const anchors = anchorsFor(parentId);
  if (realSizes || anchors.length < 2) return distance;
  const [surface, shown] = anchors[0];
  if (distance <= surface) return (distance * shown) / surface;
  for (let index = 1; index < anchors.length; index++) {
    const [to, toShown] = anchors[index];
    if (distance > to) continue;
    const [from, fromShown] = anchors[index - 1];
    return (
      fromShown + ((toShown - fromShown) * (distance - from)) / (to - from)
    );
  }
  const [last, lastShown] = anchors[anchors.length - 1];
  const extra = lastShown - last;
  return extra > 0
    ? distance + extra * Math.exp(-(distance - last) / (1.5 * extra))
    : distance;
}
