import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { createRun } from '../lib/sandbox/run';
import { forkScenario, kmToAu } from '../lib/sandbox/scenario';
import {
  sandboxGroundSnapshot,
  sandboxGroundOrientation,
} from '../lib/sandbox/ground-sky';
import { groundBodyDisplay, horizonFrame } from '../lib/ground-sky';
import { bodyOrientation } from '../lib/ephemeris';
import { bodies } from '../lib/solar';
import { DAY_MS, J2000_MS } from '../lib/simulation-time';

const epoch = Date.parse('2026-09-22T12:00:00Z');
const site = {
  latitude: -33.86,
  longitude: 151.21,
  height: 100,
  utcOffset: 10,
};
const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );

void test('ground sky rotates and places bodies on every display frame across physics steps', () => {
  for (const rate of [0.1, 20]) {
    const run = createRun(forkScenario(epoch));
    const spin = run.facts.find((body) => body.id === 'earth')!.spinDays;
    let previous = sandboxGroundSnapshot(run, site)!;
    const frameDays = rate / 60;
    for (let frame = 1; frame <= 240; frame++) {
      run.advance(frameDays);
      const sky = sandboxGroundSnapshot(run, site)!;
      const turned = previous.frame.rotation.angleTo(sky.frame.rotation);
      assert.ok(turned > 0, `${rate} d/s: sky stood still on frame ${frame}`);
      close(turned, (frameDays / spin) * 2 * Math.PI, 1e-7);
      close(
        sky.observer
          .clone()
          .sub(new Vector3(...run.drawn.get('earth')!))
          .length(),
        run.variant.find((body) => body.id === 'earth')!.radius + kmToAu(0.1),
      );
      for (const body of sky.bodies)
        close(
          body.vector
            .clone()
            .add(sky.observer)
            .distanceTo(new Vector3(...run.drawn.get(body.id)!)),
          0,
        );
      previous = sky;
    }
    assert.ok(run.elapsedDays > 0, 'the run crossed physics-step boundaries');
  }
});

void test('sandbox horizon starts at the fork and follows its physical Earth, independent of world translation', () => {
  const run = createRun(forkScenario(epoch));
  const sky = sandboxGroundSnapshot(run, site)!;
  const real = horizonFrame((epoch - J2000_MS) / DAY_MS, site);
  close(sky.frame.up.distanceTo(real.up), 0, 1e-6);
  close(
    sky.frame.east.clone().cross(sky.frame.up).distanceTo(sky.frame.south),
    0,
  );
  const earth = run.variant.find((point) => point.id === 'earth')!;
  close(
    sky.observer.distanceTo(new Vector3(...earth.position)),
    earth.radius + kmToAu(0.1),
  );
  for (const position of run.drawn.values()) {
    position[0] += 3;
    position[1] -= 2;
    position[2] += 4;
  }
  const translated = sandboxGroundSnapshot(run, site)!;
  close(
    translated.observer
      .clone()
      .sub(sky.observer)
      .distanceTo(new Vector3(3, -2, 4)),
    0,
  );
  for (let i = 0; i < sky.bodies.length; i++)
    close(sky.bodies[i].vector.distanceTo(translated.bodies[i].vector), 0);
  assert.ok(
    !sky.bodies.some((body) => body.id === 'moon-moon' || body.id === 'earth'),
  );
});

void test('ground sky reads the advanced and edited system including paused edits and its live radii', () => {
  const run = createRun(forkScenario(epoch));
  const initial = sandboxGroundSnapshot(run, site)!;
  run.advance(0.5);
  const advanced = sandboxGroundSnapshot(run, site)!;
  assert.ok(
    initial.bodies[0].vector.distanceTo(advanced.bodies[0].vector) > 1e-4,
  );
  const sun = advanced.bodies.find((body) => body.id === 'sun')!;
  const before = groundBodyDisplay(
    sun.id,
    sun.vector,
    'distance',
    true,
    sun.radius,
  );
  run.apply({ kind: 'set', id: 'sun', field: 'radius', value: sun.radius * 2 });
  const changed = sandboxGroundSnapshot(run, site)!.bodies.find(
    (body) => body.id === 'sun',
  )!;
  close(changed.vector.distanceTo(sun.vector), 0);
  close(
    groundBodyDisplay(
      changed.id,
      changed.vector,
      'distance',
      true,
      changed.radius,
    ).radius / before.radius,
    2,
  );
  run.apply({ kind: 'set', id: 'earth', field: 'distance', value: 2 });
  assert.ok(
    sandboxGroundSnapshot(run, site)!.bodies[0].vector.distanceTo(
      changed.vector,
    ) > 0.9,
  );
});

void test('ground spin integrates edits continuously, supports stopped/retrograde rotation and replays by simulated time', () => {
  const run = createRun(forkScenario(epoch));
  const fact = run.facts.find((body) => body.id === 'earth')!;
  run.advance(0.25);
  const before = sandboxGroundOrientation(run, fact);
  run.apply({ kind: 'set', id: 'earth', field: 'spinDays', value: 0 });
  close(before.angleTo(sandboxGroundOrientation(run, fact)), 0, 1e-7);
  run.advance(12);
  close(before.angleTo(sandboxGroundOrientation(run, fact)), 0, 1e-7);
  run.apply({ kind: 'set', id: 'earth', field: 'spinDays', value: -1 });
  run.advance(0.25);
  const rotated = sandboxGroundOrientation(run, fact);
  const expected = before
    .clone()
    .multiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2),
    );
  close(rotated.angleTo(expected), 0, 1e-7);
  const north = new Vector3(0, 1, 0).applyQuaternion(rotated);
  run.apply({
    kind: 'set',
    id: 'earth',
    field: 'tilt',
    value: bodies.find((body) => body.id === 'earth')!.tilt + 45,
  });
  close(
    north.angleTo(
      new Vector3(0, 1, 0).applyQuaternion(sandboxGroundOrientation(run, fact)),
    ),
    Math.PI / 4,
  );
  const recorded = createRun(run.scenario);
  recorded.advance(run.shownDays);
  close(recorded.shownDays, run.shownDays);
  close(
    sandboxGroundOrientation(
      recorded,
      recorded.facts.find((body) => body.id === 'earth')!,
    ).angleTo(sandboxGroundOrientation(run, fact)),
    0,
    1e-7,
  );
  const replay = createRun(forkScenario(epoch));
  replay.apply({ kind: 'set', id: 'earth', field: 'spinDays', value: 1 });
  const fork = bodyOrientation('earth', (epoch - J2000_MS) / DAY_MS);
  replay.advance(0.25);
  close(
    fork.angleTo(
      sandboxGroundOrientation(
        replay,
        replay.facts.find((body) => body.id === 'earth')!,
      ),
    ),
    replay.shownDays * 2 * Math.PI,
    1e-7,
  );
});

void test('sandbox ground includes added bodies, removes lost bodies and refuses a missing observer', () => {
  const run = createRun(forkScenario(epoch));
  const template = run.liveSpec('venus')!;
  run.apply({
    kind: 'add',
    body: {
      ...template,
      id: 'visitor',
      sourceId: null,
      name: 'Visitor',
      position: [2, 0, 0],
    },
  });
  assert.ok(
    sandboxGroundSnapshot(run, site)!.bodies.some(
      (body) => body.id === 'visitor',
    ),
  );
  run.apply({ kind: 'remove', id: 'sun' });
  assert.ok(
    !sandboxGroundSnapshot(run, site)!.bodies.some((body) => body.id === 'sun'),
  );
  run.apply({ kind: 'remove', id: 'earth' });
  assert.equal(sandboxGroundSnapshot(run, site), null);
  const collision = createRun(forkScenario(epoch));
  collision.apply({
    kind: 'add',
    body: {
      ...collision.liveSpec('earth')!,
      id: 'impactor',
      sourceId: null,
      mass: 1e29,
      radius: 10000,
    },
  });
  collision.advance(0.001);
  assert.ok(
    collision.events.some(
      (event) => event.kind === 'collision' && event.absorbed === 'earth',
    ),
  );
  assert.equal(sandboxGroundSnapshot(collision, site), null);
});

void test('nearby enlarged sandbox bodies stay finite and preserve direction at every display scale', () => {
  const vector = new Vector3(0.00001, 0, 0);
  for (const scale of ['distance', 'illustrated'] as const)
    for (const real of [true, false]) {
      const display = groundBodyDisplay('new-body', vector, scale, real, 10000);
      assert.ok(Number.isFinite(display.radius) && display.radius > 0);
      close(
        display.position
          .clone()
          .normalize()
          .distanceTo(vector.clone().normalize()),
        0,
      );
    }
});
