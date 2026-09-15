import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createOrbitLine,
  isOrbitLine,
  setOrbitLinePoints,
  setOrbitLineWidth,
} from '../components/orbit-line';
import { DEFAULT_ORBIT_LINE_WIDTH } from '../lib/orbit-line-width';

void test('orbit lines use a wide-line material and accept a configured pixel width', () => {
  const line = createOrbitLine(0xffffff, 0.3, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  assert.ok(isOrbitLine(line));
  assert.equal(
    (line.material as typeof line.material & { linewidth: number }).linewidth,
    DEFAULT_ORBIT_LINE_WIDTH,
  );
  const before = line.geometry;
  setOrbitLineWidth(line, 5);
  setOrbitLinePoints(line, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  assert.notEqual(line.geometry, before);
  assert.equal(
    (line.material as typeof line.material & { linewidth: number }).linewidth,
    5,
  );
  line.geometry.dispose();
  line.material.dispose();
});
