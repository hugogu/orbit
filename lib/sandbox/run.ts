/**
 * A sandbox run: the viewer's edited system and the untouched one it forked
 * from, integrated side by side.
 *
 * Both systems advance with the same step and reach the same elapsed time, so
 * a body's two positions can be compared directly — that lockstep is the whole
 * point of carrying the baseline at all.
 */
import {
  advance,
  accelerations,
  barycenter,
  mergeContacts,
  suggestedStep,
  systemEnergy,
  zeroVectors,
  type Collision,
  type PointMass,
  type Vec3,
} from './physics';
import { orbitState } from './derived';
import { forkScenario, kmToAu, type SandboxScenario } from './scenario';
import { SOLAR_MASS_KG } from './physics';

/** Work ceiling for one advance, so a fast rate can never stall a frame. */
export const MAX_STEPS_PER_ADVANCE = 600;
/** Trail points kept per body before the history is thinned. */
export const TRAIL_CAPACITY = 900;

export type SandboxEvent =
  | { kind: 'collision'; absorbed: string; into: string; day: number }
  | { kind: 'escape'; id: string; day: number };

export type SandboxRun = {
  readonly scenario: SandboxScenario;
  /** Simulated days since the fork. */
  elapsedDays: number;
  /** The edited system. */
  variant: PointMass[];
  /** The same fork with no edits, for comparison. */
  baseline: PointMass[];
  trails: Map<string, Vec3[]>;
  baselineTrails: Map<string, Vec3[]>;
  events: SandboxEvent[];
  /** Integration step last used, in days. */
  step: number;
  /** Steps taken in the last advance, before the ceiling was applied. */
  steps: number;
  /** True while the step ceiling is holding the run below the chosen rate. */
  throttled: boolean;
  /** |E − E₀| / |E₀| for the edited system. */
  energyDrift: number;
  advance(days: number): void;
};

function toPointMass(spec: SandboxScenario['bodies'][number]): PointMass {
  return {
    id: spec.id,
    mass: spec.mass / SOLAR_MASS_KG,
    radius: kmToAu(spec.radius),
    position: [...spec.position],
    velocity: [...spec.velocity],
  };
}

function dominant(points: readonly PointMass[]) {
  return points.reduce(
    (heaviest, point) => (point.mass > heaviest.mass ? point : heaviest),
    points[0],
  );
}

type Track = {
  points: PointMass[];
  acceleration: Vec3[];
  trails: Map<string, Vec3[]>;
  escaped: Set<string>;
};

function createTrack(scenario: SandboxScenario): Track {
  const points = scenario.bodies.map(toPointMass);
  const acceleration = zeroVectors(points.length);
  accelerations(points, acceleration);
  return {
    points,
    acceleration,
    trails: new Map(points.map((point) => [point.id, [[...point.position]]])),
    escaped: new Set(),
  };
}

function record(track: Track) {
  for (const point of track.points) {
    const trail = track.trails.get(point.id);
    if (trail) trail.push([...point.position]);
    else track.trails.set(point.id, [[...point.position]]);
  }
}

/**
 * Halves every trail once the longest one fills up, doubling the interval each
 * point stands for. The ribbon then keeps covering the whole run at a bounded
 * cost, instead of either eating memory or shrinking to a recent stub.
 */
function thin(tracks: Track[]) {
  const longest = Math.max(
    0,
    ...tracks.flatMap((track) =>
      [...track.trails.values()].map((trail) => trail.length),
    ),
  );
  if (longest < TRAIL_CAPACITY) return false;
  for (const track of tracks)
    for (const [id, trail] of track.trails)
      track.trails.set(
        id,
        trail.filter(
          (_, index) => index % 2 === 0 || index === trail.length - 1,
        ),
      );
  return true;
}

export function createRun(scenario: SandboxScenario): SandboxRun {
  const variant = createTrack(scenario);
  const baseline = createTrack(forkScenario(scenario.epoch));
  const referenceEnergy = systemEnergy(variant.points);
  // A run that starts from a single body, or from nothing, has no interactions
  // to measure drift against; reporting zero beats reporting a ratio over zero.
  const scale = Math.abs(referenceEnergy) > 0 ? Math.abs(referenceEnergy) : 1;
  let sampleEvery = suggestedStep(variant.points) * 8;
  let sampledAt = 0;

  const run: SandboxRun = {
    scenario,
    elapsedDays: 0,
    variant: variant.points,
    baseline: baseline.points,
    trails: variant.trails,
    baselineTrails: baseline.trails,
    events: [],
    step: suggestedStep(variant.points),
    steps: 0,
    throttled: false,
    energyDrift: 0,
    advance(days: number) {
      if (!(days > 0) || variant.points.length === 0) {
        run.steps = 0;
        return;
      }
      // One step for both systems keeps their sampled times identical, which
      // is what makes "the same instant" a true statement in the comparison.
      const step = Math.min(
        suggestedStep(variant.points),
        suggestedStep(baseline.points),
      );
      const wanted = Math.ceil(days / step);
      const steps = Math.min(wanted, MAX_STEPS_PER_ADVANCE);
      for (let index = 0; index < steps; index++) {
        advance(variant.points, step, variant.acceleration);
        advance(baseline.points, step, baseline.acceleration);
        run.elapsedDays += step;
        // Checked every step, not once per frame: a fast body crossing a slow
        // one would otherwise pass clean through it between contact tests.
        collide(variant, run);
        collide(baseline, null);
        if (run.elapsedDays - sampledAt >= sampleEvery) {
          record(variant);
          record(baseline);
          sampledAt = run.elapsedDays;
          if (thin([variant, baseline])) sampleEvery *= 2;
        }
      }
      watchEscapes(variant, run);
      run.step = step;
      run.steps = steps;
      run.throttled = wanted > MAX_STEPS_PER_ADVANCE;
      run.energyDrift =
        Math.abs(systemEnergy(variant.points) - referenceEnergy) / scale;
    },
  };
  return run;
}

function collide(track: Track, run: SandboxRun | null) {
  const collisions: Collision[] = mergeContacts(track.points);
  if (collisions.length === 0) return;
  track.acceleration = zeroVectors(track.points.length);
  accelerations(track.points, track.acceleration);
  for (const collision of collisions) {
    track.trails.delete(collision.absorbed);
    run?.events.push({
      kind: 'collision',
      absorbed: collision.absorbed,
      into: collision.into,
      day: run.elapsedDays,
    });
  }
}

function watchEscapes(track: Track, run: SandboxRun) {
  if (track.points.length < 2) return;
  const central = dominant(track.points);
  for (const point of track.points) {
    if (point === central) continue;
    const escaping = orbitState(point, central).escaping;
    if (escaping && !track.escaped.has(point.id)) {
      track.escaped.add(point.id);
      run.events.push({ kind: 'escape', id: point.id, day: run.elapsedDays });
    } else if (!escaping) track.escaped.delete(point.id);
  }
}

export { dominant, barycenter };
