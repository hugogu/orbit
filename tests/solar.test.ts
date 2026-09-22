import test from 'node:test';
import assert from 'node:assert/strict';
import { bodies, orbitPosition, speeds } from '../lib/solar.ts';
const earth = bodies.find((b) => b.id === 'earth')!;
void test('every orbit closes after exactly one orbital period', () => {
  for (const b of bodies.filter((b) => b.period)) {
    for (const mode of ['illustrated', 'distance'] as const) {
      const a = orbitPosition(b, 0, mode),
        c = orbitPosition(b, b.period, mode);
      assert.ok(Math.hypot(...a.map((v, i) => v - c[i])) < 1e-8, b.id);
    }
  }
});
void test('Kepler solution respects perihelion and aphelion distances', () => {
  for (const b of bodies.filter((b) => b.period)) {
    const peri = (-b.phase / (2 * Math.PI)) * b.period;
    assert.ok(
      Math.abs(Math.hypot(...orbitPosition(b, peri)) - b.distance * (1 - b.e)) <
        1e-8,
    );
    assert.ok(
      Math.abs(
        Math.hypot(...orbitPosition(b, peri + b.period / 2)) -
          b.distance * (1 + b.e),
      ) < 1e-8,
    );
  }
});
void test('distance mode uses AU consistently', () => {
  for (const b of bodies.filter((b) => b.period)) {
    const p = orbitPosition(b, 70, 'distance'),
      q = orbitPosition(b, 70);
    assert.ok(
      Math.abs(
        Math.hypot(...p) / Math.hypot(...q) - (b.au * 3.1) / b.distance,
      ) < 1e-8,
    );
  }
});
void test('sun stays at focus; real time preset advances one second per second', () => {
  assert.deepEqual(orbitPosition(bodies[0], 999), [0, 0, 0]);
  assert.equal(speeds[0] * 86400, 1);
  assert.equal(speeds[1] * 86400, 60);
  assert.equal(speeds.at(-1), 3650);
});
void test('orbital position changes and stays finite even after long integration', () => {
  assert.notDeepEqual(orbitPosition(earth, 0), orbitPosition(earth, 50));
  for (const b of bodies)
    assert.ok(orbitPosition(b, 1e9).every(Number.isFinite));
});

void test('eight planets carry physical oblate flattening while terrain stays terrestrial-only', () => {
  const planets = bodies.filter(
    (body) => body.id !== 'sun' && body.id !== 'pluto',
  );
  assert.ok(planets.every((body) => body.flattening !== undefined));
  assert.ok(planets.every((body) => body.flattening! >= 0));
  assert.ok(
    planets
      .filter((body) => body.heightTexture)
      .map((body) => body.id)
      .join(',') === 'mercury,venus,earth,mars',
  );
  assert.ok(
    planets.find((body) => body.id === 'jupiter')!.flattening! >
      planets.find((body) => body.id === 'earth')!.flattening!,
  );
});

void test('prograde orbits have northward angular momentum, matching axial rotation', () => {
  const p = orbitPosition(earth, 0);
  const q = orbitPosition(earth, 0.01);
  const angularMomentumY = p[2] * q[0] - p[0] * q[2];
  assert.ok(angularMomentumY > 0);
});
