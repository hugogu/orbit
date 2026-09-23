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
import { centreOf, fieldSpec, readField, writeField } from './edits';
import type { SandboxField } from './field-names';
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
/**
 * How far a body's heading turns between the points its trail records.
 *
 * Recording on the clock gave every body the same points per year: what the
 * fastest needs, and thousands a lap for Neptune. Holding the whole run that
 * way meant dropping the start of it after a few years. Recording on the turn
 * gives every lap about the same two dozen points whether it takes three
 * months or a century and a half — densest at perihelion, where an orbit
 * bends hardest, and next to none on a straight run — so the whole run fits.
 */
export const TRAIL_TURN_DEGREES = 15;
/**
 * Points one trail may hold, a ceiling for pathological runs rather than a
 * window: Mercury, the tightest lap in the real system, reaches it after about
 * two centuries. Past it the oldest quarter gives way.
 */
export const TRAIL_LIMIT = 20_000;
const TRAIL_KEEP = 0.75;
const TURN_COSINE_SQUARED = Math.cos((TRAIL_TURN_DEGREES * Math.PI) / 180) ** 2;
/**
 * Whole steps between step reviews. Recomputing the step on a fixed count
 * rather than every frame is what keeps a replay on the same footing as the
 * run it came from, while still letting a close encounter refine it.
 */
const STEPS_PER_REVIEW = 32;

/**
 * Something that happened in a run: what the physics did, and the changes the
 * viewer made, on one timeline so each outcome reads against its cause.
 */
export type SandboxEvent =
  | { kind: 'collision'; absorbed: string; into: string; day: number }
  | { kind: 'escape' | 'capture'; id: string; day: number }
  | { kind: 'add' | 'remove'; id: string; day: number }
  | {
      kind: 'set';
      id: string;
      field: SandboxField;
      /** The field's value just before and just after, in the editor's units. */
      from: number;
      to: number;
      day: number;
    };

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
  /** Bodies announced as having left the system and not captured since. */
  readonly escaped: ReadonlySet<string>;
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
  /** Each body's velocity when its trail last recorded a point. */
  headings: Map<string, Vec3>;
  escaped: Set<string>;
};

function createTrack(specs: SandboxBodySpec[]): Track {
  const points = specs.map(toPointMass);
  const acceleration = zeroVectors(points.length);
  accelerations(points, acceleration);
  const track: Track = {
    points,
    acceleration,
    trails: new Map(),
    headings: new Map(),
    escaped: new Set(),
  };
  for (const point of points) mark(track, point);
  return track;
}

/** Adds a point to a trail, unless the body has not left the last one. */
function extend(trail: Vec3[], position: Vec3) {
  // A point on top of the last one is a span of no length, which leaves the
  // drawn curve without a direction to take.
  const last = trail[trail.length - 1];
  if (position.every((value, axis) => value === last[axis])) return;
  trail.push([...position]);
  if (trail.length > TRAIL_LIMIT)
    trail.splice(0, trail.length - Math.round(TRAIL_LIMIT * TRAIL_KEEP));
}

/** Records where a body is now and measures its next turn from here. */
function mark(track: Track, point: PointMass) {
  track.headings.set(point.id, [...point.velocity]);
  const trail = track.trails.get(point.id);
  if (trail) extend(trail, point.position);
  else track.trails.set(point.id, [[...point.position]]);
}

/** Whether a body's heading has turned far enough to be worth a point. */
function turned(from: Vec3, to: Vec3) {
  const was = from[0] * from[0] + from[1] * from[1] + from[2] * from[2];
  const now = to[0] * to[0] + to[1] * to[1] + to[2] * to[2];
  // Setting off from rest starts a heading; coming to rest ends one.
  if (was === 0 || now === 0) return was === 0 && now > 0;
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  return dot <= 0 || dot * dot < TURN_COSINE_SQUARED * was * now;
}

function record(track: Track) {
  for (const point of track.points) {
    const heading = track.headings.get(point.id);
    if (!heading || turned(heading, point.velocity)) mark(track, point);
  }
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
    escaped: variant.escaped,
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
          // Looked for on the review and only there: a burst of them would
          // otherwise all carry the moment a frame ended, and a replay at
          // another frame rate would list them at other moments.
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
        record(variant);
        record(baseline);
      }
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
    // Logged here rather than where the viewer acts, so a replay lists each
    // change again at its own moment, alongside whatever it went on to cause.
    if (change.kind === 'remove') {
      const index = variant.points.findIndex((p) => p.id === change.id);
      if (index >= 0) {
        variant.points.splice(index, 1);
        run.events.push({ kind: 'remove', id: change.id, day: change.at });
      }
      variant.trails.delete(change.id);
      variant.headings.delete(change.id);
    } else if (change.kind === 'add') {
      if (!facts.some((item) => item.id === change.body.id))
        facts.push(toFacts(change.body));
      if (!variant.points.some((p) => p.id === change.body.id)) {
        const point = toPointMass(change.body);
        variant.points.push(point);
        mark(variant, point);
        run.events.push({ kind: 'add', id: change.body.id, day: change.at });
      }
    } else {
      const fact = facts.find((item) => item.id === change.id);
      const live = run.liveSpec(change.id);
      const point = variant.points.find((item) => item.id === change.id);
      if (!live || !point || !fact) return;
      const centre = dominant(variant.points);
      // Distance and speed are measured from the central body, so it has
      // neither of its own to set; a link that asks for one changes nothing.
      if (point === centre && fieldSpec(change.field).fromCentre) return;
      // The same writer the editor uses, measured from the same centre, so a
      // recorded change and a live one can never mean different things.
      const frame = centreOf(centre);
      const next = writeField(live, change.field, change.value, frame);
      const from = readField(live, change.field, frame);
      const to = readField(next, change.field, frame);
      // Restoring a body's real values writes every field at once, most of
      // them usually already there; only an actual change is worth a line.
      if (Math.abs(to - from) > 1e-9 * Math.max(Math.abs(from), Math.abs(to)))
        run.events.push({
          kind: 'set',
          id: change.id,
          field: change.field,
          from,
          to,
          day: change.at,
        });
      // The trail is pinned on both sides of the change, so a path that bends
      // or a body that jumps does so at the moment it did, not somewhere on a
      // curve smoothed across it.
      mark(variant, point);
      fact.spinDays = next.spinDays;
      fact.tilt = next.tilt;
      point.mass = next.mass / SOLAR_MASS_KG;
      point.radius = kmToAu(next.radius);
      point.position = [...next.position];
      point.velocity = [...next.velocity];
      mark(variant, point);
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
    // The absorbed body's trail stays, run on to where the two touched: the
    // path that led into the merge is the only record of how it happened.
    const trail = track.trails.get(collision.absorbed);
    if (trail) extend(trail, collision.position);
    track.headings.delete(collision.absorbed);
    // A merge moves the survivor to the pair's centre of mass and changes its
    // course, so its trail takes a point there.
    const survivor = track.points.find((item) => item.id === collision.into);
    if (survivor) mark(track, survivor);
    run?.events.push({
      kind: 'collision',
      absorbed: collision.absorbed,
      into: collision.into,
      day: run.elapsedDays,
    });
  }
}

/**
 * Leaving the system is judged against everything still in it, taken as one
 * mass at its centre — never against the heaviest body alone.
 *
 * Against the Sun alone, any companion heavy enough to swing the Sun about
 * made outer bodies cross the threshold and back every few years, and a body
 * slung past that companion read as leaving days before it hit it. So a body
 * has left only when it is unbound from all the rest, moving away from it, and
 * well outside every body that holds a real share of the mass, where the rest
 * really does act as one point and the verdict stops changing.
 */
/** Share of the system's mass that makes a body part of its core. */
const CORE_SHARE = 0.01;
/** How far past the core, as a multiple of its reach, leaving is judged. */
const CORE_CLEARANCE = 2;
/**
 * A body that has left is announced as captured again only once it is
 * comfortably bound, so chatter near the threshold cannot fill the log.
 */
const RECAPTURE_ECCENTRICITY = 0.9;

function watchEscapes(track: Track, run: SandboxRun) {
  const anchor = dominant(track.points);
  for (const point of track.points) {
    // The heaviest body is what the system is; it cannot leave itself.
    if (point === anchor) continue;
    const rest = track.points.filter(
      (other) => other !== point && !track.escaped.has(other.id),
    );
    const centre = barycenter(rest);
    if (centre.mass === 0) continue;
    const orbit = orbitState(point, { id: '', radius: 0, ...centre });
    if (track.escaped.has(point.id)) {
      if (orbit.eccentricity < RECAPTURE_ECCENTRICITY) {
        track.escaped.delete(point.id);
        run.events.push({
          kind: 'capture',
          id: point.id,
          day: run.elapsedDays,
        });
      }
      continue;
    }
    if (!orbit.escaping) continue;
    const offset = point.position.map(
      (value, axis) => value - centre.position[axis],
    );
    const receding =
      offset.reduce(
        (sum, value, axis) =>
          sum + value * (point.velocity[axis] - centre.velocity[axis]),
        0,
      ) > 0;
    const reach = Math.max(
      0,
      ...rest
        .filter((other) => other.mass >= CORE_SHARE * centre.mass)
        .map((other) =>
          Math.hypot(
            ...other.position.map(
              (value, axis) => value - centre.position[axis],
            ),
          ),
        ),
    );
    if (!receding || orbit.distance <= CORE_CLEARANCE * reach) continue;
    track.escaped.add(point.id);
    run.events.push({ kind: 'escape', id: point.id, day: run.elapsedDays });
  }
}

export { dominant, barycenter };
