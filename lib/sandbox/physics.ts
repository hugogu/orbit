/**
 * Newtonian point-mass gravity for the sandbox.
 *
 * Everything here works in the Gaussian system Astronomy Engine already
 * speaks: astronomical units, days, and solar masses. `MassProduct` returns
 * GM directly in au³/day², so catalogue masses arrive in the integrator's own
 * units with no conversion layer to get wrong.
 *
 * Vectors use the scene axes from `sceneVector` (Y is ecliptic north). That
 * mapping is a proper rotation, so the dynamics are identical to the ecliptic
 * frame and the renderer needs no per-frame conversion.
 */

/** Heliocentric gravitational constant, au³ / (solar mass · day²) = k². */
export const GRAVITY = 0.01720209895 ** 2;
/** IAU 2015 nominal solar mass, used only to show masses in kilograms. */
export const SOLAR_MASS_KG = 1.98847e30;

export type Vec3 = [number, number, number];

export type PointMass = {
  id: string;
  /** Solar masses. */
  mass: number;
  /** Mean radius in AU; sets the contact test and the softening length. */
  radius: number;
  position: Vec3;
  velocity: Vec3;
};

/**
 * Fraction of the local free-fall timescale used as the integration step.
 * 0.01 puts about 600 steps in a Mercury orbit, which pushes the integration
 * error below the model's own distance from the real ephemeris — past this
 * point a smaller step buys nothing.
 */
export const STEP_FRACTION = 0.01;
export const MIN_STEP_DAYS = 1e-4;
export const MAX_STEP_DAYS = 0.5;

/**
 * Integration step for the current configuration, from the shortest free-fall
 * timescale over all pairs. Deriving it from the bodies rather than fixing it
 * keeps an added body on a tight orbit resolved without slowing the rest.
 */
export function suggestedStep(points: readonly PointMass[]) {
  let shortest = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      const mass = a.mass + b.mass;
      if (mass <= 0) continue;
      const distance = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      );
      const separation = Math.max(distance, softening(a, b));
      shortest = Math.min(
        shortest,
        Math.sqrt(separation ** 3 / (GRAVITY * mass)),
      );
    }
  }
  if (!Number.isFinite(shortest)) return MAX_STEP_DAYS;
  return Math.min(
    MAX_STEP_DAYS,
    Math.max(MIN_STEP_DAYS, STEP_FRACTION * shortest),
  );
}

/** Plummer softening as a fraction of the contact separation. */
const SOFTENING_FRACTION = 0.05;

/**
 * Softening length for a pair. Bodies merge the moment they touch, so this
 * only has to keep the acceleration finite across the single step that
 * carries a pair into contact. Keeping it well inside the contact radius
 * matters: at half the contact separation the Sun's softened pull is already
 * 8 × 10⁻⁶ light at Earth's distance, which shows up as a real timing error
 * over a year.
 */
function softening(a: PointMass, b: PointMass) {
  return SOFTENING_FRACTION * (a.radius + b.radius);
}

/** Writes each body's acceleration in au/day² into `out`. */
export function accelerations(points: readonly PointMass[], out: Vec3[]) {
  for (let i = 0; i < points.length; i++) {
    const vector = out[i];
    vector[0] = 0;
    vector[1] = 0;
    vector[2] = 0;
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      const dx = b.position[0] - a.position[0];
      const dy = b.position[1] - a.position[1];
      const dz = b.position[2] - a.position[2];
      const squared = dx * dx + dy * dy + dz * dz + softening(a, b) ** 2;
      const inverseCube = GRAVITY / (squared * Math.sqrt(squared));
      const onA = inverseCube * b.mass;
      const onB = inverseCube * a.mass;
      out[i][0] += dx * onA;
      out[i][1] += dy * onA;
      out[i][2] += dz * onA;
      out[j][0] -= dx * onB;
      out[j][1] -= dy * onB;
      out[j][2] -= dz * onB;
    }
  }
  return out;
}

export function zeroVectors(count: number): Vec3[] {
  return Array.from({ length: count }, () => [0, 0, 0] as Vec3);
}

/**
 * One velocity-Verlet step, in place. The scheme is symplectic, so the energy
 * error oscillates within a bound instead of drifting away over a long run —
 * which is what lets the panel show a drift figure and mean it.
 *
 * `acceleration` carries the force evaluated at the current positions in and
 * the force at the new positions out, so a run of steps costs one evaluation
 * each rather than two.
 */
export function advance(
  points: readonly PointMass[],
  dt: number,
  acceleration: Vec3[],
) {
  const half = dt / 2;
  for (let i = 0; i < points.length; i++) {
    const { position, velocity } = points[i];
    const a = acceleration[i];
    velocity[0] += a[0] * half;
    velocity[1] += a[1] * half;
    velocity[2] += a[2] * half;
    position[0] += velocity[0] * dt;
    position[1] += velocity[1] * dt;
    position[2] += velocity[2] * dt;
  }
  accelerations(points, acceleration);
  for (let i = 0; i < points.length; i++) {
    const { velocity } = points[i];
    const a = acceleration[i];
    velocity[0] += a[0] * half;
    velocity[1] += a[1] * half;
    velocity[2] += a[2] * half;
  }
}

/**
 * Where a body will be `dt` days on: the position half of one Verlet step,
 * from the acceleration `advance` left for its current position. It is the
 * very arithmetic `advance` performs, so at a whole step's size it lands
 * exactly where that step does — a picture drawn from it between steps meets
 * each one where it lands instead of jumping to it.
 */
export function positionAfter(
  point: PointMass,
  acceleration: Vec3,
  dt: number,
): Vec3 {
  const half = dt / 2;
  const { position, velocity } = point;
  return [
    position[0] + (velocity[0] + acceleration[0] * half) * dt,
    position[1] + (velocity[1] + acceleration[1] * half) * dt,
    position[2] + (velocity[2] + acceleration[2] * half) * dt,
  ];
}

/** Total kinetic plus potential energy, in solar mass · au² / day². */
export function systemEnergy(points: readonly PointMass[]) {
  let energy = 0;
  for (const point of points) {
    const speed = Math.hypot(...point.velocity);
    energy += 0.5 * point.mass * speed * speed;
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      const distance = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      );
      energy -=
        (GRAVITY * a.mass * b.mass) / Math.max(distance, softening(a, b));
    }
  }
  return energy;
}

export type Barycenter = { position: Vec3; velocity: Vec3; mass: number };

export function barycenter(points: readonly PointMass[]): Barycenter {
  const position: Vec3 = [0, 0, 0];
  const velocity: Vec3 = [0, 0, 0];
  let mass = 0;
  for (const point of points) {
    mass += point.mass;
    for (let axis = 0; axis < 3; axis++) {
      position[axis] += point.mass * point.position[axis];
      velocity[axis] += point.mass * point.velocity[axis];
    }
  }
  if (mass > 0)
    for (let axis = 0; axis < 3; axis++) {
      position[axis] /= mass;
      velocity[axis] /= mass;
    }
  return { position, velocity, mass };
}

export type Collision = {
  absorbed: string;
  into: string;
  /** Where the absorbed body was when the two touched. */
  position: Vec3;
};

/**
 * Merges every touching pair, conserving mass and momentum and combining
 * volumes. A perfectly inelastic merge is the only outcome a point-mass model
 * can represent honestly, and it keeps the run finite when a user aims one
 * body at another.
 */
export function mergeContacts(points: PointMass[]): Collision[] {
  const collisions: Collision[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      const distance = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      );
      if (distance > a.radius + b.radius) continue;
      // The heavier body keeps its identity so the scene can carry on
      // following whatever the viewer had selected in the usual case.
      const [keep, lost] = a.mass >= b.mass ? [a, b] : [b, a];
      const contact: Vec3 = [...lost.position];
      const mass = keep.mass + lost.mass;
      for (let axis = 0; axis < 3; axis++) {
        keep.position[axis] =
          (keep.mass * keep.position[axis] + lost.mass * lost.position[axis]) /
          mass;
        keep.velocity[axis] =
          (keep.mass * keep.velocity[axis] + lost.mass * lost.velocity[axis]) /
          mass;
      }
      keep.radius = Math.cbrt(keep.radius ** 3 + lost.radius ** 3);
      keep.mass = mass;
      collisions.push({ absorbed: lost.id, into: keep.id, position: contact });
      points.splice(points.indexOf(lost), 1);
      return [...collisions, ...mergeContacts(points)];
    }
  }
  return collisions;
}
