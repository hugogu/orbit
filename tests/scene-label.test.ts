import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createSceneLabel,
  createSceneLabelOcclusion,
} from '../components/scene-label';

function labelFixture() {
  const writes: [string, unknown][] = [];
  const style = new Proxy(
    { display: '', transform: '' },
    {
      set(target, key: 'display' | 'transform', value: string) {
        writes.push([key, value]);
        target[key] = value;
        return true;
      },
    },
  );
  const label = {
    style,
    classList: {
      toggle: (_key: string, selected: boolean) =>
        writes.push(['selected', selected]),
    },
  } as unknown as HTMLElement;
  return { writes, style, project: createSceneLabel(label) };
}

void test('stationary and subpixel motion do not keep invalidating label layout', () => {
  const { writes, project, style } = labelFixture();
  project({ x: 0, y: 0, z: 0 }, 1000, 500, true);
  assert.equal(writes.length, 3);
  assert.match(style.transform, /500\.0px,250\.0px/);
  for (let frame = 0; frame < 600; frame++)
    project({ x: frame * 1e-8, y: 0, z: 0 }, 1000, 500, true);
  assert.equal(writes.length, 3, 'no DOM writes for imperceptible drift');
  project({ x: 0.2, y: 0.1, z: 0 }, 1000, 500, true, true);
  assert.match(style.transform, /600\.0px,225\.0px/);
  assert.deepEqual(writes.at(-1), ['selected', true]);
});

void test('hidden labels skip positions and selection until shown again', () => {
  const { writes, project, style } = labelFixture();
  for (let frame = 0; frame < 600; frame++)
    project({ x: frame, y: frame, z: 2 }, 1000, 500, true, true);
  assert.deepEqual(writes, [['display', 'none']]);
  project({ x: 0, y: 0, z: 0 }, 1000, 500, true, true);
  assert.equal(style.display, 'block');
  assert.deepEqual(writes.at(-1), ['selected', true]);
  project({ x: 0, y: 0, z: 0 }, 400, 800, true, false);
  assert.match(style.transform, /200\.0px,400\.0px/);
  project({ x: 0, y: 0, z: 0 }, 400, 800, false);
  assert.equal(style.display, 'none');
});

void test('labels are hidden when another body is between them and the camera', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const foreground = new THREE.Mesh(new THREE.SphereGeometry(2));
  foreground.position.z = 4;
  const background = new THREE.Mesh(new THREE.SphereGeometry(1));
  background.position.z = 0;
  const meshes = new Map([
    ['foreground', foreground],
    ['background', background],
  ]);
  const occlusion = createSceneLabelOcclusion(meshes);
  occlusion.update(camera);

  assert.equal(occlusion.isOccluded('background', background.position), true);
  assert.equal(occlusion.isOccluded('foreground', foreground.position), false);
  assert.equal(
    occlusion.isOccluded('background', new THREE.Vector3(4, 0, 0)),
    false,
  );
});

void test('scene labels accept the occluded state', () => {
  const { writes, project, style } = labelFixture();
  project({ x: 0, y: 0, z: 0 }, 1000, 500, true, false, true);
  assert.equal(style.display, 'none');
  assert.deepEqual(writes, [['display', 'none']]);
});
