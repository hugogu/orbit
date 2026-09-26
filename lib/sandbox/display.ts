/**
 * Turning sandbox quantities into scene units.
 *
 * A sandbox run always draws at true distances: the illustrated layout gives
 * each body its own hand-authored distance, so a physical trajectory rendered
 * through it would simply be wrong. Sizes keep the same choice the rest of the
 * observatory offers.
 */
import { AU_SCENE_UNITS, displayRadius, kmToScene } from '../display-scale';
import { moonRadii } from '../eclipse-shadows';
import { orbitingMoons } from '../moon-orbits';
import { moonSemimajorKm } from '../satellite-elements';
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

/** True and shown distance from a planet, in scene units, that a moon map runs through. */
type Anchor = [distance: number, shown: number];
const anchors = new Map<string, Anchor[]>();

function moonAnchors(parentId: string): Anchor[] {
  const cached = anchors.get(parentId);
  if (cached) return cached;
  const planet = bodies.find((item) => item.id === parentId);
  const list: Anchor[] = planet
    ? [
        [
          planet.radius * kmToScene('distance'),
          displayRadius(parentId, 'distance', false),
        ],
        ...orbitingMoons
          .filter((moon) => moon.parentId === parentId)
          .map(
            (moon): Anchor => [
              moonSemimajorKm(moon) * kmToScene('distance'),
              // Where the explorer draws this moon's orbit at true distances.
              moon.distance * 0.32,
            ],
          )
          .sort((a, b) => a[0] - b[0]),
      ]
    : [];
  anchors.set(parentId, list);
  return list;
}

/**
 * How far from its planet a moon is drawn, given how far it really is, both
 * in scene units.
 *
 * At true distances a planet is drawn thousands of times its size, which
 * would bury every moon inside its planet's sphere. So a moon's distance is
 * mapped the way the explorer lays moons out: the planet's surface lands on
 * its drawn surface, each catalogued moon's orbit on the distance the
 * explorer draws it at, and anything between follows a straight line from one
 * to the next. The map only ever grows outward, so an orbit that shrinks or
 * swells on screen did so in the run, and a moon that touches its planet is
 * drawn touching it. Beyond the outermost moon the magnification bleeds away
 * over a distance half again the extra it adds, so a moon flung loose drifts
 * back toward its true place instead of swinging out at the magnified rate.
 * At true sizes nothing needs mapping at all.
 */
export function moonDisplayDistance(
  parentId: string,
  distance: number,
  realSizes: boolean,
) {
  const list = moonAnchors(parentId);
  if (realSizes || list.length < 2) return distance;
  const [surface, shown] = list[0];
  if (distance <= surface) return (distance * shown) / surface;
  for (let index = 1; index < list.length; index++) {
    const [to, toShown] = list[index];
    if (distance > to) continue;
    const [from, fromShown] = list[index - 1];
    return (
      fromShown + ((toShown - fromShown) * (distance - from)) / (to - from)
    );
  }
  const [last, lastShown] = list[list.length - 1];
  const extra = lastShown - last;
  return distance + extra * Math.exp(-(distance - last) / (1.5 * extra));
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
