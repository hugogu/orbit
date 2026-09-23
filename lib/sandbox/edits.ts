/**
 * The editable parameter model.
 *
 * One description of every field the viewer can change — its unit, its range,
 * and whether it actually enters the force law. The editor, the validator and
 * anything that later writes a scenario all read this, so a parameter cannot
 * mean one thing in the panel and another in the physics.
 */
import { bodies } from '../solar';
import type { SandboxField } from './field-names';
import { GRAVITY, SOLAR_MASS_KG, type PointMass, type Vec3 } from './physics';
import {
  catalogueMass,
  circularSpeed,
  circularState,
  sandboxSources,
  type SandboxBodySpec,
} from './scenario';
import { auPerDayToKmPerSecond, kmPerSecondToAuPerDay } from './derived';

/**
 * Whether a field changes where a body goes.
 *
 * In a point-mass model, spin and tilt have no coupling to the orbit at all.
 * Keeping that distinction in the data — rather than only in a help note —
 * is what stops the panel from offering a control that quietly does nothing.
 */
export type FieldKind = 'dynamical' | 'appearance';

export type { SandboxField };

export type FieldSpec = {
  id: SandboxField;
  kind: FieldKind;
  /** Translation key for the control's label. */
  label: string;
  /** Translation key for the unit shown beside the value. */
  unit: string;
  min: number;
  max: number;
  /** Slider positions are spaced by ratio, not by difference. */
  logarithmic: boolean;
  /** Decimal places for the readout. */
  precision: number;
  /**
   * Measured from the central body rather than being the body's own, so the
   * central body has no value of its own for it.
   */
  fromCentre: boolean;
};

export const sandboxFields: FieldSpec[] = [
  {
    id: 'mass',
    kind: 'dynamical',
    label: '质量',
    unit: 'kg',
    min: 1e16,
    max: 1e31,
    logarithmic: true,
    precision: 3,
    fromCentre: false,
  },
  {
    id: 'speed',
    kind: 'dynamical',
    label: '轨道速度',
    unit: 'km/s',
    min: 0,
    max: 120,
    logarithmic: false,
    precision: 3,
    fromCentre: true,
  },
  {
    id: 'distance',
    kind: 'dynamical',
    label: '日心距离',
    unit: 'AU',
    min: 0.02,
    max: 120,
    logarithmic: true,
    precision: 3,
    fromCentre: true,
  },
  {
    id: 'radius',
    kind: 'appearance',
    label: '半径',
    unit: 'km',
    min: 1,
    max: 2e6,
    logarithmic: true,
    precision: 0,
    fromCentre: false,
  },
  {
    id: 'spinDays',
    kind: 'appearance',
    label: '自转周期',
    unit: '天',
    min: -500,
    max: 500,
    logarithmic: false,
    precision: 3,
    fromCentre: false,
  },
  {
    id: 'tilt',
    kind: 'appearance',
    label: '轴倾角',
    unit: '°',
    min: 0,
    max: 180,
    logarithmic: false,
    precision: 1,
    fromCentre: false,
  },
];

export function fieldSpec(id: SandboxField) {
  return sandboxFields.find((field) => field.id === id)!;
}

/** Slider position in [0, 1] for a value, spaced by ratio where that reads better. */
export function fieldPosition(spec: FieldSpec, value: number) {
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  if (!spec.logarithmic)
    return (clamped - spec.min) / (spec.max - spec.min || 1);
  const low = Math.log(Math.max(spec.min, Number.EPSILON));
  return (
    (Math.log(Math.max(clamped, Number.EPSILON)) - low) /
    (Math.log(spec.max) - low)
  );
}

/** The value a slider position stands for. */
export function fieldValue(spec: FieldSpec, position: number) {
  const ratio = Math.min(1, Math.max(0, position));
  if (!spec.logarithmic) return spec.min + ratio * (spec.max - spec.min);
  const low = Math.log(Math.max(spec.min, Number.EPSILON));
  return Math.exp(low + ratio * (Math.log(spec.max) - low));
}

function length(vector: Vec3) {
  return Math.hypot(...vector);
}

function scaled(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function plus(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function minus(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** The body everything else is measured against: the heaviest present. */
export function centralBody<T extends { mass: number }>(
  list: readonly T[],
): T | undefined {
  return list.reduce<T | undefined>(
    (heaviest, body) =>
      !heaviest || body.mass > heaviest.mass ? body : heaviest,
    undefined,
  );
}

/**
 * What a body's distance and speed are measured from: the central body where
 * it is and as it moves now.
 *
 * A run starts in the frame of its fork, with the Sun at rest at the origin,
 * but the Sun does not stay there. It circles the system's centre of mass,
 * and a heavy companion sets it drifting. Measured from where it started,
 * Earth read 0.79 AU from the Sun a century on, and with Jupiter made four
 * hundred times heavier a body added 3 AU out landed 6 AU from the Sun and
 * flew off. Measured from the Sun as it is, each means what its label says.
 */
export type Centre = { position: Vec3; velocity: Vec3; massKg: number };

/** The centre a point mass sets, or the fork's own origin without one. */
export function centreOf(point: PointMass | undefined): Centre {
  return point
    ? {
        position: point.position,
        velocity: point.velocity,
        massKg: point.mass * SOLAR_MASS_KG,
      }
    : { position: [0, 0, 0], velocity: [0, 0, 0], massKg: SOLAR_MASS_KG };
}

export function readField(
  spec: SandboxBodySpec,
  field: SandboxField,
  centre: Centre,
): number {
  switch (field) {
    case 'mass':
      return spec.mass;
    case 'speed':
      return auPerDayToKmPerSecond(
        length(minus(spec.velocity, centre.velocity)),
      );
    case 'distance':
      return length(minus(spec.position, centre.position));
    case 'radius':
      return spec.radius;
    case 'spinDays':
      return spec.spinDays;
    case 'tilt':
      return spec.tilt;
  }
}

/**
 * A copy of `spec` with one field changed.
 *
 * Speed rescales the velocity relative to the centre, which keeps the
 * direction the body is already travelling. Distance moves it along its
 * current radius from the centre and re-places it on a circular orbit there:
 * carrying the old speed to a new radius would make every move either an
 * escape or a plunge, which hides the change the viewer actually asked for
 * behind an accident. Either way the body keeps moving with the centre.
 */
export function writeField(
  spec: SandboxBodySpec,
  field: SandboxField,
  value: number,
  centre: Centre,
): SandboxBodySpec {
  const limits = fieldSpec(field);
  const safe = Math.min(limits.max, Math.max(limits.min, value));
  switch (field) {
    case 'mass':
      return { ...spec, mass: safe };
    case 'radius':
      return { ...spec, radius: safe };
    case 'spinDays':
      return { ...spec, spinDays: safe };
    case 'tilt':
      return { ...spec, tilt: safe };
    case 'speed': {
      const relative = minus(spec.velocity, centre.velocity);
      const current = length(relative);
      const wanted = kmPerSecondToAuPerDay(safe);
      const motion: Vec3 =
        current === 0 ? [0, 0, wanted] : scaled(relative, wanted / current);
      return { ...spec, velocity: plus(centre.velocity, motion) };
    }
    case 'distance': {
      const offset = minus(spec.position, centre.position);
      const radius = length(offset);
      if (radius === 0) {
        const state = circularState(safe, 0, centre.massKg);
        return {
          ...spec,
          position: plus(centre.position, state.position),
          velocity: plus(centre.velocity, state.velocity),
        };
      }
      const unit = scaled(offset, 1 / radius);
      const momentum = cross(offset, minus(spec.velocity, centre.velocity));
      const spin = length(momentum);
      // With no angular momentum to preserve, fall back to the ecliptic.
      const normal: Vec3 = spin > 0 ? scaled(momentum, 1 / spin) : [0, 1, 0];
      const along = cross(normal, unit);
      const speed = circularSpeed(safe, centre.massKg);
      return {
        ...spec,
        position: plus(centre.position, scaled(unit, safe)),
        velocity: plus(centre.velocity, scaled(along, speed)),
      };
    }
  }
}

/** The catalogue values a forked body can be restored to. */
export function catalogueDefaults(sourceId: string | null) {
  const source = sandboxSources.find((item) => item.id === sourceId);
  const catalogue = bodies.find((item) => item.id === sourceId);
  if (!source || !catalogue) return null;
  return {
    mass: catalogueMass(source.astro),
    radius: catalogue.radius,
    spinDays: catalogue.day,
    tilt: catalogue.tilt,
  };
}

export type NewBody = {
  name: string;
  /** Kilograms. */
  mass: number;
  /** Kilometres. */
  radius: number;
  /** Distance from the central body in AU, on a circular orbit around it. */
  distance: number;
  color: string;
};

/**
 * A distance typed into the add form, held to the range the distance field
 * allows. Anything that is not a positive number falls back to `fallback`.
 */
export function typedDistance(text: string, fallback = 3) {
  const value = Number(text);
  const { min, max } = fieldSpec('distance');
  return Number.isFinite(value) && value > 0
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Angle, in radians, that keeps an added body clear of the last one added. */
const ADDED_SPACING = 2.399963;

/**
 * Resolves a description into a body the run can carry, on a circular orbit.
 * Successive additions are spread by the golden angle so a handful of new
 * bodies do not all start on the same ray and immediately merge.
 */
export function createdBody(
  body: NewBody,
  index: number,
  centre: Centre,
  id: string,
): SandboxBodySpec {
  // The circular speed follows the two-body mu, so a heavy addition starts
  // on a circle too rather than on a quietly eccentric orbit.
  const orbit = circularState(
    body.distance,
    index * ADDED_SPACING,
    centre.massKg + body.mass,
  );
  return {
    id,
    sourceId: null,
    name: body.name,
    color: body.color,
    mass: body.mass,
    radius: body.radius,
    spinDays: 1,
    tilt: 0,
    position: plus(centre.position, orbit.position),
    velocity: plus(centre.velocity, orbit.velocity),
  };
}

/** Escape speed from the central body at a given distance, in km/s. */
export function escapeSpeedAt(distanceAu: number, centralMassKg: number) {
  return auPerDayToKmPerSecond(
    Math.sqrt(
      (2 * GRAVITY * (centralMassKg / SOLAR_MASS_KG)) /
        Math.max(distanceAu, 1e-9),
    ),
  );
}
