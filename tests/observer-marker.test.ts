import assert from 'node:assert/strict';
import test from 'node:test';
import {
  observerSurfacePoint,
  observerViewDirection,
} from '../components/observer-marker';
import { bodyOrientation } from '../lib/ephemeris';
import { Vector3 } from 'three';

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

void test('Earth location framing faces the marker at normal body-view distance', () => {
  for (const location of [
    { latitude: 31.23, longitude: 121.47 },
    { latitude: -33.87, longitude: 151.21 },
    { latitude: 90, longitude: 0 },
  ]) {
    for (const days of [0, 0.25, 8766]) {
      const orientation = bodyOrientation('earth', days);
      const direction = observerViewDirection(location, orientation);
      const marker = observerSurfacePoint(
        location.latitude,
        location.longitude,
      ).applyQuaternion(orientation);
      for (const distance of [6, 42, 0.001]) {
        const center = new Vector3(120, -4, 27);
        const camera = center.clone().addScaledVector(direction, distance);
        assert.ok(Math.abs(camera.distanceTo(center) - distance) < 1e-12);
        assert.ok(marker.dot(camera.sub(center).normalize()) > 1 - 1e-12);
      }
    }
  }
});
