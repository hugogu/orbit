import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { visibleTextureNames } from '../components/texture-visibility';

void test('visible bodies load without selection, while hidden and subpixel bodies wait', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 10;
  camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene();
  const body = (radius: number, x = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return mesh;
  };
  const center = body(0.5);
  const edge = body(0.5, 5.9);
  const outside = body(0.5, 10);
  const behind = body(0.5, 0, 20);
  const tiny = body(0.005);
  const hidden = body(0.5);
  hidden.visible = false;
  const hiddenParent = new THREE.Group();
  hiddenParent.visible = false;
  scene.add(hiddenParent);
  const hiddenChild = body(0.5);
  hiddenParent.add(hiddenChild);

  assert.deepEqual(
    visibleTextureNames(camera, 800, [
      { name: 'center', mesh: center },
      { name: 'edge', mesh: edge },
      { name: 'outside', mesh: outside },
      { name: 'behind', mesh: behind },
      { name: 'tiny', mesh: tiny },
      { name: 'hidden', mesh: hidden },
      { name: 'hiddenChild', mesh: hiddenChild },
    ]),
    ['center', 'edge'],
  );
});
