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
