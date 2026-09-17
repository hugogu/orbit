import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createOrbitLine,
  isOrbitLine,
  ORBIT_PATH_SEGMENTS,
  sampleClosedOrbit,
  setOrbitLineForeground,
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
  setOrbitLineForeground(line, true);
  assert.equal(line.renderOrder, 1);
  setOrbitLineForeground(line, false);
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

void test('closed orbit sampling distributes endpoint drift without a seam kink', () => {
  const phases: number[] = [];
  const points = sampleClosedOrbit((phase) => {
    phases.push(phase);
    const angle = phase * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) + phase * 0.25,
      Math.sin(angle),
      phase * 0.1,
    );
  });
  assert.equal(points.length, ORBIT_PATH_SEGMENTS + 1);
  assert.equal(phases.length, ORBIT_PATH_SEGMENTS + 1);
  assert.equal(phases.at(-1), 1);
  assert.deepEqual(points[0].toArray(), points.at(-1)!.toArray());
  for (const index of [1, 511, 1024, 2047]) {
    const angle = (index / ORBIT_PATH_SEGMENTS) * Math.PI * 2;
    assert.ok(
      points[index].distanceTo(
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0),
      ) < 1e-12,
    );
  }
  const outgoing = points[1].clone().sub(points[0]).normalize();
  const incoming = points.at(-1)!.clone().sub(points.at(-2)!).normalize();
  assert.ok(outgoing.angleTo(incoming) < 0.004);
});
