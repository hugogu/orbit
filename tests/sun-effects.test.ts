import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSunEffects } from '../components/sun-effects.ts';

void test('sun effects add a billboarded corona, rays, and animated prominences', () => {
  const effects = createSunEffects(4.8);
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.set(0.2, -0.35, 0.1);
  camera.updateMatrixWorld();

  const corona = effects.root.getObjectByName('sun-corona') as THREE.Mesh;
  const rays = effects.root.getObjectByName('sun-rays') as THREE.Group;
  const prominences = effects.root.getObjectByName(
    'sun-prominences',
  ) as THREE.Group;
  assert.ok(corona.material instanceof THREE.ShaderMaterial);
  assert.equal(rays.children.length, 15);
  assert.equal(prominences.children.length, 8);

  effects.update(0, camera);
  const initialRayRotation = rays.rotation.z;
  effects.update(4, camera);
  assert.ok(effects.root.quaternion.angleTo(camera.quaternion) < 1e-6);
  assert.notEqual(rays.rotation.z, initialRayRotation);
  assert.equal(
    (corona.material as THREE.ShaderMaterial).uniforms.time.value,
    4,
  );
});
