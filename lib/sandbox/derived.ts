/**
 * Quantities read back out of a running sandbox.
 *
 * None of these are editable: they are recomputed from the state vectors every
 * time the panel draws, which is what separates a figure the simulation owns
 * from a parameter the viewer owns.
 */
import { AU_KM } from '../eclipse-shadows';
import { GRAVITY, SOLAR_MASS_KG, type PointMass, type Vec3 } from './physics';

const DAY_S = 86_400;
/** CODATA 2018 gravitational constant, for the per-body surface figures. */
const NEWTON_G = 6.6743e-11;

export function auPerDayToKmPerSecond(speed: number) {
  return (speed * AU_KM) / DAY_S;
}

export function kmPerSecondToAuPerDay(speed: number) {
  return (speed * DAY_S) / AU_KM;
}

/** Mean density in g/cm³ from a mass in kilograms and a radius in kilometres. */
export function density(massKg: number, radiusKm: number) {
  const volumeCm3 = (4 / 3) * Math.PI * (radiusKm * 1e5) ** 3;
  return volumeCm3 > 0 ? (massKg * 1000) / volumeCm3 : 0;
}

/** Surface gravity in m/s². */
export function surfaceGravity(massKg: number, radiusKm: number) {
  const radiusM = radiusKm * 1000;
  return radiusM > 0 ? (NEWTON_G * massKg) / radiusM ** 2 : 0;
}

/** Escape velocity from the surface, in km/s. */
export function escapeVelocity(massKg: number, radiusKm: number) {
  const radiusM = radiusKm * 1000;
  return radiusM > 0 ? Math.sqrt((2 * NEWTON_G * massKg) / radiusM) / 1000 : 0;
}

export type OrbitState = {
  /** Distance from the central body, AU. */
  distance: number;
  /** Speed relative to the central body, AU/day. */
  speed: number;
  /** Semi-major axis in AU; negative on a hyperbolic path. */
  semimajor: number;
  eccentricity: number;
  /** Inclination to the ecliptic, degrees. */
  inclination: number;
  /** Sidereal period in days, or null when the orbit is not closed. */
  period: number | null;
  /** Closest approach in AU. */
  perihelion: number;
  /** Furthest point in AU, or null when the orbit is not closed. */
  aphelion: number | null;
  /** Specific orbital energy, au²/day². Positive means the body is leaving. */
  energy: number;
  escaping: boolean;
};

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Osculating two-body elements against the dominant mass — the orbit the body
 * would keep if every other body vanished right now. That is the standard way
 * to read an instantaneous state, and it is what makes "eccentricity passed
 * 1" a meaningful escape announcement rather than a guess.
 */
export function orbitState(point: PointMass, central: PointMass): OrbitState {
  const relative = subtract(point.position, central.position);
  const motion = subtract(point.velocity, central.velocity);
  const distance = Math.hypot(...relative);
  const speed = Math.hypot(...motion);
  const mu = GRAVITY * (central.mass + point.mass);
  const energy = (speed * speed) / 2 - mu / Math.max(distance, 1e-12);
  const momentum = cross(relative, motion);
  const momentumLength = Math.hypot(...momentum);
  // e = |(v × h)/μ − r̂| keeps its accuracy on near-circular orbits, where
  // deriving it from energy alone loses most of its significant digits.
  const eccentricityVector = cross(motion, momentum).map(
    (component, axis) => component / mu - relative[axis] / distance,
  ) as Vec3;
  const eccentricity = Math.hypot(...eccentricityVector);
  const semimajor = energy === 0 ? Infinity : -mu / (2 * energy);
  const closed = energy < 0 && Number.isFinite(semimajor);
  const perihelion = closed
    ? semimajor * (1 - eccentricity)
    : (momentumLength * momentumLength) / mu / (1 + eccentricity);
  return {
    distance,
    speed,
    semimajor,
    eccentricity,
    inclination:
      momentumLength > 0
        ? (Math.acos(momentum[1] / momentumLength) * 180) / Math.PI
        : 0,
    period: closed ? 2 * Math.PI * Math.sqrt(semimajor ** 3 / mu) : null,
    perihelion,
    aphelion: closed ? semimajor * (1 + eccentricity) : null,
    energy,
    escaping: energy >= 0,
  };
}

/** Mass in kilograms, for a point mass carried in solar masses. */
export function massKg(point: PointMass) {
  return point.mass * SOLAR_MASS_KG;
}

/** Radius in kilometres, for a point mass carried in AU. */
export function radiusKm(point: PointMass) {
  return point.radius * AU_KM;
}
