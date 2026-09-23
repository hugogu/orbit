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
import { moonState, sandboxMoons } from './moons';

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
  /**
   * The planet a moon orbits. Its distance and speed are read from that
   * planet, and it is drawn around it.
   */
  parentId?: string;
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
  /**
   * Whether the planets carry their moons. It changes the physics of the
   * whole run, not just what is drawn, so it belongs to the recipe.
   */
  moons?: boolean;
};

/**
 * Catalogue bodies the sandbox carries, in orbital order.
 *
 * Each is its planetary system's centre of mass with the system's whole mass,
 * which is what Astronomy Engine publishes — for Earth that is the Earth–Moon
 * barycenter. A run without moons integrates exactly that; a run with them
 * splits each system into the planet and its moons around the same centre.
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
export function forkScenario(epoch: number, moons = false): SandboxScenario {
  return moons ? { epoch, changes: [], moons } : { epoch, changes: [] };
}

/**
 * The same recipe from its fork again, every change kept: turning the clock
 * back, not starting over. A new object, so a run built on it rebuilds, and a
 * copy of the changes, so the new run's edits cannot reach back into the old.
 */
export function rewoundScenario(scenario: SandboxScenario): SandboxScenario {
  return { ...scenario, changes: [...scenario.changes] };
}

/** The unedited system at an epoch: the baseline every comparison runs against. */
export function forkBodies(epoch: number, moons = false): SandboxBodySpec[] {
  const days = daysFromEpoch(epoch);
  const planets = sandboxSources.map(({ id, astro }) => {
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
  return moons ? planets.flatMap((planet) => withMoons(planet, days)) : planets;
}

/**
 * Splits a planetary system into the planet and its moons.
 *
 * The published state is the system's centre of mass and the published mass
 * the system's whole mass, so the planet keeps what its moons do not carry
 * and sits where their centre of mass comes out right. The split changes
 * nothing the rest of the system can feel: the same mass and momentum, at the
 * same place, as a run without moons.
 */
function withMoons(system: SandboxBodySpec, days: number): SandboxBodySpec[] {
  const moons = sandboxMoons
    .filter((moon) => moon.parentId === system.id)
    .map((moon) => ({ moon, ...moonState(moon, days) }));
  if (moons.length === 0) return [system];
  const offset = (key: 'position' | 'velocity'): Vec3 => {
    const sum: Vec3 = [0, 0, 0];
    for (const entry of moons)
      for (let axis = 0; axis < 3; axis++)
        sum[axis] += (entry.moon.massKg * entry[key][axis]) / system.mass;
    return sum;
  };
  const shift = offset('position');
  const drift = offset('velocity');
  const planet: SandboxBodySpec = {
    ...system,
    mass:
      system.mass - moons.reduce((sum, entry) => sum + entry.moon.massKg, 0),
    position: [0, 1, 2].map(
      (axis) => system.position[axis] - shift[axis],
    ) as Vec3,
    velocity: [0, 1, 2].map(
      (axis) => system.velocity[axis] - drift[axis],
    ) as Vec3,
  };
  return [
    planet,
    ...moons.map(({ moon, position, velocity }) => ({
      id: moon.id,
      sourceId: moon.id,
      parentId: system.id,
      name: moon.name,
      color: moon.color,
      texture: moon.texture,
      mass: moon.massKg,
      radius: moon.radiusKm,
      // Every moon here turns once per orbit, keeping one face to its planet.
      spinDays: moon.period,
      tilt: 0,
      position: [0, 1, 2].map(
        (axis) => planet.position[axis] + position[axis],
      ) as Vec3,
      velocity: [0, 1, 2].map(
        (axis) => planet.velocity[axis] + velocity[axis],
      ) as Vec3,
    })),
  ];
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
