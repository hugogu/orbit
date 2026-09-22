/**
 * The editable description of a sandbox run.
 *
 * A scenario is plain serializable data: what bodies exist and what their
 * parameters are. It is never integrated directly — `createRun` turns it into
 * point masses. Keeping the two apart means the editor, a preset and a shared
 * link all describe a run the same way, and the physics never has to know
 * where a number came from.
 */
import {
  Body as AstroBody,
  HelioState,
  MassProduct,
  Vector,
} from 'astronomy-engine';
import { AU_KM } from '../eclipse-shadows';
import { DAY_MS, J2000_MS } from '../simulation-time';
import { bodies } from '../solar';
import { sceneVector } from '../ephemeris';
import { GRAVITY, SOLAR_MASS_KG, type Vec3 } from './physics';
import type { SandboxField } from './field-names';

export type SandboxBodySpec = {
  id: string;
  /** Catalogue body this was forked from; null for a body the viewer added. */
  sourceId: string | null;
  /** Translation key for catalogue bodies, a literal label for added ones. */
  name: string;
  color: string;
  texture?: string;
  /** Kilograms. */
  mass: number;
  /** Mean radius in kilometres. */
  radius: number;
  /** Rotation period in days; negative is retrograde. */
  spinDays: number;
  /** Axial tilt in degrees. */
  tilt: number;
  /** Heliocentric position in AU, scene axes. */
  position: Vec3;
  /** Heliocentric velocity in AU/day, scene axes. */
  velocity: Vec3;
};

/**
 * A change the viewer made, and when they made it.
 *
 * A run is described as a recipe rather than as a frozen starting state: the
 * untouched fork at `epoch` plus the changes applied at their own elapsed
 * times. That is what lets an edit land mid-run without restarting, and what
 * lets a link carry a run in a few dozen characters — the recipient replays
 * the same recipe and reaches the same path.
 */
export type SandboxEdit =
  | { kind: 'set'; id: string; field: SandboxField; value: number }
  | { kind: 'add'; body: SandboxBodySpec }
  | { kind: 'remove'; id: string };

/** An edit with the elapsed day it belongs to. */
export type SandboxChange = SandboxEdit & { at: number };

export type SandboxScenario = {
  /** UTC milliseconds the run forks from. */
  epoch: number;
  /** Ordered by `at`; everything the viewer did to the untouched fork. */
  changes: SandboxChange[];
};

/**
 * Catalogue bodies the sandbox carries, in orbital order.
 *
 * Earth is the Earth–Moon barycenter: Astronomy Engine publishes its state and
 * mass as one body, which is both more accurate for heliocentric motion and
 * the reason moons can stay out of v1 without hand-waving. At scene scale the
 * barycenter sits about 3 × 10⁻⁵ AU from Earth itself — far below a pixel.
 */
export const sandboxSources: { id: string; astro: AstroBody }[] = [
  { id: 'sun', astro: AstroBody.Sun },
  { id: 'mercury', astro: AstroBody.Mercury },
  { id: 'venus', astro: AstroBody.Venus },
  { id: 'earth', astro: AstroBody.EMB },
  { id: 'mars', astro: AstroBody.Mars },
  { id: 'jupiter', astro: AstroBody.Jupiter },
  { id: 'saturn', astro: AstroBody.Saturn },
  { id: 'uranus', astro: AstroBody.Uranus },
  { id: 'neptune', astro: AstroBody.Neptune },
  { id: 'pluto', astro: AstroBody.Pluto },
];

export function daysFromEpoch(epoch: number) {
  return (epoch - J2000_MS) / DAY_MS;
}

/**
 * Catalogue mass in kilograms, derived from the same GM the integrator uses so
 * that showing a mass and reading it back changes nothing.
 */
export function catalogueMass(astro: AstroBody) {
  return (MassProduct(astro) / GRAVITY) * SOLAR_MASS_KG;
}

export function kmToAu(km: number) {
  return km / AU_KM;
}

export function auToKm(au: number) {
  return au * AU_KM;
}

/** An empty recipe: the real system at an epoch, with nothing changed. */
export function forkScenario(epoch: number): SandboxScenario {
  return { epoch, changes: [] };
}

/** The unedited system at an epoch: the baseline every comparison runs against. */
export function forkBodies(epoch: number): SandboxBodySpec[] {
  const days = daysFromEpoch(epoch);
  return sandboxSources.map(({ id, astro }) => {
    const state = HelioState(astro, days);
    const body = bodies.find((item) => item.id === id)!;
    return {
      id,
      sourceId: id,
      name: body.name,
      color: body.color,
      texture: body.texture,
      mass: catalogueMass(astro),
      radius: body.radius,
      spinDays: body.day,
      tilt: body.tilt,
      position: sceneVector(new Vector(state.x, state.y, state.z, state.t)),
      velocity: sceneVector(new Vector(state.vx, state.vy, state.vz, state.t)),
    };
  });
}

/** Orbital speed of a circular orbit at `au` around `centralMassKg`, in AU/day. */
export function circularSpeed(au: number, centralMassKg: number) {
  return Math.sqrt(
    (GRAVITY * (centralMassKg / SOLAR_MASS_KG)) / Math.max(au, 1e-9),
  );
}

/**
 * A body placed on a circular orbit of radius `au` in the ecliptic plane, at
 * `angle` radians measured from the +X scene axis. Used for everything the
 * viewer adds, so a new body starts on a stable orbit rather than falling in.
 */
export function circularState(
  au: number,
  angle: number,
  centralMassKg: number,
): Pick<SandboxBodySpec, 'position' | 'velocity'> {
  const speed = circularSpeed(au, centralMassKg);
  // Scene axes put the ecliptic in-plane sine on -Z, which makes this
  // direction prograde — the same convention the orbit tests protect.
  return {
    position: [au * Math.cos(angle), 0, -au * Math.sin(angle)],
    velocity: [-speed * Math.sin(angle), 0, -speed * Math.cos(angle)],
  };
}
