import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSunEffects } from '../components/sun-effects.ts';

void test('camera orbits change only the corona billboard; plasma stays anchored to the Sun', () => {
  const effects = createSunEffects(4.8, new THREE.MeshBasicMaterial());
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 30);
  const spin = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    0.4,
  );
  const plasma = effects.root.getObjectByName('sun-prominences')!;
  const corona = effects.root.getObjectByName('sun-corona')!;
  effects.update(0, camera, spin);
  const originalBillboard = corona.quaternion.clone();
  const originalPlasma = plasma.quaternion.clone();

  camera.position.set(20, 10, -30);
  camera.lookAt(10, -20, 0);
  effects.update(5, camera, spin);
  assert.ok(plasma.quaternion.equals(originalPlasma));
  assert.ok(!corona.quaternion.equals(originalBillboard));
  assert.ok(effects.root.quaternion.equals(new THREE.Quaternion()));
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(corona.quaternion);
  assert.ok(normal.distanceTo(camera.position.clone().normalize()) < 1e-6);

  spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.8);
  effects.update(6, camera, spin);
  assert.ok(plasma.quaternion.equals(spin));
});

void test('the apparent solar limb follows perspective and real-size parent scaling', () => {
  for (const scale of [0.00001, 1, 20]) {
    const parent = new THREE.Group();
    const effects = createSunEffects(1, new THREE.MeshBasicMaterial());
    parent.add(effects.root);
    parent.scale.setScalar(scale);
    parent.rotation.y = 0.3;
    const camera = new THREE.PerspectiveCamera();
    camera.position.z = scale * 3;
    effects.update(4, camera, new THREE.Quaternion());
    const corona = effects.root.getObjectByName('sun-corona')!;
    const planeDistance =
      corona.getWorldPosition(new THREE.Vector3()).z / scale;
    const apparentRadius = corona.scale.x / 5.2 / (3 - planeDistance);
    assert.ok(Math.abs(apparentRadius - 1 / Math.sqrt(8)) < 1e-6);
    assert.ok(
      corona
        .getWorldQuaternion(new THREE.Quaternion())
        .angleTo(camera.quaternion) < 1e-6,
    );

    effects.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      assert.ok(
        object.material.depthTest,
        'foreground planets must occlude solar emission',
      );
      assert.equal(
        object.material.depthWrite,
        false,
        'transparent effects must not occlude each other',
      );
      const positions = object.geometry.attributes.position.array;
      assert.ok([...positions].every(Number.isFinite));
      object.geometry.dispose();
      object.material.dispose();
    });
  }
});
