/**
 * A sandbox run: the viewer's edited system and the untouched one it forked
 * from, integrated side by side.
 *
 * Both systems advance with the same step and reach the same elapsed time, so
 * a body's two positions can be compared directly — that lockstep is the whole
 * point of carrying the baseline at all.
 *
 * A run is driven by a recipe, not by a starting state. Changes carry the
 * elapsed time they were made at and are applied when the run reaches it, so
 * an edit lands mid-flight without restarting, and replaying the same recipe
 * reproduces the same path. Steps are a fixed size between review points and
 * are cut exactly at each change, which keeps the state at a given elapsed
 * time independent of how the frames happened to fall.
 */
import {
  advance,
  accelerations,
  barycenter,
  mergeContacts,
  suggestedStep,
  systemEnergy,
  zeroVectors,
  SOLAR_MASS_KG,
  type Collision,
  type PointMass,
  type Vec3,
} from './physics';
import { orbitState } from './derived';
import { writeField } from './edits';
import {
  forkBodies,
  kmToAu,
  auToKm,
  type SandboxBodySpec,
  type SandboxChange,
  type SandboxEdit,
  type SandboxScenario,
} from './scenario';

/** Work ceiling for one advance, so a fast rate can never stall a frame. */
export const MAX_STEPS_PER_ADVANCE = 600;
/** Trail points kept per body before the history is compacted. */
export const TRAIL_CAPACITY = 900;
/**
 * Coarsest a trail may be sampled, as a multiple of the integration step.
 *
 * Halving a trail to keep the whole run in bounded memory costs resolution,
 * and the cost falls hardest on the fastest body: after sixty years Mercury
 * was being recorded under twice per orbit, where the ribbon no longer
 * describes a path at all. Resolution stops giving way here — about twenty
 * points per orbit for the tightest pair — and the oldest history gives way
 * instead, so what is drawn is always something the body actually did.
 */
export const MAX_SAMPLE_STEPS = 24;
/** Fraction of the capacity kept when the oldest history is dropped. */
const TRAIL_KEEP = 0.75;
/**
 * Whole steps between step reviews. Recomputing the step on a fixed count
 * rather than every frame is what keeps a replay on the same footing as the
 * run it came from, while still letting a close encounter refine it.
 */
const STEPS_PER_REVIEW = 32;

export type SandboxEvent =
  | { kind: 'collision'; absorbed: string; into: string; day: number }
  | { kind: 'escape'; id: string; day: number };

/** Presentation a body carries that the integrator has no use for. */
export type BodyFacts = Pick<
  SandboxBodySpec,
  'id' | 'sourceId' | 'name' | 'color' | 'texture' | 'spinDays' | 'tilt'
>;

export type SandboxRun = {
  readonly scenario: SandboxScenario;
  /** Simulated days since the fork. */
  elapsedDays: number;
  /** The edited system. */
  variant: PointMass[];
  /** The same fork with no changes, for comparison. */
  baseline: PointMass[];
  /** Every body the run has carried, in the order it gained them. */
  facts: BodyFacts[];
  trails: Map<string, Vec3[]>;
  baselineTrails: Map<string, Vec3[]>;
  events: SandboxEvent[];
  /** Integration step in days. */
  step: number;
  /** Steps taken in the last advance. */
  steps: number;
  /** True while the step ceiling is holding the run below the chosen rate. */
  throttled: boolean;
  /** |E − E₀| / |E₀| for the edited system. */
  energyDrift: number;
  advance(days: number): void;
  /** Applies an edit now, at the run's current elapsed time, and records it. */
  apply(edit: SandboxEdit & { at?: number }): void;
  /** A body's current parameters in the units the editor shows. */
  liveSpec(id: string): SandboxBodySpec | null;
};

function toPointMass(spec: SandboxBodySpec): PointMass {
  return {
    id: spec.id,
    mass: spec.mass / SOLAR_MASS_KG,
    radius: kmToAu(spec.radius),
    position: [...spec.position],
    velocity: [...spec.velocity],
  };
}

function toFacts(spec: SandboxBodySpec): BodyFacts {
  return {
    id: spec.id,
    sourceId: spec.sourceId,
    name: spec.name,
    color: spec.color,
    texture: spec.texture,
    spinDays: spec.spinDays,
    tilt: spec.tilt,
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

function createTrack(specs: SandboxBodySpec[]): Track {
  const points = specs.map(toPointMass);
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
 * Keeps the trails inside their capacity, and returns the sampling interval
 * to carry on with.
 *
 * While the sampling is still finer than the floor, halving every trail buys
 * room and keeps the whole run on screen. Once it reaches the floor the
 * ribbon stops losing detail and starts losing its oldest end instead.
 */
function compact(tracks: Track[], sampleEvery: number, coarsest: number) {
  const longest = Math.max(
    0,
    ...tracks.flatMap((track) =>
      [...track.trails.values()].map((trail) => trail.length),
    ),
  );
  if (longest < TRAIL_CAPACITY) return sampleEvery;
  if (sampleEvery * 2 <= coarsest) {
    for (const track of tracks)
      for (const [id, trail] of track.trails)
        track.trails.set(
          id,
          trail.filter(
            (_, index) => index % 2 === 0 || index === trail.length - 1,
          ),
        );
    return sampleEvery * 2;
  }
  const keep = Math.round(TRAIL_CAPACITY * TRAIL_KEEP);
  for (const track of tracks)
    for (const trail of track.trails.values())
      if (trail.length > keep) trail.splice(0, trail.length - keep);
  return sampleEvery;
}

export function createRun(scenario: SandboxScenario): SandboxRun {
  const start = forkBodies(scenario.epoch);
  const variant = createTrack(start);
  const baseline = createTrack(start);
  const facts = start.map(toFacts);
  let referenceEnergy = systemEnergy(variant.points);
  // A run that starts from a single body, or from nothing, has no interactions
  // to measure drift against; reporting zero beats reporting a ratio over zero.
  let scale = Math.abs(referenceEnergy) > 0 ? Math.abs(referenceEnergy) : 1;
  let sampleEvery = suggestedStep(variant.points) * 8;
  let sampledAt = 0;
  // Changes not yet reached, soonest first.
  const queue = [...scenario.changes].sort((a, b) => a.at - b.at);
  let step = suggestedStep(variant.points);
  let sinceReview = 0;
  let pending = 0;

  const review = () => {
    step = Math.min(
      suggestedStep(variant.points),
      suggestedStep(baseline.points),
    );
    sinceReview = 0;
  };

  const run: SandboxRun = {
    scenario,
    elapsedDays: 0,
    variant: variant.points,
    baseline: baseline.points,
    facts,
    trails: variant.trails,
    baselineTrails: baseline.trails,
    events: [],
    step,
    steps: 0,
    throttled: false,
    energyDrift: 0,

    liveSpec(id) {
      const fact = facts.find((item) => item.id === id);
      const point = variant.points.find((item) => item.id === id);
      if (!fact || !point) return null;
      return {
        ...fact,
        mass: point.mass * SOLAR_MASS_KG,
        radius: auToKm(point.radius),
        position: [...point.position],
        velocity: [...point.velocity],
      };
    },

    apply(edit) {
      const timed: SandboxChange = { ...edit, at: edit.at ?? run.elapsedDays };
      // Recorded as well as performed: the recipe is what a reset replays and
      // what a link carries, so the two can never describe different runs.
      scenario.changes.push(timed);
      perform(timed);
    },

    advance(days: number) {
      run.steps = 0;
      if (!(days > 0) || variant.points.length === 0) return;
      pending += days;
      let taken = 0;
      let starved = false;
      while (taken < MAX_STEPS_PER_ADVANCE) {
        if (sinceReview >= STEPS_PER_REVIEW) {
          review();
          // Looked for on the review rather than between frames: a burst of
          // them would otherwise all carry the moment the frame ended.
          watchEscapes(variant, run);
        }
        // A change lands at its own elapsed time, not at whichever step
        // happens to straddle it, so a replay cannot drift away from the run
        // it was recorded from.
        const next = queue[0];
        const toChange = next ? next.at - run.elapsedDays : Infinity;
        if (toChange <= 0) {
          perform(queue.shift()!);
          continue;
        }
        // Whole steps only, with the remainder banked for the next frame. A
        // step trimmed to whatever time a frame happened to bring would let
        // the frame rate into the trajectory, and a replay could not then
        // retrace the run it came from.
        const size = Math.min(step, toChange);
        if (pending < size) {
          starved = true;
          break;
        }
        advance(variant.points, size, variant.acceleration);
        advance(baseline.points, size, baseline.acceleration);
        // Landing on a change takes the recorded time itself rather than a
        // sum that rounds near it, so the recipe stays the authority on when
        // the change happened however many steps led up to it.
        run.elapsedDays =
          size === toChange && next ? next.at : run.elapsedDays + size;
        pending -= size;
        sinceReview += 1;
        taken += 1;
        // Checked every step, not once per frame: a fast body crossing a slow
        // one would otherwise pass clean through it between contact tests.
        collide(variant, run);
        collide(baseline, null);
        if (run.elapsedDays - sampledAt >= sampleEvery) {
          record(variant);
          record(baseline);
          sampledAt = run.elapsedDays;
          sampleEvery = compact(
            [variant, baseline],
            sampleEvery,
            step * MAX_SAMPLE_STEPS,
          );
        }
      }
      watchEscapes(variant, run);
      run.step = step;
      run.steps = taken;
      // Time left over because a whole step did not fit yet is banked for the
      // next frame. Time the ceiling could not cover is dropped rather than
      // owed, so a slow device runs behind the chosen rate instead of falling
      // further behind every frame and never catching up.
      run.throttled = !starved && pending > 0;
      if (run.throttled) pending = 0;
      run.energyDrift =
        Math.abs(systemEnergy(variant.points) - referenceEnergy) / scale;
    },
  };

  /** Applies one change to the edited system; the baseline never sees these. */
  function perform(change: SandboxChange) {
    if (change.kind === 'remove') {
      const index = variant.points.findIndex((p) => p.id === change.id);
      if (index >= 0) variant.points.splice(index, 1);
      variant.trails.delete(change.id);
    } else if (change.kind === 'add') {
      if (!facts.some((item) => item.id === change.body.id))
        facts.push(toFacts(change.body));
      if (!variant.points.some((p) => p.id === change.body.id)) {
        variant.points.push(toPointMass(change.body));
        variant.trails.set(change.body.id, [[...change.body.position]]);
      }
    } else {
      const fact = facts.find((item) => item.id === change.id);
      const live = run.liveSpec(change.id);
      const point = variant.points.find((item) => item.id === change.id);
      if (!live || !point || !fact) return;
      // The same writer the editor uses, so a recorded change and a live one
      // can never mean different things.
      const centre = variant.points.reduce(
        (heaviest, item) => (item.mass > heaviest.mass ? item : heaviest),
        variant.points[0],
      );
      const next = writeField(
        live,
        change.field,
        change.value,
        centre.mass * SOLAR_MASS_KG,
      );
      fact.spinDays = next.spinDays;
      fact.tilt = next.tilt;
      point.mass = next.mass / SOLAR_MASS_KG;
      point.radius = kmToAu(next.radius);
      point.position = [...next.position];
      point.velocity = [...next.velocity];
    }
    variant.acceleration = zeroVectors(variant.points.length);
    accelerations(variant.points, variant.acceleration);
    // A change moves the system's energy on purpose. Re-baselining here keeps
    // the drift figure a measure of the integrator rather than of the edit.
    referenceEnergy = systemEnergy(variant.points);
    scale = Math.abs(referenceEnergy) > 0 ? Math.abs(referenceEnergy) : 1;
    review();
  }

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

/**
 * Announces a body coming loose, once.
 *
 * A body thrown onto a wide, heavily perturbed orbit crosses the escape
 * threshold repeatedly, and reporting each crossing filled the list with the
 * same few names at ever-newer times — which read as though every event had
 * taken the newest one's timestamp. The announcement is armed again only once
 * the body is comfortably bound, so a genuine recapture still reports while
 * chatter around the threshold does not.
 */
const REARM_ECCENTRICITY = 0.9;

function watchEscapes(track: Track, run: SandboxRun) {
  if (track.points.length < 2) return;
  const central = dominant(track.points);
  for (const point of track.points) {
    if (point === central) continue;
    const orbit = orbitState(point, central);
    if (orbit.escaping) {
      if (track.escaped.has(point.id)) continue;
      track.escaped.add(point.id);
      run.events.push({ kind: 'escape', id: point.id, day: run.elapsedDays });
    } else if (orbit.eccentricity < REARM_ECCENTRICITY)
      track.escaped.delete(point.id);
  }
}

export { dominant, barycenter };
