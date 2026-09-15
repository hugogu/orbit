import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createOrbitLine,
  isOrbitLine,
  ORBIT_PATH_SEGMENTS,
  setOrbitLinePoints,
  setOrbitLineWidth,
} from '../components/orbit-line';
import { DEFAULT_ORBIT_LINE_WIDTH } from '../lib/orbit-line-width';

void test('orbit lines use a wide-line material and accept a configured pixel width', () => {
  assert.equal(ORBIT_PATH_SEGMENTS, 2048);
  const line = createOrbitLine(0xffffff, 0.3, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  assert.ok(isOrbitLine(line));
  assert.equal(
    line.material.color.getHex(),
    new THREE.Color(0xffffff).multiplyScalar(0.3).getHex(),
  );
  assert.equal(
    (line.material as typeof line.material & { linewidth: number }).linewidth,
    DEFAULT_ORBIT_LINE_WIDTH,
  );
  assert.equal(line.material.transparent, false);
  assert.equal(line.material.depthTest, false);
  assert.equal(line.material.depthWrite, false);
  assert.equal(line.renderOrder, -1);
  line.onBeforeRender({
    getViewport(target: THREE.Vector4) {
      return target.set(0, 0, 1920, 1080);
    },
  } as unknown as THREE.WebGLRenderer);
  assert.deepEqual(line.material.resolution.toArray(), [1920, 1080]);
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
