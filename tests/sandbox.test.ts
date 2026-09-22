import test from 'node:test';
import assert from 'node:assert/strict';
import { HelioVector } from 'astronomy-engine';
import { sceneVector } from '../lib/ephemeris.ts';
import { J2000_MS } from '../lib/simulation-time.ts';
import {
  GRAVITY,
  SOLAR_MASS_KG,
  accelerations,
  advance,
  barycenter,
  mergeContacts,
  suggestedStep,
  systemEnergy,
  zeroVectors,
  type PointMass,
  type Vec3,
} from '../lib/sandbox/physics.ts';
import {
  circularState,
  circularSpeed,
  forkScenario,
  kmToAu,
  sandboxSources,
  daysFromEpoch,
} from '../lib/sandbox/scenario.ts';
import {
  density,
  escapeVelocity,
  orbitState,
  surfaceGravity,
} from '../lib/sandbox/derived.ts';
import { createRun, MAX_STEPS_PER_ADVANCE } from '../lib/sandbox/run.ts';
import {
  addBody,
  centralBody,
  escapeSpeedAt,
  fieldPosition,
  fieldSpec,
  fieldValue,
  readField,
  removeBody,
  resetBody,
  sandboxFields,
  updateBody,
  writeField,
  type SandboxField,
} from '../lib/sandbox/edits.ts';

const point = (
  id: string,
  mass: number,
  position: Vec3,
  velocity: Vec3,
  radius = 0,
): PointMass => ({ id, mass, radius, position, velocity });

void test('a circular orbit keeps Kepler’s third law and closes on itself', () => {
  const period = 2 * Math.PI * Math.sqrt(1 / GRAVITY);
  // One astronomical unit around one solar mass is one sidereal year.
  assert.ok(Math.abs(period - 365.2569) < 1e-3);
  const speed = circularSpeed(1, SOLAR_MASS_KG);
  const points = [
    point('centre', 1, [0, 0, 0], [0, 0, 0]),
    point('probe', 0, [1, 0, 0], [0, 0, -speed]),
  ];
  const acceleration = zeroVectors(2);
  accelerations(points, acceleration);
  const steps = 20_000;
  for (let index = 0; index < steps; index++)
    advance(points, period / steps, acceleration);
  assert.ok(
    Math.hypot(
      points[1].position[0] - 1,
      points[1].position[1],
      points[1].position[2],
    ) < 1e-6,
  );
});

void test('an added body starts prograde, matching the scene’s orbit convention', () => {
  const { position, velocity } = circularState(2, 0.7, SOLAR_MASS_KG);
  // Angular momentum about ecliptic north is positive for prograde motion,
  // the same convention lib/solar.ts and its orbit test protect.
  const northward = position[2] * velocity[0] - position[0] * velocity[2];
  assert.ok(northward > 0);
  assert.ok(Math.abs(Math.hypot(...position) - 2) < 1e-12);
  assert.ok(Math.abs(position[1]) < 1e-12 && Math.abs(velocity[1]) < 1e-12);
});

void test('the integrator reproduces a year of real ephemeris motion', () => {
  const run = createRun(forkScenario(J2000_MS));
  const year = 365.25;
  while (run.elapsedDays < year)
    run.advance(Math.min(60, year - run.elapsedDays));
  const days = daysFromEpoch(J2000_MS) + run.elapsedDays;
  const sun = run.variant.find((body) => body.id === 'sun')!;
  // The residual is the model's distance from reality, not the integrator's:
  // halving the step does not reduce it. It is dominated by the general
  // relativistic precession this Newtonian model omits, which is why Mercury
  // carries the largest share, and by carrying Earth and the Moon as their
  // barycenter. Every figure here is far below one pixel on screen.
  const tolerance: Record<string, number> = {
    mercury: 3e-3,
    venus: 1e-3,
    earth: 2e-3,
    mars: 1e-3,
    jupiter: 5e-4,
    saturn: 5e-4,
    uranus: 5e-4,
    neptune: 5e-4,
    pluto: 5e-4,
  };
  for (const { id, astro } of sandboxSources) {
    if (id === 'sun') continue;
    const truth = sceneVector(HelioVector(astro, days));
    const body = run.variant.find((item) => item.id === id)!;
    const error = Math.hypot(
      ...body.position.map(
        (value, axis) => value - sun.position[axis] - truth[axis],
      ),
    );
    assert.ok(error < tolerance[id], `${id}: ${error.toExponential(2)} AU`);
  }
});

void test('a symplectic step keeps the total energy bounded over a century', () => {
  const run = createRun(forkScenario(J2000_MS));
  const century = 365.25 * 100;
  while (run.elapsedDays < century)
    run.advance(Math.min(200, century - run.elapsedDays));
  assert.ok(run.energyDrift < 1e-4, String(run.energyDrift));
  assert.ok(run.variant.every((body) => body.position.every(Number.isFinite)));
});

void test('the baseline tracks the untouched system while edits move the variant', () => {
  const scenario = forkScenario(J2000_MS);
  const jupiter = scenario.bodies.find((body) => body.id === 'jupiter')!;
  jupiter.mass *= 50;
  const run = createRun(scenario);
  while (run.elapsedDays < 365.25 * 20) run.advance(120);
  const changed = run.variant.find((body) => body.id === 'jupiter')!;
  const original = run.baseline.find((body) => body.id === 'jupiter')!;
  assert.ok(Math.abs(changed.mass / original.mass - 50) < 1e-9);
  // Both systems are sampled on the same steps, so any separation between the
  // two paths is the edit's doing and nothing else.
  assert.equal(
    run.trails.get('earth')!.length,
    run.baselineTrails.get('earth')!.length,
  );
  const drift = Math.hypot(
    ...run.variant
      .find((body) => body.id === 'earth')!
      .position.map(
        (value, axis) =>
          value - run.baseline.find((b) => b.id === 'earth')!.position[axis],
      ),
  );
  assert.ok(drift > 1e-3, `expected a visible divergence, got ${drift}`);
});

void test('raising a body’s speed past the escape threshold reports an escape', () => {
  const scenario = forkScenario(J2000_MS);
  const earth = scenario.bodies.find((body) => body.id === 'earth')!;
  earth.velocity = earth.velocity.map((value) => value * 1.6) as Vec3;
  const run = createRun(scenario);
  run.advance(30);
  assert.ok(
    run.events.some((event) => event.kind === 'escape' && event.id === 'earth'),
  );
  const sun = run.variant.find((body) => body.id === 'sun')!;
  assert.ok(
    orbitState(
      run.variant.find((b) => b.id === 'earth')!,
      sun,
    ).escaping,
  );
  // The untouched copy stays bound, which is the whole point of carrying it.
  const baselineSun = run.baseline.find((body) => body.id === 'sun')!;
  assert.equal(
    orbitState(
      run.baseline.find((b) => b.id === 'earth')!,
      baselineSun,
    ).escaping,
    false,
  );
});

void test('touching bodies merge, conserving mass and momentum', () => {
  const radius = kmToAu(6371);
  const points = [
    point('a', 3e-6, [0, 0, 0], [0, 0.001, 0], radius),
    point('b', 1e-6, [radius * 1.5, 0, 0], [0, -0.003, 0], radius),
  ];
  const before = barycenter(points);
  const collisions = mergeContacts(points);
  assert.deepEqual(collisions, [{ absorbed: 'b', into: 'a' }]);
  assert.equal(points.length, 1);
  assert.ok(Math.abs(points[0].mass - 4e-6) < 1e-18);
  const after = barycenter(points);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(Math.abs(after.velocity[axis] - before.velocity[axis]) < 1e-15);
  // Volumes add, so the merged body is larger than either original.
  assert.ok(Math.abs(points[0].radius - radius * Math.cbrt(2)) < 1e-15);
});

void test('the step follows the tightest pair and the advance honours its ceiling', () => {
  const solar = forkScenario(J2000_MS);
  const wide = createRun(solar);
  wide.advance(1);
  const close = forkScenario(J2000_MS);
  close.bodies.push({
    id: 'inner',
    sourceId: null,
    name: 'Inner',
    color: '#ffffff',
    mass: 1e21,
    radius: 1000,
    spinDays: 1,
    tilt: 0,
    ...circularState(0.05, 0, close.bodies[0].mass),
  });
  const tight = createRun(close);
  tight.advance(1);
  assert.ok(
    tight.step < wide.step,
    `${tight.step} should be under ${wide.step}`,
  );
  assert.ok(suggestedStep(tight.variant) < suggestedStep(wide.variant));
  const burst = createRun(forkScenario(J2000_MS));
  burst.advance(1e6);
  assert.equal(burst.steps, MAX_STEPS_PER_ADVANCE);
  assert.ok(burst.throttled);
  assert.ok(burst.elapsedDays < 1e6);
});

void test('derived figures reproduce the published values for Earth', () => {
  // JPL: 5.9722 × 10²⁴ kg, mean radius 6371 km.
  assert.ok(Math.abs(density(5.9722e24, 6371) - 5.513) < 0.01);
  assert.ok(Math.abs(surfaceGravity(5.9722e24, 6371) - 9.82) < 0.02);
  assert.ok(Math.abs(escapeVelocity(5.9722e24, 6371) - 11.19) < 0.02);
});

void test('osculating elements recover a known orbit from its state vectors', () => {
  const sun = point('sun', 1, [0, 0, 0], [0, 0, 0]);
  const speed = circularSpeed(1, SOLAR_MASS_KG);
  const circular = orbitState(
    point('probe', 0, [1, 0, 0], [0, 0, -speed]),
    sun,
  );
  assert.ok(circular.eccentricity < 1e-12);
  assert.ok(Math.abs(circular.semimajor - 1) < 1e-12);
  assert.ok(Math.abs(circular.period! - 365.2569) < 1e-3);
  assert.ok(Math.abs(circular.inclination) < 1e-9);
  assert.equal(circular.escaping, false);
  // Above √2 times the circular speed the orbit is open and has no period.
  const open = orbitState(
    point('probe', 0, [1, 0, 0], [0, 0, -speed * 1.5]),
    sun,
  );
  assert.ok(open.eccentricity > 1);
  assert.equal(open.period, null);
  assert.equal(open.aphelion, null);
  assert.ok(open.escaping);
});

void test('an emptied or single-body scenario advances without failing', () => {
  const empty = createRun({ epoch: J2000_MS, bodies: [] });
  empty.advance(10);
  assert.equal(empty.elapsedDays, 0);
  const lone = forkScenario(J2000_MS);
  lone.bodies = lone.bodies.filter((body) => body.id === 'sun');
  const run = createRun(lone);
  run.advance(100);
  assert.ok(run.elapsedDays > 0);
  assert.equal(run.energyDrift, 0);
  assert.ok(run.variant[0].position.every(Number.isFinite));
  assert.equal(systemEnergy(run.variant), 0);
});

void test('slider positions round-trip through both linear and ratio spacing', () => {
  for (const spec of sandboxFields) {
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const value = fieldValue(spec, ratio);
      // A ratio-spaced field reaches 10^31, where an absolute epsilon means
      // nothing; compare against the range the value sits in.
      const slack = Math.max(Math.abs(spec.max), 1) * 1e-12;
      assert.ok(
        value >= spec.min - slack && value <= spec.max + slack,
        `${spec.id}: ${value}`,
      );
      assert.ok(
        Math.abs(fieldPosition(spec, value) - ratio) < 1e-9,
        `${spec.id}: ${fieldPosition(spec, value)} vs ${ratio}`,
      );
    }
    // A ratio-spaced field puts its midpoint at the geometric mean, which is
    // the whole reason mass and radius are not linear.
    if (spec.logarithmic)
      assert.ok(
        Math.abs(fieldValue(spec, 0.5) / Math.sqrt(spec.min * spec.max) - 1) <
          1e-9,
        spec.id,
      );
  }
});

void test('every field reads back exactly what was written', () => {
  const scenario = forkScenario(J2000_MS);
  const sun = centralBody(scenario);
  assert.equal(sun.id, 'sun');
  const earth = scenario.bodies.find((body) => body.id === 'earth')!;
  const cases: [SandboxField, number][] = [
    ['mass', 1.2e25],
    ['speed', 41.3],
    ['distance', 2.5],
    ['radius', 9000],
    ['spinDays', -3.25],
    ['tilt', 97.7],
  ];
  for (const [field, value] of cases) {
    const written = writeField(earth, field, value, sun.mass);
    assert.ok(
      Math.abs(readField(written, field) - value) < 1e-6,
      `${field}: ${readField(written, field)}`,
    );
  }
});

void test('a field is clamped to its own range rather than accepting nonsense', () => {
  const scenario = forkScenario(J2000_MS);
  const sun = centralBody(scenario);
  const earth = scenario.bodies.find((body) => body.id === 'earth')!;
  const heavy = writeField(earth, 'mass', 1e40, sun.mass);
  assert.equal(heavy.mass, fieldSpec('mass').max);
  const tiny = writeField(earth, 'radius', -50, sun.mass);
  assert.equal(tiny.radius, fieldSpec('radius').min);
});

void test('moving a body re-places it on a circular orbit in its own plane', () => {
  const scenario = forkScenario(J2000_MS);
  const sun = centralBody(scenario);
  const pluto = scenario.bodies.find((body) => body.id === 'pluto')!;
  const before = orbitState(
    {
      id: 'p',
      mass: 0,
      radius: 0,
      position: pluto.position,
      velocity: pluto.velocity,
    },
    { id: 's', mass: 1, radius: 0, position: [0, 0, 0], velocity: [0, 0, 0] },
  );
  const moved = writeField(pluto, 'distance', 5, sun.mass);
  const after = orbitState(
    {
      id: 'p',
      mass: 0,
      radius: 0,
      position: moved.position,
      velocity: moved.velocity,
    },
    { id: 's', mass: 1, radius: 0, position: [0, 0, 0], velocity: [0, 0, 0] },
  );
  assert.ok(Math.abs(Math.hypot(...moved.position) - 5) < 1e-9);
  assert.ok(after.eccentricity < 1e-6, String(after.eccentricity));
  // Pluto's steep orbit is preserved: only the distance was asked for.
  assert.ok(Math.abs(after.inclination - before.inclination) < 1e-6);
});

void test('scaling a body’s speed keeps its heading', () => {
  const scenario = forkScenario(J2000_MS);
  const sun = centralBody(scenario);
  const mars = scenario.bodies.find((body) => body.id === 'mars')!;
  const faster = writeField(mars, 'speed', 40, sun.mass);
  const was = Math.hypot(...mars.velocity);
  const now = Math.hypot(...faster.velocity);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      Math.abs(faster.velocity[axis] / now - mars.velocity[axis] / was) < 1e-12,
    );
});

void test('bodies can be added, removed and restored to their catalogue values', () => {
  const forked = forkScenario(J2000_MS);
  const without = removeBody(forked, 'jupiter');
  assert.equal(without.bodies.length, forked.bodies.length - 1);
  assert.ok(!without.bodies.some((body) => body.id === 'jupiter'));
  const added = addBody(without, {
    name: 'Nemesis',
    mass: 1e29,
    radius: 60000,
    distance: 8,
    color: '#ff0000',
  });
  const created = added.bodies.at(-1)!;
  assert.equal(created.sourceId, null);
  assert.ok(Math.abs(Math.hypot(...created.position) - 8) < 1e-9);
  // Added bodies start on a circular orbit, so one does not immediately fall in.
  const state = orbitState(
    {
      id: created.id,
      mass: 0,
      radius: 0,
      position: created.position,
      velocity: created.velocity,
    },
    { id: 'sun', mass: 1, radius: 0, position: [0, 0, 0], velocity: [0, 0, 0] },
  );
  assert.ok(state.eccentricity < 1e-6);
  assert.equal(state.escaping, false);
  // A second addition is placed away from the first.
  const twice = addBody(added, {
    name: 'Nemesis II',
    mass: 1e29,
    radius: 60000,
    distance: 8,
    color: '#00ff00',
  });
  const second = twice.bodies.at(-1)!;
  assert.ok(
    Math.hypot(
      ...second.position.map((value, axis) => value - created.position[axis]),
    ) > 1,
  );
  const edited = updateBody(forked, 'earth', 'mass', 9e25);
  assert.equal(edited.bodies.find((body) => body.id === 'earth')!.mass, 9e25);
  const restored = resetBody(edited, 'earth');
  const original = forked.bodies.find((body) => body.id === 'earth')!;
  assert.equal(
    restored.bodies.find((b) => b.id === 'earth')!.mass,
    original.mass,
  );
  // A body the viewer created has no catalogue entry to fall back to.
  assert.deepEqual(resetBody(twice, second.id), twice);
});

void test('an edited scenario runs, and the escape threshold matches the model', () => {
  const scenario = forkScenario(J2000_MS);
  const sun = centralBody(scenario);
  const earth = scenario.bodies.find((body) => body.id === 'earth')!;
  const escape = escapeSpeedAt(Math.hypot(...earth.position), sun.mass);
  // Earth orbits at about 29.8 km/s and leaves above roughly 42 km/s.
  assert.ok(Math.abs(escape - 42.1) < 0.4, String(escape));
  const run = createRun(updateBody(scenario, 'earth', 'speed', escape * 1.05));
  run.advance(60);
  assert.ok(
    run.events.some((event) => event.kind === 'escape' && event.id === 'earth'),
  );
  const bound = createRun(
    updateBody(scenario, 'earth', 'speed', escape * 0.95),
  );
  bound.advance(60);
  assert.ok(!bound.events.some((event) => event.kind === 'escape'));
});
