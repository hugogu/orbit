import assert from 'node:assert/strict';
import test from 'node:test';
import { observerSurfacePoint } from '../components/observer-marker';

void test('observer coordinates map to the Earth surface frame', () => {
  const equator = observerSurfacePoint(0, 0);
  assert.ok(Math.abs(equator.x - 1) < 1e-12);
  assert.ok(Math.abs(equator.y) < 1e-12);
  assert.ok(Math.abs(equator.z) < 1e-12);

  const northPole = observerSurfacePoint(90, 123);
  assert.ok(Math.abs(northPole.x) < 1e-12);
  assert.ok(Math.abs(northPole.y - 1) < 1e-12);
  assert.ok(Math.abs(northPole.z) < 1e-12);

  const location = observerSurfacePoint(31.23, 121.47);
  assert.ok(Math.abs(location.length() - 1) < 1e-12);
});
