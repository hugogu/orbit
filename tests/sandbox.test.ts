import test from 'node:test';
import { readFileSync } from 'node:fs';
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
  positionAfter,
  systemEnergy,
  zeroVectors,
  type PointMass,
  type Vec3,
} from '../lib/sandbox/physics.ts';
import {
  circularState,
  circularSpeed,
  forkBodies,
  forkScenario,
  kmToAu,
  sandboxSources,
  daysFromEpoch,
  rewoundScenario,
  type SandboxBodySpec,
} from '../lib/sandbox/scenario.ts';
import {
  auPerDayToKmPerSecond,
  density,
  escapeVelocity,
  orbitState,
  surfaceGravity,
} from '../lib/sandbox/derived.ts';
import {
  createRun,
  MAX_STEPS_PER_ADVANCE,
  type SandboxRun,
} from '../lib/sandbox/run.ts';
import { decodeSandbox, encodeSandbox } from '../lib/sandbox/share.ts';
import { scenePosition } from '../lib/sandbox/display.ts';
import { moonState, sandboxMoons } from '../lib/sandbox/moons.ts';
import { AU_KM } from '../lib/eclipse-shadows.ts';
import { createSandboxTrail, smoothed } from '../components/sandbox-trail.ts';
import { createSandboxSystem } from '../components/sandbox-system.ts';
import { isOrbitLine } from '../components/orbit-line.ts';
import SandboxPanel, {
  foldedLabel,
  nextColor,
} from '../components/sandbox-panel.tsx';
import { translator } from '../lib/i18n/index.ts';
import SandboxBodyEditor from '../components/sandbox-body-editor.tsx';
import { I18nProvider } from '../lib/i18n/provider.tsx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Group, Scene, Vector3 } from 'three';
import {
  catalogueDefaults,
  centralBody,
  centreOf,
  referenceBody,
  createdBody,
  escapeSpeedAt,
  fieldPosition,
  fieldSpec,
  fieldValue,
  nextAddition,
  readField,
  sandboxFields,
  typedDistance,
  writeField,
  type Centre,
  type SandboxField,
} from '../lib/sandbox/edits.ts';

const point = (
  id: string,
  mass: number,
  position: Vec3,
  velocity: Vec3,
  radius = 0,
): PointMass => ({ id, mass, radius, position, velocity });

/**
 * Advances a run in helpings of `chunk` days until it stops on the last whole
 * step at or before `target`, so two runs driven differently can be compared
 * at one moment rather than two.
 */
const driveTo = (run: SandboxRun, target: number, chunk: number) => {
  for (let guard = 0; guard < 4000; guard += 1) {
    const before = run.elapsedDays;
    run.advance(Math.min(chunk, target - before));
    if (run.elapsedDays === before) return;
  }
};

/** The centre a body sets, for reading and writing fields against it. */
const around = (body: SandboxBodySpec): Centre => ({
  position: body.position,
  velocity: body.velocity,
  massKg: body.mass,
});

/** Adds a body the way the page does, and returns the id it was given. */
const addBody = (run: SandboxRun, name: string) => {
  const { id, index } = nextAddition(run);
  const color = nextColor(run);
  run.apply((current) => ({
    kind: 'add',
    body: createdBody(
      { name, mass: 6e24, radius: 6400, distance: 3, color },
      index,
      centreOf(centralBody(current.variant)),
      id,
    ),
  }));
  return id;
};

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
  const run = createRun(forkScenario(J2000_MS));
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  while (run.elapsedDays < 365.25 * 20) run.advance(120);
  const changed = run.variant.find((body) => body.id === 'jupiter')!;
  const original = run.baseline.find((body) => body.id === 'jupiter')!;
  assert.ok(changed.mass > original.mass * 40);
  // Both paths are kept from the same fork, so any separation between them is
  // the edit's doing and nothing else.
  assert.deepEqual(
    run.trails.get('earth')![0],
    run.baselineTrails.get('earth')![0],
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
  const run = createRun(forkScenario(J2000_MS));
  run.apply({ kind: 'set', id: 'earth', field: 'speed', value: 48 });
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
  assert.deepEqual(collisions, [
    { absorbed: 'b', into: 'a', position: [radius * 1.5, 0, 0] },
  ]);
  assert.equal(points.length, 1);
  assert.ok(Math.abs(points[0].mass - 4e-6) < 1e-18);
  const after = barycenter(points);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(Math.abs(after.velocity[axis] - before.velocity[axis]) < 1e-15);
  // Volumes add, so the merged body is larger than either original.
  assert.ok(Math.abs(points[0].radius - radius * Math.cbrt(2)) < 1e-15);
});

void test('the step follows the tightest pair and the advance honours its ceiling', () => {
  const wide = createRun(forkScenario(J2000_MS));
  wide.advance(1);
  const tight = createRun(forkScenario(J2000_MS));
  tight.apply({
    kind: 'add',
    body: createdBody(
      {
        name: 'Inner',
        mass: 1e21,
        radius: 1000,
        distance: 0.05,
        color: '#fff',
      },
      0,
      centreOf(centralBody(tight.variant)),
      'inner',
    ),
  });
  tight.advance(1);
  assert.ok(
    tight.step < wide.step,
    `${tight.step} should be under ${wide.step}`,
  );
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

void test('an emptied or single-body run advances without failing', () => {
  const lone = createRun(forkScenario(J2000_MS));
  for (const body of lone.facts)
    if (body.id !== 'sun') lone.apply({ kind: 'remove', id: body.id });
  lone.advance(100);
  assert.ok(lone.elapsedDays > 0);
  // One body has no interactions, so there is no energy for the step to lose.
  assert.equal(lone.energyDrift, 0);
  assert.ok(lone.variant[0].position.every(Number.isFinite));
  assert.equal(systemEnergy(lone.variant), 0);
  const empty = createRun(forkScenario(J2000_MS));
  for (const body of empty.facts) empty.apply({ kind: 'remove', id: body.id });
  empty.advance(10);
  assert.equal(empty.elapsedDays, 0);
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
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  assert.equal(sun.id, 'sun');
  const earth = start.find((body) => body.id === 'earth')!;
  const cases: [SandboxField, number][] = [
    ['mass', 1.2e25],
    ['speed', 41.3],
    ['distance', 2.5],
    ['radius', 9000],
    ['spinDays', -3.25],
    ['tilt', 97.7],
  ];
  for (const [field, value] of cases) {
    const written = writeField(earth, field, value, around(sun));
    assert.ok(
      Math.abs(readField(written, field, around(sun)) - value) < 1e-6,
      `${field}: ${readField(written, field, around(sun))}`,
    );
  }
});

void test('a field is clamped to its own range rather than accepting nonsense', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const earth = start.find((body) => body.id === 'earth')!;
  assert.equal(
    writeField(earth, 'mass', 1e40, around(sun)).mass,
    fieldSpec('mass').max,
  );
  assert.equal(
    writeField(earth, 'radius', -50, around(sun)).radius,
    fieldSpec('radius').min,
  );
});

void test('moving a body re-places it on a circular orbit in its own plane', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const pluto = start.find((body) => body.id === 'pluto')!;
  const centre = point('s', 1, [0, 0, 0], [0, 0, 0]);
  const before = orbitState(
    point('p', 0, pluto.position, pluto.velocity),
    centre,
  );
  const moved = writeField(pluto, 'distance', 5, around(sun));
  const after = orbitState(
    point('p', 0, moved.position, moved.velocity),
    centre,
  );
  assert.ok(Math.abs(Math.hypot(...moved.position) - 5) < 1e-9);
  assert.ok(after.eccentricity < 1e-6, String(after.eccentricity));
  // Pluto's steep orbit is preserved: only the distance was asked for.
  assert.ok(Math.abs(after.inclination - before.inclination) < 1e-6);
});

void test('distance and speed are measured from the central body as it moves', () => {
  // Jupiter four hundred times heavier sets the Sun drifting at several
  // km/s, so the frame the run started in is soon far from the Sun.
  const run = createRun(forkScenario(Date.parse('2026-09-22T00:00:00Z')));
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 8e29 });
  while (run.elapsedDays < 365.25 * 3) run.advance(40);
  const find = (id: string) => run.variant.find((body) => body.id === id)!;
  assert.ok(Math.hypot(...find('sun').position) > 1, 'the Sun should drift');
  const centre = centreOf(find('sun'));
  // Read from the Sun as it is now.
  assert.ok(
    Math.abs(
      readField(run.liveSpec('earth')!, 'distance', centre) -
        orbitState(find('earth'), find('sun')).distance,
    ) < 1e-12,
  );
  // Written from it too: 1 AU out is 1 AU from the Sun, on a circle about it.
  run.apply({ kind: 'set', id: 'earth', field: 'distance', value: 1 });
  const moved = orbitState(find('earth'), find('sun'));
  assert.ok(Math.abs(moved.distance - 1) < 1e-9, String(moved.distance));
  assert.ok(moved.eccentricity < 1e-5, String(moved.eccentricity));
  run.apply({ kind: 'set', id: 'earth', field: 'speed', value: 35 });
  const faster = orbitState(find('earth'), find('sun'));
  assert.ok(Math.abs(auPerDayToKmPerSecond(faster.speed) - 35) < 1e-9);
  // A body added 3 AU out starts on a circle about the Sun, not about the
  // point the run happened to begin from.
  run.apply({
    kind: 'add',
    body: createdBody(
      { name: 'Nova', mass: 6e24, radius: 6400, distance: 3, color: '#fff' },
      0,
      centreOf(find('sun')),
      'added-1',
    ),
  });
  const added = orbitState(find('added-1'), find('sun'));
  assert.ok(Math.abs(added.distance - 3) < 1e-9, String(added.distance));
  assert.ok(added.eccentricity < 1e-6, String(added.eccentricity));
  // The central body is what the others are measured from, so it has no
  // distance or speed of its own to set.
  const sun = structuredClone(find('sun'));
  run.apply({ kind: 'set', id: 'sun', field: 'speed', value: 30 });
  run.apply({ kind: 'set', id: 'sun', field: 'distance', value: 2 });
  assert.deepEqual(find('sun'), sun);
});

void test('the central body offers no distance or speed of its own', () => {
  const run = createRun(forkScenario(J2000_MS));
  const editor = (selected: string) =>
    renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: 'en' },
        createElement(SandboxBodyEditor, {
          run,
          selected,
          daysPerSecond: 20,
          onChange: () => {},
          onReset: () => {},
        }),
      ),
    );
  const sun = editor('sun');
  assert.match(sun, /Mass/);
  assert.doesNotMatch(sun, /Orbital speed|Distance from the Sun/);
  assert.match(sun, /measured from the central body/);
  const earth = editor('earth');
  assert.match(earth, /Orbital speed/);
  assert.match(earth, /Distance from the Sun/);
});

void test('a typed distance is held to the range the field allows', () => {
  assert.equal(typedDistance('3'), 3);
  assert.equal(typedDistance('0.5'), 0.5);
  // Out of range is brought back into it, not passed on to the physics.
  assert.equal(typedDistance('500'), fieldSpec('distance').max);
  assert.equal(typedDistance('0.001'), fieldSpec('distance').min);
  // Blank, zero, negative or not a number at all is no distance: a negative
  // one used to place the body on the far side with a runaway speed.
  for (const text of ['', '0', '-5', 'abc'])
    assert.equal(typedDistance(text), 3);
});

void test('scaling a body’s speed keeps its heading', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const mars = start.find((body) => body.id === 'mars')!;
  const faster = writeField(mars, 'speed', 40, around(sun));
  const was = Math.hypot(...mars.velocity);
  const now = Math.hypot(...faster.velocity);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      Math.abs(faster.velocity[axis] / now - mars.velocity[axis] / was) < 1e-12,
    );
});

void test('bodies can be added, removed and restored to their catalogue values', () => {
  const run = createRun(forkScenario(J2000_MS));
  const before = run.facts.length;
  run.apply({ kind: 'remove', id: 'jupiter' });
  assert.ok(!run.variant.some((body) => body.id === 'jupiter'));
  const centre = centreOf(centralBody(run.variant));
  run.apply({
    kind: 'add',
    body: createdBody(
      {
        name: 'Nemesis',
        mass: 1e29,
        radius: 60000,
        distance: 8,
        color: '#f00',
      },
      0,
      centre,
      'nemesis',
    ),
  });
  const created = run.liveSpec('nemesis')!;
  assert.equal(created.sourceId, null);
  assert.ok(Math.abs(Math.hypot(...created.position) - 8) < 1e-9);
  assert.equal(run.facts.length, before + 1);
  // Added bodies start on a circular orbit, so one does not immediately fall in.
  const state = orbitState(
    run.variant.find((body) => body.id === 'nemesis')!,
    point('sun', 1, [0, 0, 0], [0, 0, 0]),
  );
  assert.ok(state.eccentricity < 1e-6);
  assert.equal(state.escaping, false);
  // A second addition is placed away from the first.
  run.apply({
    kind: 'add',
    body: createdBody(
      {
        name: 'Nemesis II',
        mass: 1e29,
        radius: 60000,
        distance: 8,
        color: '#0f0',
      },
      1,
      centre,
      'nemesis-2',
    ),
  });
  assert.ok(
    Math.hypot(
      ...run
        .liveSpec('nemesis-2')!
        .position.map((value, axis) => value - created.position[axis]),
    ) > 1,
  );
  run.apply({ kind: 'set', id: 'earth', field: 'mass', value: 9e25 });
  assert.ok(Math.abs(run.liveSpec('earth')!.mass - 9e25) < 1e18);
  const defaults = catalogueDefaults('earth')!;
  run.apply({ kind: 'set', id: 'earth', field: 'mass', value: defaults.mass });
  assert.ok(Math.abs(run.liveSpec('earth')!.mass - defaults.mass) < 1e15);
  // A body the viewer created has no catalogue entry to fall back to.
  assert.equal(catalogueDefaults(null), null);
});

void test('the escape threshold matches the model', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const earth = start.find((body) => body.id === 'earth')!;
  const escape = escapeSpeedAt(Math.hypot(...earth.position), sun.mass);
  // Earth orbits at about 29.8 km/s and leaves above roughly 42 km/s.
  assert.ok(Math.abs(escape - 42.1) < 0.4, String(escape));
  const leaving = createRun(forkScenario(J2000_MS));
  leaving.apply({
    kind: 'set',
    id: 'earth',
    field: 'speed',
    value: escape * 1.05,
  });
  leaving.advance(60);
  assert.ok(leaving.events.some((event) => event.kind === 'escape'));
  const bound = createRun(forkScenario(J2000_MS));
  bound.apply({
    kind: 'set',
    id: 'earth',
    field: 'speed',
    value: escape * 0.95,
  });
  bound.advance(60);
  assert.ok(!bound.events.some((event) => event.kind === 'escape'));
});

void test('an edit lands mid-run, keeping the elapsed time and the path so far', () => {
  const run = createRun(forkScenario(J2000_MS));
  while (run.elapsedDays < 400) run.advance(40);
  const beforeEdit = run.shownDays;
  const trailBefore = run.trails.get('jupiter')!.length;
  // Until now the edited system and the untouched one have been identical.
  const together = Math.hypot(
    ...run.variant
      .find((b) => b.id === 'jupiter')!
      .position.map(
        (value, axis) =>
          value - run.baseline.find((b) => b.id === 'jupiter')!.position[axis],
      ),
  );
  assert.equal(together, 0);
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  // It lands at the moment on screen. The clock does not rewind and the
  // ribbon is not thrown away.
  assert.equal(run.shownDays, beforeEdit);
  assert.equal(run.elapsedDays, beforeEdit);
  assert.ok(run.trails.get('jupiter')!.length >= trailBefore);
  assert.equal(run.scenario.changes.length, 1);
  assert.equal(run.scenario.changes[0].at, beforeEdit);
  while (run.elapsedDays < 1200) run.advance(40);
  const apart = Math.hypot(
    ...run.variant
      .find((b) => b.id === 'jupiter')!
      .position.map(
        (value, axis) =>
          value - run.baseline.find((b) => b.id === 'jupiter')!.position[axis],
      ),
  );
  assert.ok(apart > 1e-4, `expected the paths to separate, got ${apart}`);
});

void test('replaying a recipe reproduces the same path, whatever the frame sizes', () => {
  const recipe = forkScenario(J2000_MS);
  const first = createRun(recipe);
  while (first.elapsedDays < 300) first.advance(37);
  first.apply({ kind: 'set', id: 'mars', field: 'speed', value: 30 });
  while (first.elapsedDays < 900) first.advance(53);
  // The same recipe, advanced in quite different chunks: a link has to land
  // the recipient on the path the author saw, not merely a similar one.
  const replay = createRun({
    epoch: recipe.epoch,
    changes: [...recipe.changes],
  });
  for (
    let guard = 0;
    guard < 500 && replay.elapsedDays < first.elapsedDays;
    guard++
  )
    replay.advance(Math.min(7, first.elapsedDays - replay.elapsedDays));
  // Identical step sequences land both on the same boundary, not merely near it.
  assert.equal(replay.elapsedDays, first.elapsedDays);
  for (const body of first.variant) {
    const echo = replay.variant.find((item) => item.id === body.id)!;
    const gap = Math.hypot(
      ...body.position.map((value, axis) => value - echo.position[axis]),
    );
    assert.ok(gap < 1e-9, `${body.id} drifted by ${gap} AU on replay`);
  }
});

void test('a link carries the recipe, and the recipient reaches the same path', () => {
  const authored = createRun(forkScenario(J2000_MS));
  while (authored.elapsedDays < 200) authored.advance(40);
  authored.apply({ kind: 'remove', id: 'mercury' });
  authored.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 4.4e28 });
  authored.apply({
    kind: 'add',
    body: createdBody(
      {
        name: 'Wanderer',
        mass: 3e26,
        radius: 30000,
        distance: 2.4,
        color: '#7fd4ff',
      },
      0,
      centreOf(centralBody(authored.variant)),
      'wanderer',
    ),
  });
  while (authored.elapsedDays < 800) authored.advance(40);

  const link = encodeSandbox(authored.scenario);
  const received = decodeSandbox(link, J2000_MS);
  assert.ok(received);
  // The link describes the run, not its result: no trajectory travels in it.
  assert.equal(received.changes.length, authored.scenario.changes.length);
  const replay = createRun(received);
  for (
    let guard = 0;
    guard < 500 && replay.elapsedDays < authored.elapsedDays;
    guard++
  )
    replay.advance(Math.min(40, authored.elapsedDays - replay.elapsedDays));
  assert.ok(Math.abs(replay.elapsedDays - authored.elapsedDays) < 1e-9);
  assert.equal(replay.variant.length, authored.variant.length);
  for (const body of authored.variant) {
    const echo = replay.variant.find((item) => item.id === body.id);
    assert.ok(echo, `${body.id} missing after the link was opened`);
    const gap = Math.hypot(
      ...body.position.map((value, axis) => value - echo.position[axis]),
    );
    assert.ok(gap < 1e-9, `${body.id} drifted by ${gap} AU`);
  }
  assert.equal(replay.liveSpec('wanderer')!.name, 'Wanderer');
});

void test('a damaged or hostile link degrades to an unmodified run', () => {
  assert.equal(decodeSandbox(null, J2000_MS), null);
  assert.deepEqual(decodeSandbox('', J2000_MS), null);
  // Unknown verbs, unparsable numbers, unknown fields and truncated records
  // are each dropped rather than trusted.
  const junk = decodeSandbox(
    'x,1,earth;s,NaN,earth,mass,5;s,10,earth,charisma,5;s,10,earth,mass,oops;a,5',
    J2000_MS,
  )!;
  assert.deepEqual(junk.changes, []);
  // A change naming a body no link introduces would silently do nothing.
  assert.deepEqual(decodeSandbox('s,3,ghost,mass,5e24', J2000_MS)!.changes, []);
  // A run built from the wreckage still behaves like an untouched fork.
  const run = createRun(junk);
  run.advance(50);
  assert.equal(run.variant.length, 10);
  const earth = run.variant.find((body) => body.id === 'earth')!;
  const shadow = run.baseline.find((body) => body.id === 'earth')!;
  assert.equal(
    Math.hypot(
      ...earth.position.map((value, axis) => value - shadow.position[axis]),
    ),
    0,
  );
});

void test('a shared body’s own text and colour are not taken on trust', () => {
  const nasty = decodeSandbox(
    `a,0,evil,${encodeURIComponent('<script>x</script>' + 'y'.repeat(80))},javascript:alert(1),5e24,6000,1,0,1,0,0,0,0,0.017`,
    J2000_MS,
  )!;
  const body = (nasty.changes[0] as { body: { name: string; color: string } })
    .body;
  // Held to a length, and a colour that is not a plain hex triple is refused.
  assert.ok(body.name.length <= 40);
  assert.equal(body.color, '#ffffff');
  // An id outside the allowed shape is refused outright.
  assert.deepEqual(
    decodeSandbox(
      'a,0,../../etc,x,ffffff,5e24,6000,1,0,1,0,0,0,0,0.017',
      J2000_MS,
    )!.changes,
    [],
  );
});

void test('a malformed escape in a shared name falls back instead of throwing', () => {
  // `decodeURIComponent` throws on a bare `%` or an invalid pair, and this
  // text comes from whoever wrote the link.
  for (const name of ['%', '%zz', '%E0%A4%A', 'ok%']) {
    const link = `a,0,rogue,${name},7fd4ff,5e24,6000,1,0,1,0,0,0,0,0.017`;
    const decoded = decodeSandbox(link, J2000_MS);
    assert.ok(decoded, name);
    const change = decoded.changes[0];
    assert.equal(change.kind, 'add');
    assert.ok(
      change.kind === 'add' && change.body.name.length > 0,
      `${name} left the body unnamed`,
    );
    // The run still builds, which is the contract the module states.
    const run = createRun(decoded);
    run.advance(5);
    assert.ok(run.variant.some((body) => body.id === 'rogue'));
  }
});

void test('a body a run created carries a readable label as soon as it appears', () => {
  const run = createRun(forkScenario(J2000_MS));
  run.apply({
    kind: 'add',
    body: createdBody(
      {
        name: '流浪者',
        mass: 1e26,
        radius: 20000,
        distance: 4,
        color: '#7fd4ff',
      },
      0,
      centreOf(centralBody(run.variant)),
      'drifter',
    ),
  });
  // The scene reads a created body's name from the run, so a blank label can
  // only come from the renderer forgetting to ask for it.
  const fact = run.facts.find((body) => body.id === 'drifter');
  assert.ok(fact);
  assert.equal(fact.name, '流浪者');
  assert.equal(run.liveSpec('drifter')!.name, '流浪者');
});

void test('a faster rate takes more steps, never longer ones', () => {
  // Asking for far more time than a frame can carry does not buy a longer
  // step: the request is capped at the work ceiling and the run falls behind
  // the chosen rate instead.
  const hurried = createRun(forkScenario(J2000_MS));
  const first = hurried.step;
  hurried.advance(10_000);
  assert.ok(hurried.throttled);
  assert.equal(hurried.steps, MAX_STEPS_PER_ADVANCE);
  assert.ok(hurried.elapsedDays <= MAX_STEPS_PER_ADVANCE * first + 1e-9);
  // The step follows the tightest pair in the system as it moves, never how
  // much time the caller asked for — so two runs at the same elapsed time
  // agree on it however differently they were driven there, and accuracy per
  // simulated day does not depend on the chosen rate.
  // Same span, wildly different helpings, same state to the last bit.
  const dribbled = createRun(forkScenario(J2000_MS));
  const gulped = createRun(forkScenario(J2000_MS));
  driveTo(dribbled, 400, 0.7);
  driveTo(gulped, 400, 80);
  assert.equal(gulped.elapsedDays, dribbled.elapsedDays);
  assert.equal(gulped.step, dribbled.step);
  for (const body of dribbled.variant) {
    const other = gulped.variant.find((item) => item.id === body.id)!;
    assert.ok(
      Math.hypot(
        ...body.position.map((value, axis) => value - other.position[axis]),
      ) < 1e-12,
      body.id,
    );
  }
});

void test('a trail keeps the whole run, a point for each turn of the path', () => {
  const run = createRun(forkScenario(J2000_MS));
  const start = new Map(
    run.variant.map((body) => [body.id, [...body.position]]),
  );
  while (run.elapsedDays < 365.25 * 60) run.advance(300);
  // Sixty years on, every trail still begins where its body set out.
  for (const [id, trail] of run.trails)
    assert.deepEqual(trail[0], start.get(id), id);
  // Recorded on the turn rather than the clock, a lap gets about the same
  // points whether it takes three months or twelve years, and a slow lap no
  // longer costs thousands.
  const laps = { mercury: 87.969, earth: 365.256, jupiter: 4332.59 };
  for (const [id, period] of Object.entries(laps)) {
    const perLap = run.trails.get(id)!.length / (run.elapsedDays / period);
    assert.ok(perLap > 20 && perLap < 28, `${id}: ${perLap.toFixed(1)} a lap`);
  }
  assert.ok(run.trails.get('neptune')!.length < 20);
  // Measured on the path itself: the angle between one recorded chord and the
  // next. Recorded on the clock, sixty years once took Mercury past 180
  // degrees between points, where a ribbon stops describing an orbit.
  const mercury = run.trails.get('mercury')!;
  const turns: number[] = [];
  for (let index = 2; index < mercury.length; index++) {
    const before = mercury[index - 1].map((v, a) => v - mercury[index - 2][a]);
    const after = mercury[index].map((v, a) => v - mercury[index - 1][a]);
    const dot = before.reduce((sum, v, a) => sum + v * after[a], 0);
    const cosine = dot / (Math.hypot(...before) * Math.hypot(...after));
    turns.push((Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI);
  }
  assert.ok(Math.max(...turns) < 20, `${Math.max(...turns).toFixed(1)}°`);
});

void test('a change pins the trail on both sides of it', () => {
  const run = createRun(forkScenario(J2000_MS));
  while (run.elapsedDays < 100) run.advance(20);
  const before = [...run.drawn.get('mars')!];
  run.apply({ kind: 'set', id: 'mars', field: 'distance', value: 3 });
  const after = [...run.variant.find((body) => body.id === 'mars')!.position];
  // The jump is drawn from where the body was on screen to where it was put,
  // rather than smoothed across from wherever the last point happened to
  // fall.
  assert.deepEqual(run.trails.get('mars')!.slice(-2), [before, after]);
});

void test('a trail drawn a piece at a time is the whole curve, seams and all', () => {
  // A wobbling spiral, recorded a point at a time with the body moving on
  // between recordings, the way a run feeds the scene.
  const path: Vec3[] = Array.from({ length: 40 }, (_, index) => {
    const angle = index * 0.3;
    const radius = 2 + 0.05 * index;
    return [
      radius * Math.cos(angle),
      0.1 * Math.sin(3 * angle),
      -radius * Math.sin(angle),
    ];
  });
  const trail = createSandboxTrail(0xffffff, 1);
  const drawnPoints = () => {
    const geometry = trail.line.geometry;
    const start = geometry.getAttribute('instanceStart');
    const end = geometry.getAttribute('instanceEnd');
    const count = trail.line.visible ? geometry.instanceCount : 0;
    const points: Vector3[] = [];
    for (let index = 0; index < count; index++) {
      const from = new Vector3(
        start.getX(index),
        start.getY(index),
        start.getZ(index),
      );
      // Every segment starts where the one before it ended: no seams.
      if (index > 0) assert.ok(from.distanceTo(points.at(-1)!) < 1e-6);
      else points.push(from);
      points.push(
        new Vector3(end.getX(index), end.getY(index), end.getZ(index)),
      );
    }
    return points;
  };
  const expect = (history: Vec3[], head: Vec3 | null) => {
    const whole = smoothed(
      [...history, ...(head ? [head] : [])].map(
        (point) => new Vector3(...scenePosition(point)),
      ),
    );
    const drawn = drawnPoints();
    assert.equal(drawn.length, whole.length < 2 ? 0 : whole.length);
    // Written as 32-bit floats, so equal to within their precision.
    drawn.forEach((point, index) =>
      assert.ok(point.distanceTo(whole[index]) < 1e-4 * (1 + point.length())),
    );
  };
  const history: Vec3[] = [];
  for (const [index, point] of path.entries()) {
    history.push(point);
    trail.draw(history, point);
    expect(history, null);
    const next = path[index + 1] ?? point;
    const head = point.map((value, axis) => (value + next[axis]) / 2) as Vec3;
    trail.draw(history, head);
    expect(history, index + 1 < path.length ? head : null);
  }
  // A trail that lost its oldest part is drawn again from its new start.
  history.splice(0, 12);
  trail.draw(history, history.at(-1)!);
  expect(history, null);
});

void test('leaving is judged against the whole system, not the Sun alone', () => {
  // Jupiter four hundred times heavier makes a binary of it and the Sun,
  // which swings the Sun about by several km/s. Judged against the Sun alone,
  // Neptune left and came back on that swing every few years, and Mars read
  // as leaving ten days before it hit Jupiter.
  const run = createRun(forkScenario(Date.parse('2026-09-22T00:00:00Z')));
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 8e29 });
  while (run.elapsedDays < 365.25 * 12) run.advance(40);
  const left = run.events.flatMap((event) =>
    event.kind === 'escape' ? [event] : [],
  );
  assert.ok(
    run.events.some(
      (event) => event.kind === 'collision' && event.absorbed === 'mars',
    ),
  );
  assert.ok(!left.some((event) => event.id === 'mars'));
  assert.ok(!left.some((event) => event.id === 'neptune'));
  // Nothing is announced twice without a capture in between.
  assert.ok(!run.events.some((event) => event.kind === 'capture'));
  assert.equal(new Set(left.map((event) => event.id)).size, left.length);
  // Pluto is too slow to follow the pair's new drift and does leave, within
  // days — looked for on the step review, not only when a frame ends.
  const pluto = left.find((event) => event.id === 'pluto');
  assert.ok(pluto && pluto.day < 20, JSON.stringify(pluto));
});

void test('events land at the same moments however the frames fall', () => {
  const disturbed = () => {
    const run = createRun(forkScenario(Date.parse('2026-09-22T00:00:00Z')));
    run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 8e29 });
    return run;
  };
  const dribbled = disturbed();
  const gulped = disturbed();
  driveTo(dribbled, 60, 0.3);
  driveTo(gulped, 60, 40);
  // Each frame used to end in a look of its own, so a reset or a shared link
  // listed the same escape at a different time from the run it replayed.
  assert.ok(dribbled.events.some((event) => event.kind === 'escape'));
  assert.deepEqual(gulped.events, dribbled.events);
});

void test('each body coming loose is announced once', () => {
  // A body that simply leaves is announced once, not on every later look.
  const leaving = createRun(forkScenario(J2000_MS));
  leaving.apply({ kind: 'set', id: 'earth', field: 'speed', value: 60 });
  while (leaving.elapsedDays < 3000) leaving.advance(100);
  assert.equal(
    leaving.events.filter(
      (event) => event.kind === 'escape' && event.id === 'earth',
    ).length,
    1,
  );
});

void test('a body brought back after leaving is announced as captured', () => {
  const run = createRun(forkScenario(J2000_MS));
  run.apply({ kind: 'set', id: 'earth', field: 'speed', value: 48 });
  for (let guard = 0; guard < 50 && !run.escaped.has('earth'); guard++)
    run.advance(10);
  // Put back on a circular orbit, it belongs to the system again.
  run.apply({ kind: 'set', id: 'earth', field: 'distance', value: 1.5 });
  run.advance(10);
  assert.deepEqual(
    run.events.flatMap((event) =>
      event.kind === 'escape' || event.kind === 'capture' ? [event.kind] : [],
    ),
    ['escape', 'capture'],
  );
  assert.ok(!run.escaped.has('earth'));
});

void test('a merge adds the absorbed body’s mass and keeps the momentum', () => {
  const run = createRun(forkScenario(J2000_MS));
  // Stall Earth in its orbit and it falls into the Sun.
  run.apply({ kind: 'set', id: 'earth', field: 'speed', value: 0.2 });
  const sunBefore = run.variant.find((body) => body.id === 'sun')!.mass;
  const earthMass = run.variant.find((body) => body.id === 'earth')!.mass;
  const before = barycenter(run.variant);
  while (run.elapsedDays < 200) run.advance(20);
  assert.ok(
    run.events.some(
      (event) => event.kind === 'collision' && event.absorbed === 'earth',
    ),
  );
  const sun = run.variant.find((body) => body.id === 'sun')!;
  assert.ok(!run.variant.some((body) => body.id === 'earth'));
  // The Sun is heavier by exactly what it swallowed, and the system's total
  // momentum is untouched by the merge.
  assert.ok(Math.abs(sun.mass - (sunBefore + earthMass)) < 1e-18);
  const after = barycenter(run.variant);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      Math.abs(
        after.velocity[axis] * after.mass - before.velocity[axis] * before.mass,
      ) < 1e-15,
    );
  // The panel reads mass from the run, so the gain is what the editor shows.
  assert.ok(run.liveSpec('sun')!.mass > 1.9e30);
  assert.equal(run.liveSpec('earth'), null);
  // Earth's trail outlives it, running on to where it touched the Sun, so
  // the run still shows how the merge came about.
  const trail = run.trails.get('earth')!;
  const contact = Math.hypot(
    ...trail.at(-1)!.map((value, axis) => value - sun.position[axis]),
  );
  assert.ok(contact <= sun.radius * 1.01, `${contact} AU from the Sun`);

  // And the scene draws it, though there is no body left to draw it on to.
  const scene = new Scene();
  const system = createSandboxSystem(
    scene,
    new Map(run.facts.map((body) => [body.id, new Group()])),
    new Map(),
    { appendChild: () => {} } as unknown as HTMLElement,
    () => {},
  );
  system.setVisible(true);
  system.update(run, {
    baseline: false,
    trails: true,
    realSizes: false,
    selected: null,
    labels: false,
    lineWidth: 1,
    seconds: 0,
    daysPerSecond: 20,
    translate: (key) => key,
  });
  const drawn: unknown[] = [];
  scene.traverse((object) => {
    if (isOrbitLine(object) && object.visible) drawn.push(object);
  });
  assert.equal(drawn.length, run.trails.size);
});

void test('smoothing a coarse trail follows the arc rather than inventing one', () => {
  // Twenty points around a circle is about what a long run leaves the
  // innermost body per orbit, and joining them straight is the polygon the
  // ribbon used to draw.
  const radius = 3.1;
  const samples = Array.from({ length: 21 }, (_, index) => {
    const angle = (index / 20) * Math.PI * 2;
    return new Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle));
  });
  // How far a straight chord between two samples bows inside the circle.
  const chordSag = radius * (1 - Math.cos(Math.PI / 20));
  const curve = smoothed(samples);
  assert.ok(curve.length > samples.length * 3);
  // Every drawn point, ends included, sits an order of magnitude closer to the
  // circle the samples came from than the straight chords did. The ends are
  // where a naive spline bulges, so they are measured along with the rest.
  const worst = Math.max(
    ...curve.map((point) => Math.abs(Math.hypot(point.x, point.z) - radius)),
  );
  assert.ok(worst < chordSag / 10, `${worst} AU off the arc`);
  // The ends are held, so a trail still starts and finishes where it did.
  assert.ok(curve[0].distanceTo(samples[0]) < 1e-9);
  assert.ok(curve.at(-1)!.distanceTo(samples.at(-1)!) < 1e-9);
  // Too few points to interpolate are passed through untouched.
  assert.deepEqual(smoothed(samples.slice(0, 2)), samples.slice(0, 2));
});

void test('the event log lists every event oldest first, so rows never shift', () => {
  const run = createRun(forkScenario(J2000_MS));
  const leaving = ['saturn', 'pluto', 'neptune', 'mars', 'uranus', 'venus'];
  leaving.forEach((id, index) =>
    run.events.push({ kind: 'escape', id, day: 400 + index * 90 }),
  );
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'en' },
      createElement(SandboxPanel, {
        run,
        selected: null,
        baseline: true,
        trails: true,
        onEnter: noop,
        onLeave: noop,
        onRestart: noop,
        onSelect: noop,
        onRemove: noop,
        onAdd: noop,
        onBaselineChange: noop,
        onTrailsChange: noop,
      }),
    ),
  );
  // All six are kept, not just the latest four, and in the order they
  // happened: a new event is appended at the foot rather than pushing every
  // earlier row down by one.
  const log = html.slice(html.indexOf('sandbox-events'));
  const positions = [
    'Saturn',
    'Pluto',
    'Neptune',
    'Mars',
    'Uranus',
    'Venus',
  ].map((name) => log.indexOf(`${name} has left the system`));
  assert.ok(
    positions.every((at) => at >= 0),
    positions.join(','),
  );
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
  );
});

void test('the viewer’s own changes join the event log, before and after', () => {
  const run = createRun(forkScenario(J2000_MS));
  run.advance(30);
  const at = run.shownDays;
  const jupiter = run.liveSpec('jupiter')!.mass;
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  // Writing a value a body already has changes nothing, so it says nothing.
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  run.apply({ kind: 'remove', id: 'pluto' });
  run.apply({
    kind: 'add',
    body: createdBody(
      { name: 'Nova', mass: 6e24, radius: 6400, distance: 3, color: '#7fd4ff' },
      0,
      centreOf(centralBody(run.variant)),
      'added-1',
    ),
  });
  assert.deepEqual(run.events, [
    {
      kind: 'set',
      id: 'jupiter',
      field: 'mass',
      from: jupiter,
      to: 9.5e28,
      day: at,
    },
    { kind: 'remove', id: 'pluto', day: at },
    { kind: 'add', id: 'added-1', day: at },
  ]);
  // A replay of the recipe lists them again, each at the moment it was made.
  const replay = createRun({
    epoch: run.scenario.epoch,
    changes: [...run.scenario.changes],
  });
  while (replay.elapsedDays <= at) replay.advance(10);
  assert.deepEqual(
    replay.events.filter((event) => event.day === at),
    run.events,
  );

  const html = renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'en' },
      createElement(SandboxPanel, {
        run,
        selected: null,
        baseline: true,
        trails: true,
        onEnter: () => {},
        onLeave: () => {},
        onRestart: () => {},
        onSelect: () => {},
        onRemove: () => {},
        onAdd: () => {},
        onBaselineChange: () => {},
        onTrailsChange: () => {},
      }),
    ),
  );
  const log = html.slice(html.indexOf('sandbox-events'));
  // Read the way the editor reads them, units included.
  assert.ok(
    log.includes(`<em>${jupiter.toExponential(3)} → 9.500e+28\u00a0kg</em>`),
    log,
  );
  assert.match(log, /Jupiter: Mass changed/);
  assert.match(log, /Pluto was removed/);
  assert.match(log, /Nova joined the system/);
});

void test('a phone edits the forces in reach and keeps the rest one tap away', () => {
  const run = createRun(forkScenario(J2000_MS));
  const compact = (selected: string) =>
    renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: 'en' },
        createElement(SandboxBodyEditor, {
          run,
          selected,
          daysPerSecond: 20,
          onChange: () => {},
          onReset: () => {},
          compact: true,
          onBack: () => {},
          onMore: () => {},
        }),
      ),
    );
  const earth = compact('earth');
  for (const shown of [
    'Mass',
    'Orbital speed',
    'Distance from the Sun',
    'Back to the sandbox',
    'Restore the real values',
    'All parameters',
  ])
    assert.ok(earth.includes(shown), shown);
  // What does not enter the force law waits behind 'All parameters'.
  for (const hidden of ['Radius', 'Axial tilt', 'Live readings'])
    assert.ok(!earth.includes(hidden), hidden);
  const sun = compact('sun');
  assert.ok(sun.includes('Mass'));
  assert.ok(!sun.includes('Orbital speed'));

  // The panel hands its sheet over to the editor while a body is picked.
  const noop = () => {};
  const panel = renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'en' },
      createElement(SandboxPanel, {
        run,
        selected: 'earth',
        baseline: true,
        trails: true,
        onEnter: noop,
        onLeave: noop,
        onRestart: noop,
        onSelect: noop,
        onRemove: noop,
        onAdd: noop,
        onBaselineChange: noop,
        onTrailsChange: noop,
        editor: createElement('p', null, 'editor'),
      }),
    ),
  );
  assert.match(panel, /data-editing="true"/);
  assert.match(panel, /class="sandbox-panel-editor"><p>editor<\/p>/);
});

void test('the folded sheet names what matters, not the time it repeats', () => {
  const t = translator('en');
  const run = createRun(forkScenario(J2000_MS));
  assert.equal(foldedLabel(run, null, t), 'Nothing has changed yet');
  run.apply({ kind: 'remove', id: 'pluto' });
  assert.equal(foldedLabel(run, null, t), 'Pluto was removed');
  // While a body is being edited, the fold names it instead.
  assert.equal(foldedLabel(run, 'mars', t), 'Mars');
});

void test('the panel starts a shared run over clean; the timeline only rewinds it', () => {
  // A link that made Jupiter four hundred times heavier at the fork.
  const epoch = Date.parse('2026-09-22T00:00:00Z');
  const shared = decodeSandbox('s,0,jupiter,mass,8e29', epoch)!;
  assert.equal(shared.changes.length, 1);
  // Rewinding replays the recipe, the link's change included.
  const rewound = rewoundScenario(shared);
  assert.deepEqual(rewound, shared);
  assert.notEqual(rewound, shared);
  const replay = createRun(rewound);
  replay.advance(1);
  assert.ok(
    replay.events.some(
      (event) => event.kind === 'set' && event.id === 'jupiter',
    ),
  );
  // What the replay goes on to change stays with the replay.
  replay.apply({ kind: 'set', id: 'earth', field: 'mass', value: 9e25 });
  assert.equal(shared.changes.length, 1);
  // Starting over keeps only the moment: no change, no event, the real Jupiter.
  const fresh = createRun(forkScenario(shared.epoch));
  fresh.advance(1);
  assert.deepEqual(fresh.scenario.changes, []);
  assert.deepEqual(fresh.events, []);
  assert.ok(fresh.liveSpec('jupiter')!.mass < 2e27);

  // Each reset is wired to its own job, so they cannot quietly converge on
  // the replay again, and starting over drops the link that brought the
  // changes, or a reload would bring them back.
  const page = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /onRestart=\{startSandboxOver\}/);
  assert.match(page, /onClick=\{rewindSandbox\}/);
  assert.match(page, /forkScenario\(current\.epoch\)/);
  assert.match(page, /pathname \+ withoutShareView\(search\) \+ hash/);
});

void test('a still scene sleeps between frames', () => {
  const scene = readFileSync(
    new URL('../components/solar-scene.tsx', import.meta.url),
    'utf8',
  );
  // Still, the scene waits for a slow beat instead of every display frame,
  // and anything that moves the picture wakes it at once.
  assert.match(scene, /sleeping = setTimeout\(/);
  assert.match(scene, /controls\.addEventListener\('change', wake\)/);
  assert.match(scene, /wakeScene\.current\(\);/);
  assert.match(scene, /const resize = \(\) => \{\s*wake\(\);/);
});

void test('a trail that has not moved is not uploaded again', () => {
  const trail = createSandboxTrail(0xffffff, 1);
  const history: Vec3[] = [
    [1, 0, 0],
    [0.9, 0, -0.4],
    [0.7, 0, -0.7],
    [0.4, 0, -0.9],
  ];
  const head: Vec3 = [0.2, 0, -0.98];
  trail.draw(history, head);
  const buffer = (
    trail.line.geometry.getAttribute('instanceStart') as unknown as {
      data: { version: number };
    }
  ).data;
  const uploaded = buffer.version;
  // A paused run hands over the same history and head frame after frame.
  trail.draw(history, [...head]);
  assert.equal(buffer.version, uploaded);
  // Hidden meanwhile by the trails switch, it comes back as it was.
  trail.line.visible = false;
  trail.draw(history, [...head]);
  assert.equal(trail.line.visible, true);
  // Once the body moves on, it is drawn again.
  trail.draw(history, [0.1, 0, -0.99]);
  assert.ok(buffer.version > uploaded);
});

void test('a paused run leaves the page at rest', () => {
  const page = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  // The readouts are refreshed while the run moves, and after a change.
  assert.match(page, /if \(!sandboxRun \|\| sandboxPaused\) return;/);
  assert.match(page, /sandboxRun\?\.apply\(edit\);\s*setSandboxTick/);
  assert.doesNotMatch(page, /sandboxRun\?\.apply\(\{/);
});

void test('a run shared before any change still reopens as a run', () => {
  const unchanged = forkScenario(J2000_MS);
  const encoded = encodeSandbox(unchanged);
  // An empty value would drop out of the link and leave the recipient in
  // the explorer.
  assert.ok(encoded.length > 0);
  assert.deepEqual(decodeSandbox(encoded, J2000_MS), unchanged);
});

void test('a shared run opens playing, framed as it was shared', () => {
  const page = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  const start = page.indexOf('const recipe = decodeSandbox(');
  const opening = page.slice(start, page.indexOf('}', start));
  // It plays whatever the sharer's explorer clock was doing.
  assert.match(opening, /setSandboxPaused\(false\)/);
  // The followed body and the camera around it come from the link; the
  // camera's distance is measured from that body's framing.
  assert.doesNotMatch(opening, /setSelected\(|setView\(|setCameraPose\(/);
});

void test('a step lands exactly where its position half said it would', () => {
  const points = [
    point('sun', 1, [0, 0, 0], [0, 0, 0], kmToAu(696_000)),
    point('earth', 3e-6, [1, 0, 0], [0, 0, -0.0172], kmToAu(6371)),
    point('moonlet', 1e-9, [1.01, 0.001, 0], [0, 0.0005, -0.02]),
  ];
  const acceleration = accelerations(points, zeroVectors(points.length));
  const dt = 0.1834;
  const foreseen = points.map((body, index) =>
    positionAfter(body, acceleration[index], dt),
  );
  advance(points, dt, acceleration);
  // The same arithmetic rather than an estimate of it, so a picture drawn
  // from it between steps meets each step exactly where it lands.
  assert.deepEqual(
    points.map((body) => body.position),
    foreseen,
  );
});

void test('the picture moves on every frame, whatever the step and the rate', () => {
  // The step is the physics' own, about a sixth of a day while Mercury is in
  // the system. Drawn only at whole steps, the bodies stood still for a
  // couple of seconds at a time at the slowest rate, and at the default rate
  // a 60 Hz frame carried anywhere from one step to four.
  for (const rate of [0.1, 20]) {
    const run = createRun(forkScenario(J2000_MS));
    const frame = rate / 60;
    let last = [...run.drawn.get('mercury')!];
    let previous = 0;
    for (let index = 1; index <= 120; index++) {
      run.advance(frame);
      // The clock shows the time asked for, ahead of the last whole step by
      // less than a step.
      assert.ok(Math.abs(run.shownDays - index * frame) < 1e-9);
      assert.ok(run.shownDays - run.elapsedDays < run.step + 1e-12);
      const now = run.drawn.get('mercury')!;
      const moved = Math.hypot(...now.map((value, axis) => value - last[axis]));
      assert.ok(moved > 0, `${rate} d/s: frame ${index} stood still`);
      // Equal time, equal distance: no frame makes up for one that stalled.
      if (previous > 0)
        assert.ok(
          Math.abs(moved / previous - 1) < 0.01,
          `${rate} d/s: frame ${index} moved ${moved / previous} times the last`,
        );
      previous = moved;
      last = [...now];
    }
  }
});

void test('an edit lands at the moment on screen, and a replay lands it there too', () => {
  const run = createRun(forkScenario(J2000_MS));
  // Long enough for the Sun to be moving, then a part of a step on.
  while (run.elapsedDays < 400) run.advance(40);
  run.advance(run.step / 3);
  const first = run.shownDays;
  assert.ok(first > run.elapsedDays);
  const shown = [...run.drawn];
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  assert.equal(run.scenario.changes[0].at, first);
  assert.equal(run.elapsedDays, first);
  // The run reaches the moment by the very arithmetic it was drawn with, so a
  // mass change moves nothing on screen.
  assert.deepEqual([...run.drawn], shown);

  // A body placed about the central body is placed about it where it stands
  // at that moment, which the run knows only once it has reached it.
  run.advance(run.step / 3);
  const second = run.shownDays;
  run.apply((current) => ({
    kind: 'add',
    body: createdBody(
      { name: 'Nova', mass: 6e24, radius: 6400, distance: 3, color: '#fff' },
      0,
      centreOf(centralBody(current.variant)),
      'nova',
    ),
  }));
  assert.equal(run.scenario.changes[1].at, second);
  const find = (id: string) => run.variant.find((body) => body.id === id)!;
  const nova = orbitState(find('nova'), find('sun'));
  assert.ok(Math.abs(nova.distance - 3) < 1e-12, String(nova.distance));
  assert.ok(nova.eccentricity < 1e-6, String(nova.eccentricity));

  run.advance(11);
  const replay = createRun({
    epoch: run.scenario.epoch,
    changes: [...run.scenario.changes],
  });
  for (let guard = 0; guard < 5000 && replay.shownDays < run.shownDays; guard++)
    replay.advance(Math.min(0.37, run.shownDays - replay.shownDays));
  assert.deepEqual(replay.events, run.events);
  for (const [id, position] of run.drawn) {
    const echo = replay.drawn.get(id)!;
    const gap = Math.hypot(
      ...position.map((value, axis) => value - echo[axis]),
    );
    assert.ok(gap < 1e-12, `${id} drifted by ${gap} AU on replay`);
  }
});

void test('the scene draws a run at the moment on screen', () => {
  const run = createRun(forkScenario(J2000_MS));
  run.advance(run.step / 2);
  assert.equal(run.elapsedDays, 0);
  const roots = new Map(run.facts.map((body) => [body.id, new Group()]));
  const system = createSandboxSystem(
    new Scene(),
    roots,
    new Map(),
    { appendChild: () => {} } as unknown as HTMLElement,
    () => {},
  );
  system.setVisible(true);
  system.update(run, {
    baseline: true,
    trails: true,
    realSizes: false,
    selected: 'mercury',
    labels: false,
    lineWidth: 1,
    seconds: 1 / 60,
    daysPerSecond: 0.1,
    translate: (key) => key,
  });
  const drawn = scenePosition(run.drawn.get('mercury')!);
  const stepped = scenePosition(
    run.variant.find((body) => body.id === 'mercury')!.position,
  );
  assert.deepEqual(roots.get('mercury')!.position.toArray(), drawn);
  assert.notDeepEqual(drawn, stepped);
  // The camera follows the body where it is drawn, not where it last stepped.
  assert.deepEqual(system.positionOf(run, 'mercury')!.toArray(), drawn);
});

void test('the clock reads the moment on screen', () => {
  const page = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  const panel = readFileSync(
    new URL('../components/sandbox-panel.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /elapsedLabel\(sandboxRun\.shownDays, t\)/);
  assert.match(panel, /elapsedLabel\(run\.shownDays, t\)/);
  assert.doesNotMatch(page + panel, /elapsedLabel\(\w+\.elapsedDays/);
});

void test('a body added after a rewind never takes the id of one still to come', () => {
  const first = createRun(forkScenario(J2000_MS));
  while (first.elapsedDays < 100) first.advance(20);
  const earlier = addBody(first, 'First');
  // The timeline's reset replays the recipe from the fork, so First is still
  // queued when the next body is added.
  const rewound = createRun(rewoundScenario(first.scenario));
  rewound.advance(5);
  assert.equal(rewound.liveSpec(earlier), null);
  // The placement index moves on with the id, so the new body does not start
  // on the ray First will appear on.
  assert.deepEqual(nextAddition(rewound), { id: 'added-2', index: 1 });
  const later = addBody(rewound, 'Second');
  while (rewound.elapsedDays < 150) rewound.advance(20);
  assert.equal(rewound.liveSpec(earlier)?.name, 'First');
  assert.equal(rewound.liveSpec(later)?.name, 'Second');

  // The page names what the viewer adds by the same rule.
  const page = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /= nextAddition\(run\)/);
  assert.doesNotMatch(page, /added-\$\{/);
});

void test('a body added to a shared run never takes an id the link already uses', () => {
  const authored = createRun(forkScenario(J2000_MS));
  while (authored.shownDays < 100) authored.advance(20);
  const theirs = addBody(authored, 'Theirs');
  const link = encodeSandbox(authored.scenario);
  // Opened from the link, the run starts at the fork with that body queued.
  const received = createRun(decodeSandbox(link, J2000_MS)!);
  received.advance(5);
  assert.equal(received.liveSpec(theirs), null);
  const mine = addBody(received, 'Mine');
  while (received.shownDays < 150) received.advance(20);
  assert.equal(received.liveSpec(theirs)?.name, 'Theirs');
  assert.equal(received.liveSpec(mine)?.name, 'Mine');

  // A link chooses its own ids. Past 2⁵³ adding one no longer changes a
  // number, so counting on from the highest would give every later body the
  // same id; each still gets its own.
  const outsized = createRun(
    decodeSandbox(link.replace(theirs, 'added-9007199254740993'), J2000_MS)!,
  );
  const one = addBody(outsized, 'One');
  const two = addBody(outsized, 'Two');
  assert.equal(outsized.liveSpec(one)?.name, 'One');
  assert.equal(outsized.liveSpec(two)?.name, 'Two');
});

void test('bodies added across a rewind and a shared link get different colours', () => {
  const first = createRun(forkScenario(J2000_MS));
  while (first.elapsedDays < 100) first.advance(20);
  const earlier = addBody(first, 'First');
  const rewound = createRun(rewoundScenario(first.scenario));
  rewound.advance(5);
  const later = addBody(rewound, 'Second');
  // Opened from a link, both of those are still to come when a third is added.
  const received = createRun(
    decodeSandbox(encodeSandbox(rewound.scenario), J2000_MS)!,
  );
  const mine = addBody(received, 'Mine');
  while (received.elapsedDays < 150) received.advance(20);
  const colours = [earlier, later, mine].map(
    (id) => received.liveSpec(id)!.color,
  );
  assert.equal(new Set(colours).size, 3);

  // The form colours what it adds by the same rule.
  const panel = readFileSync(
    new URL('../components/sandbox-panel.tsx', import.meta.url),
    'utf8',
  );
  assert.match(panel, /color: nextColor\(run\)/);
  assert.doesNotMatch(panel, /!body\.sourceId\)\.length/);
});

const SHARED_EPOCH = Date.parse('2026-09-22T00:00:00Z');

void test('moons split a planetary system without moving anything else', () => {
  const plain = forkBodies(SHARED_EPOCH);
  const split = forkBodies(SHARED_EPOCH, true);
  // Every moon carried is a large one: over 500 km, the ones worth their step.
  assert.deepEqual(
    split.filter((body) => body.parentId).map((body) => body.id),
    sandboxMoons.map((moon) => moon.id),
  );
  assert.ok(sandboxMoons.every((moon) => moon.radiusKm > 500));
  for (const system of plain) {
    const members = split.filter(
      (body) => body.id === system.id || body.parentId === system.id,
    );
    const mass = members.reduce((sum, body) => sum + body.mass, 0);
    assert.ok(Math.abs(mass - system.mass) <= 1e-12 * system.mass, system.id);
    // The same centre of mass and momentum, so the rest of the system cannot
    // tell a run with moons from one without.
    for (const key of ['position', 'velocity'] as const) {
      const centre = [0, 1, 2].map(
        (axis) =>
          members.reduce((sum, body) => sum + body.mass * body[key][axis], 0) /
          mass,
      );
      const gap = Math.hypot(
        ...centre.map((value, axis) => value - system[key][axis]),
      );
      assert.ok(gap < 1e-12, `${system.id} ${key}: ${gap}`);
    }
  }
  // Each moon starts where the explorer draws it around its planet.
  const days = daysFromEpoch(SHARED_EPOCH);
  for (const moon of sandboxMoons) {
    const body = split.find((item) => item.id === moon.id)!;
    const planet = split.find((item) => item.id === moon.parentId)!;
    const drawn = moonState(moon, days).position;
    const offset = body.position.map(
      (value, axis) => value - planet.position[axis],
    );
    // To within the rounding of a position tens of AU from the Sun.
    assert.ok(
      Math.hypot(...offset.map((value, axis) => value - drawn[axis])) < 1e-12,
      moon.id,
    );
  }
});

void test('a run with moons resolves its fastest one and keeps to the sky', () => {
  const run = createRun(forkScenario(SHARED_EPOCH, true));
  const find = (id: string) => run.variant.find((body) => body.id === id)!;
  run.advance(1);
  // Io sets the step, and gets about six hundred of them an orbit.
  assert.ok(1.769 / run.step > 600, String(run.step));
  // Moons keep no trail of their own; they are drawn around their planets.
  assert.ok(![...run.trails.keys()].some((id) => id.startsWith('moon-')));
  const off = (id: string, parent: string) => {
    const moon = sandboxMoons.find((item) => item.id === id)!;
    const truth = moonState(
      moon,
      daysFromEpoch(SHARED_EPOCH) + run.elapsedDays,
    ).position;
    const here = find(id).position.map(
      (value, axis) => value - find(parent).position[axis],
    );
    const gap = Math.hypot(...here.map((value, axis) => value - truth[axis]));
    return (gap / Math.hypot(...truth)) * (180 / Math.PI);
  };
  while (run.elapsedDays < 27.32) run.advance(2);
  // A lunar month on, the Moon is within a twentieth of a degree of Astronomy
  // Engine's. Halving the step does not close the gaps below: they are the
  // model's distance from the sky, not the integrator's. Io's is Jupiter's
  // oblateness, which quickens its real orbit and which point masses leave
  // out; it is the largest of the moons', about half a degree an orbit.
  assert.ok(off('moon-moon', 'earth') < 0.1, String(off('moon-moon', 'earth')));
  assert.ok(off('moon-titan', 'saturn') < 0.5);
  assert.ok(off('moon-io', 'jupiter') < 15, String(off('moon-io', 'jupiter')));
  assert.ok(run.energyDrift < 1e-9, String(run.energyDrift));
});

void test('a moon is edited from its planet and reported leaving it', () => {
  const run = createRun(forkScenario(SHARED_EPOCH, true));
  run.advance(1);
  const find = (id: string) => run.variant.find((body) => body.id === id)!;
  const io = run.liveSpec('moon-io')!;
  const jupiter = referenceBody(run.variant, io.parentId)!;
  assert.equal(jupiter.id, 'jupiter');
  // Its speed is its own around Jupiter, not mostly Jupiter's around the Sun.
  const speed = readField(io, 'speed', centreOf(jupiter));
  assert.ok(speed > 16 && speed < 19, String(speed));
  // Past Jupiter's escape speed at Io's distance, about 24.5 km/s, it leaves.
  run.apply({ kind: 'set', id: 'moon-io', field: 'speed', value: 32 });
  for (
    let guard = 0;
    guard < 60 && !run.events.some((e) => e.kind === 'escape');
    guard++
  )
    run.advance(5);
  // Leaving Jupiter comes first, though at this speed it leaves the Sun too.
  const departures = run.events.flatMap((event) =>
    event.kind === 'escape' ? [{ id: event.id, parent: event.parent }] : [],
  );
  assert.deepEqual(departures[0], { id: 'moon-io', parent: 'jupiter' });
  // Put back 421,800 km out on a circle, it is Jupiter's again.
  run.apply({
    kind: 'set',
    id: 'moon-io',
    field: 'distance',
    value: 421_800 / AU_KM,
  });
  const back = orbitState(find('moon-io'), find('jupiter'));
  assert.ok(
    Math.abs(back.distance * AU_KM - 421_800) < 1,
    String(back.distance),
  );
  assert.ok(back.eccentricity < 1e-3, String(back.eccentricity));
  run.advance(5);
  assert.ok(
    run.events.some(
      (event) =>
        event.kind === 'capture' &&
        event.id === 'moon-io' &&
        event.parent === 'jupiter',
    ),
  );
  // Restoring a moon's real values finds them in the moon catalogue.
  assert.ok(Math.abs(catalogueDefaults('moon-io')!.mass - 8.93e22) < 1e20);
});

void test('the moons switch belongs to the recipe and travels with a link', () => {
  const withMoons = forkScenario(SHARED_EPOCH, true);
  withMoons.changes.push({
    at: 3,
    kind: 'set',
    id: 'moon-titan',
    field: 'mass',
    value: 1e24,
  });
  const encoded = encodeSandbox(withMoons);
  assert.ok(encoded.startsWith('m;'), encoded);
  assert.deepEqual(decodeSandbox(encoded, SHARED_EPOCH), withMoons);
  // Rewinding keeps it; a link from before it existed opens without moons.
  assert.equal(rewoundScenario(withMoons).moons, true);
  assert.equal(
    decodeSandbox('s,0,jupiter,mass,8e29', SHARED_EPOCH)!.moons,
    undefined,
  );
  // A link with moons and nothing else still opens a run.
  assert.deepEqual(
    decodeSandbox('m', SHARED_EPOCH),
    forkScenario(SHARED_EPOCH, true),
  );
});
