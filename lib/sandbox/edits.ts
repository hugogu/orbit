/**
 * The editable parameter model.
 *
 * One description of every field the viewer can change — its unit, its range,
 * and whether it actually enters the force law. The editor, the validator and
 * anything that later writes a scenario all read this, so a parameter cannot
 * mean one thing in the panel and another in the physics.
 */
import { bodies } from '../solar';
import { GRAVITY, SOLAR_MASS_KG, type Vec3 } from './physics';
import {
  catalogueMass,
  circularSpeed,
  circularState,
  sandboxSources,
  type SandboxBodySpec,
  type SandboxScenario,
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

export type SandboxField =
  | 'mass'
  | 'speed'
  | 'distance'
  | 'radius'
  | 'spinDays'
  | 'tilt';

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

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** The body everything else is measured against: the heaviest in the run. */
export function centralBody(scenario: SandboxScenario) {
  return scenario.bodies.reduce(
    (heaviest, body) => (body.mass > heaviest.mass ? body : heaviest),
    scenario.bodies[0],
  );
}

export function readField(spec: SandboxBodySpec, field: SandboxField): number {
  switch (field) {
    case 'mass':
      return spec.mass;
    case 'speed':
      return auPerDayToKmPerSecond(length(spec.velocity));
    case 'distance':
      return length(spec.position);
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
 * Speed rescales the velocity vector, which keeps the direction the body is
 * already travelling. Distance moves it along its current radius and re-places
 * it on a circular orbit there: carrying the old speed to a new radius would
 * make every move either an escape or a plunge, which hides the change the
 * viewer actually asked for behind an accident.
 */
export function writeField(
  spec: SandboxBodySpec,
  field: SandboxField,
  value: number,
  centralMassKg: number,
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
      const current = length(spec.velocity);
      const wanted = kmPerSecondToAuPerDay(safe);
      if (current === 0) return { ...spec, velocity: [0, 0, wanted] };
      return { ...spec, velocity: scaled(spec.velocity, wanted / current) };
    }
    case 'distance': {
      const radius = length(spec.position);
      if (radius === 0)
        return { ...spec, ...circularState(safe, 0, centralMassKg) };
      const unit = scaled(spec.position, 1 / radius);
      const momentum = cross(spec.position, spec.velocity);
      const spin = length(momentum);
      // With no angular momentum to preserve, fall back to the ecliptic.
      const normal: Vec3 = spin > 0 ? scaled(momentum, 1 / spin) : [0, 1, 0];
      const along = cross(normal, unit);
      const speed = circularSpeed(safe, centralMassKg);
      return {
        ...spec,
        position: scaled(unit, safe),
        velocity: scaled(along, speed),
      };
    }
  }
}

export function updateBody(
  scenario: SandboxScenario,
  id: string,
  field: SandboxField,
  value: number,
): SandboxScenario {
  const centre = centralBody(scenario);
  return {
    ...scenario,
    bodies: scenario.bodies.map((body) =>
      body.id === id
        ? writeField(body, field, value, centre?.mass ?? SOLAR_MASS_KG)
        : body,
    ),
  };
}

export function removeBody(
  scenario: SandboxScenario,
  id: string,
): SandboxScenario {
  return {
    ...scenario,
    bodies: scenario.bodies.filter((body) => body.id !== id),
  };
}

/** Restores a forked body to the catalogue values it started from. */
export function resetBody(
  scenario: SandboxScenario,
  id: string,
): SandboxScenario {
  const body = scenario.bodies.find((item) => item.id === id);
  const source = sandboxSources.find((item) => item.id === body?.sourceId);
  const catalogue = bodies.find((item) => item.id === body?.sourceId);
  if (!body || !source || !catalogue) return scenario;
  return {
    ...scenario,
    bodies: scenario.bodies.map((item) =>
      item.id === id
        ? {
            ...item,
            mass: catalogueMass(source.astro),
            radius: catalogue.radius,
            spinDays: catalogue.day,
            tilt: catalogue.tilt,
          }
        : item,
    ),
  };
}

export type NewBody = {
  name: string;
  /** Kilograms. */
  mass: number;
  /** Kilometres. */
  radius: number;
  /** Heliocentric distance in AU; the body is placed on a circular orbit. */
  distance: number;
  color: string;
};

/** Angle, in radians, that keeps an added body clear of the last one added. */
const ADDED_SPACING = 2.399963;

export function addBody(
  scenario: SandboxScenario,
  body: NewBody,
): SandboxScenario {
  const added = scenario.bodies.filter((item) => !item.sourceId).length;
  const centre = centralBody(scenario);
  return {
    ...scenario,
    bodies: [
      ...scenario.bodies,
      {
        id: `added-${added + 1}-${Math.round(scenario.epoch % 1e7)}`,
        sourceId: null,
        name: body.name,
        color: body.color,
        mass: body.mass,
        radius: body.radius,
        spinDays: 1,
        tilt: 0,
        // Successive additions are spread by the golden angle so a handful of
        // new bodies do not all start on the same ray and immediately merge.
        ...circularState(
          body.distance,
          added * ADDED_SPACING,
          centre?.mass ?? SOLAR_MASS_KG,
        ),
      },
    ],
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
