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
} from '../lib/sandbox/scenario.ts';
import {
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
import { smoothed } from '../components/sandbox-system.ts';
import { Vector3 } from 'three';
import {
  catalogueDefaults,
  centralBody,
  createdBody,
  escapeSpeedAt,
  fieldPosition,
  fieldSpec,
  fieldValue,
  readField,
  sandboxFields,
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
  const run = createRun(forkScenario(J2000_MS));
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 9.5e28 });
  while (run.elapsedDays < 365.25 * 20) run.advance(120);
  const changed = run.variant.find((body) => body.id === 'jupiter')!;
  const original = run.baseline.find((body) => body.id === 'jupiter')!;
  assert.ok(changed.mass > original.mass * 40);
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
      centralBody(tight.variant)!.mass * SOLAR_MASS_KG,
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
    const written = writeField(earth, field, value, sun.mass);
    assert.ok(
      Math.abs(readField(written, field) - value) < 1e-6,
      `${field}: ${readField(written, field)}`,
    );
  }
});

void test('a field is clamped to its own range rather than accepting nonsense', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const earth = start.find((body) => body.id === 'earth')!;
  assert.equal(
    writeField(earth, 'mass', 1e40, sun.mass).mass,
    fieldSpec('mass').max,
  );
  assert.equal(
    writeField(earth, 'radius', -50, sun.mass).radius,
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
  const moved = writeField(pluto, 'distance', 5, sun.mass);
  const after = orbitState(
    point('p', 0, moved.position, moved.velocity),
    centre,
  );
  assert.ok(Math.abs(Math.hypot(...moved.position) - 5) < 1e-9);
  assert.ok(after.eccentricity < 1e-6, String(after.eccentricity));
  // Pluto's steep orbit is preserved: only the distance was asked for.
  assert.ok(Math.abs(after.inclination - before.inclination) < 1e-6);
});

void test('scaling a body’s speed keeps its heading', () => {
  const start = forkBodies(J2000_MS);
  const sun = centralBody(start)!;
  const mars = start.find((body) => body.id === 'mars')!;
  const faster = writeField(mars, 'speed', 40, sun.mass);
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
  const centre = centralBody(run.variant)!.mass * SOLAR_MASS_KG;
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
  const beforeEdit = run.elapsedDays;
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
  // The clock does not rewind and the ribbon is not thrown away.
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
      centralBody(authored.variant)!.mass * SOLAR_MASS_KG,
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
      centralBody(run.variant)!.mass * SOLAR_MASS_KG,
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
  // Both stop on the last whole step at or before the same instant, so the
  // comparison is between two runs at one moment rather than two moments.
  const driveTo = (run: SandboxRun, target: number, chunk: number) => {
    for (let guard = 0; guard < 4000; guard += 1) {
      const before = run.elapsedDays;
      run.advance(Math.min(chunk, target - before));
      if (run.elapsedDays === before) return;
    }
  };
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

void test('a long run keeps enough trail resolution to describe a path', () => {
  const run = createRun(forkScenario(J2000_MS));
  while (run.elapsedDays < 365.25 * 60) run.advance(300);
  const mercury = run.trails.get('mercury')!;
  const sun = run.trails.get('sun')!;
  assert.ok(mercury.length > 100);
  assert.equal(mercury.length, sun.length);
  // Measured where it matters: the angle the innermost body sweeps between
  // one recorded point and the next. Left to halve forever, sixty years of
  // running took this past 180 degrees, where a ribbon stops describing an
  // orbit and starts inventing one.
  const swept: number[] = [];
  for (let index = 1; index < mercury.length; index++) {
    const before = mercury[index - 1].map((v, a) => v - sun[index - 1][a]);
    const after = mercury[index].map((v, a) => v - sun[index][a]);
    const dot = before.reduce((sum, v, a) => sum + v * after[a], 0);
    const cosine = dot / (Math.hypot(...before) * Math.hypot(...after));
    swept.push((Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI);
  }
  const sorted = [...swept].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  assert.ok(median < 30, `${median.toFixed(1)}° between samples is too coarse`);
});

void test('each body coming loose is announced once, at its own moment', () => {
  const run = createRun(forkScenario(J2000_MS));
  run.apply({ kind: 'set', id: 'jupiter', field: 'mass', value: 8e29 });
  while (run.elapsedDays < 365.25 * 12) run.advance(40);
  const escapes = run.events.filter((event) => event.kind === 'escape');
  assert.ok(escapes.length > 2, 'expected a disturbed system to shed bodies');
  // They used to be looked for only between frames, so a burst of them all
  // carried the instant the frame ended and the list read as one moment.
  assert.equal(new Set(escapes.map((event) => event.day)).size, escapes.length);
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
