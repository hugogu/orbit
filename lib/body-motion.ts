import { HelioVector } from 'astronomy-engine';
import { Vector3 } from 'three';
import { bodies } from './solar';
import { comets, cometPosition } from './comets';
import { asteroids, asteroidPosition } from './asteroids';
import { orbitingMoons } from './moon-orbits';
import { moonVectorKm } from './satellite-elements';
import { astroBodies, sceneVector } from './ephemeris';
import { AU_SCENE_UNITS } from './display-scale';
import { AU_KM } from './eclipse-shadows';

const SECONDS_PER_DAY = 86_400;
// A half step of about 8.6 seconds stays far inside the shortest orbit shown
// here (Phobos, 7.7 hours) while keeping the difference far above the rounding
// noise of the outer planets' coordinates.
const HALF_STEP_DAYS = 1e-4;

export type BodyMotion = {
  /** Orbital speed around `center`, km/s. */
  speed: number;
  /** Ecliptic longitude seen from `center`, degrees in [0, 360). */
  longitude: number;
  /** The body the motion is measured against, as a translation key. */
  center: string;
};
/** A body's own path around whatever it orbits, in J2000 ecliptic kilometres. */
type Trajectory = (days: number) => Vector3;

const sun = bodies.find((body) => body.id === 'sun')!;
// Scene axes carry the ecliptic with Y as north and the in-plane sine on -Z.
function eclipticKm(scene: ArrayLike<number>, kmPerUnit: number) {
  return new Vector3(scene[0], -scene[2], scene[1]).multiplyScalar(kmPerUnit);
}
function trajectory(id: string): { at: Trajectory; center: string } | null {
  const body = bodies.find((item) => item.id === id);
  // The Sun holds the origin of every heliocentric path, itself included.
  if (body)
    return body.id === 'sun'
      ? null
      : {
          center: sun.name,
          at: (days) =>
            eclipticKm(sceneVector(HelioVector(astroBodies[id], days)), AU_KM),
        };
  const comet = comets.find((item) => item.id === id);
  if (comet)
    return {
      center: sun.name,
      at: (days) =>
        eclipticKm(cometPosition(comet, days), AU_KM / AU_SCENE_UNITS),
    };
  const asteroid = asteroids.find((item) => item.id === id);
  if (asteroid)
    return {
      center: sun.name,
      at: (days) =>
        eclipticKm(
          asteroidPosition(asteroid, days, 'distance'),
          AU_KM / AU_SCENE_UNITS,
        ),
    };
  const moon = orbitingMoons.find((item) => item.id === id);
  if (moon)
    return {
      center: bodies.find((item) => item.id === moon.parentId)!.name,
      at: (days) => eclipticKm(moonVectorKm(moon, days).toArray(), 1),
    };
  return null;
}

/**
 * Live speed and ecliptic longitude for a followed body, read from the same
 * trajectory the scene draws. Moons report their motion around their planet,
 * everything else its motion around the Sun; the Sun itself reports nothing.
 * A central difference keeps one expression valid for the planetary series,
 * the lunar and Galilean solutions, and the two-body comet and asteroid
 * snapshots alike, so the readout can never drift from the rendered orbit.
 */
export function bodyMotion(id: string, days: number): BodyMotion | null {
  const path = trajectory(id);
  if (!path) return null;
  const here = path.at(days);
  const step = path
    .at(days + HALF_STEP_DAYS)
    .sub(path.at(days - HALF_STEP_DAYS));
  const longitude = (Math.atan2(here.y, here.x) * 180) / Math.PI;
  return {
    speed: step.length() / (2 * HALF_STEP_DAYS * SECONDS_PER_DAY),
    longitude: (longitude + 360) % 360,
    center: path.center,
  };
}
