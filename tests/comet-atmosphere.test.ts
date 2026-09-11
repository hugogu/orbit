import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCometAtmosphere } from '../components/comet-atmosphere';
import {
  cometOrbitPoint,
  cometPosition,
  comets,
  cometPerihelion,
} from '../lib/comets';
import { DAY_MS, J2000_MS } from '../lib/simulation-time';

void test('ion tails point away from the Sun and dust curves behind prograde and retrograde comets', () => {
  const effect = createCometAtmosphere();
  for (const comet of comets) {
    const normal = new THREE.Vector3(...cometOrbitPoint(comet, 0))
      .cross(new THREE.Vector3(...cometOrbitPoint(comet, Math.PI / 2)))
      .normalize();
    const peri = (cometPerihelion(comet, -10000) - J2000_MS) / DAY_MS;
    for (const offset of [-10, 0, 10]) {
      const days = peri + offset;
      const position = new THREE.Vector3(...cometPosition(comet, days));
      effect.update(position, normal, days, true);
      const away = new THREE.Vector3(0, 1, 0).applyQuaternion(
        effect.group.quaternion,
      );
      const trailing = new THREE.Vector3(1, 0, 0).applyQuaternion(
        effect.group.quaternion,
      );
      const velocity = new THREE.Vector3(
        ...cometPosition(comet, days + 0.001),
      ).sub(position);
      assert.ok(away.dot(position.clone().normalize()) > 0.99999, comet.id);
      assert.ok(
        trailing.dot(velocity) < 0,
        `${comet.id} dust must trail orbital motion`,
      );
      assert.ok(Math.abs(trailing.dot(away)) < 1e-10);
      assert.equal(effect.group.visible, true);
      assert.ok(effect.group.position.distanceTo(position) < 1e-10);
    }
  }
});

void test('atmosphere follows UTC pause/seek, fades with distance, and skips work when disabled', () => {
  const effect = createCometAtmosphere();
  const normal = new THREE.Vector3(0, 0, 1);
  const near = new THREE.Vector3(3.1, 0, 0);
  const ion = effect.group.getObjectByName('ion-tail') as THREE.Mesh<
    THREE.InstancedBufferGeometry,
    THREE.ShaderMaterial
  >;
  const dust = effect.group.getObjectByName('dust-tail') as typeof ion;
  effect.update(near, normal, 1000, true);
  const initial = JSON.stringify(ion.material.uniforms);
  const buffer = ion.geometry.getAttribute('progress');
  effect.update(near, normal, 1000, true);
  assert.equal(
    JSON.stringify(ion.material.uniforms),
    initial,
    'paused time freezes animation',
  );
  effect.update(near, normal, 1000.5, true);
  assert.notEqual(JSON.stringify(ion.material.uniforms), initial);
  effect.update(near, normal, 1000, true);
  assert.equal(
    JSON.stringify(ion.material.uniforms),
    initial,
    'seeking reproduces the same state',
  );
  assert.equal(
    ion.geometry.getAttribute('progress'),
    buffer,
    'no particle buffers rebuilt per frame',
  );
  assert.equal(ion.material.uniforms.bend.value, 0);
  assert.ok(dust.material.uniforms.bend.value > 0);
  const nearLength = ion.material.uniforms.tailLength.value;
  effect.update(near.clone().multiplyScalar(3), normal, 1000, true);
  assert.ok(ion.material.uniforms.activity.value < 1);
  assert.ok(ion.material.uniforms.tailLength.value < nearLength);
  const faded = JSON.stringify(ion.material.uniforms);
  effect.update(near, normal, 2000, false);
  assert.equal(effect.group.visible, false);
  assert.equal(
    JSON.stringify(ion.material.uniforms),
    faded,
    'disabled effect does not update shaders',
  );
  effect.update(near.clone().multiplyScalar(5), normal, 2000, true);
  assert.equal(effect.group.visible, false, 'inactive comet has no tail');
  effect.update(near, normal, 1000, true);
  assert.equal(effect.group.visible, true);
  assert.equal(JSON.stringify(ion.material.uniforms), initial);
});

void test('the atmosphere has a fixed geometry budget, preserves depth occlusion, and never intercepts navigation', () => {
  const effect = createCometAtmosphere();
  assert.equal(effect.group.children.length, 3);
  let triangles = 0;
  for (const object of effect.group.children) {
    const mesh = object as THREE.Mesh<
      THREE.InstancedBufferGeometry,
      THREE.ShaderMaterial
    >;
    const instances = mesh.geometry.instanceCount ?? 1;
    triangles += (mesh.geometry.index!.count / 3) * instances;
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.depthWrite, false);
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    assert.equal(hits.length, 0);
    let disposed = false;
    mesh.geometry.addEventListener('dispose', () => {
      disposed = true;
    });
    mesh.geometry.dispose();
    mesh.material.dispose();
    assert.equal(disposed, true);
  }
  assert.ok(triangles <= 220, `${triangles} triangles`);
});
