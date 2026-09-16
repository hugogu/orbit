import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAsteroidBelt } from '../components/asteroid-belt';

function population() {
  let seed = 71;
  let samples = 0;
  const belt = createAsteroidBelt(() => {
    samples++;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  return { belt, samples };
}

function batches(root: THREE.Group) {
  return root.children as THREE.InstancedMesh[];
}

function triangleCount(root: THREE.Group) {
  return batches(root).reduce(
    (total, mesh) =>
      total + (mesh.geometry.getAttribute('position').count / 3) * mesh.count,
    0,
  );
}

void test('belt keeps a deterministic sparse population with varied sizes, shapes, and colors', () => {
  const { belt, samples } = population();
  const repeat = population().belt;
  assert.equal(samples, 5400, 'do not perturb the existing outer populations');
  assert.equal(belt.root.children.length, 6);
  assert.equal(
    batches(belt.root).reduce((sum, mesh) => sum + mesh.count, 0),
    1800,
  );
  const scales: number[] = [];
  const colors = new Set<string>();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  for (const [i, mesh] of batches(belt.root).entries()) {
    assert.deepEqual(
      mesh.instanceMatrix.array,
      batches(repeat.root)[i].instanceMatrix.array,
    );
    assert.deepEqual(
      mesh.instanceColor!.array,
      batches(repeat.root)[i].instanceColor!.array,
    );
    for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, matrix);
      matrix.decompose(position, quaternion, scale);
      assert.ok(
        position.length() >= 35 - 1e-5 && position.length() <= 40 + 1e-5,
      );
      assert.ok(Math.abs(position.y) <= 1);
      assert.ok(matrix.determinant() > 0);
      scales.push(Math.cbrt(scale.x * scale.y * scale.z));
      colors.add(
        Array.from(mesh.instanceColor!.array.slice(j * 3, j * 3 + 3)).join(','),
      );
    }
  }
  scales.sort((a, b) => a - b);
  assert.ok(scales.at(-1)! / scales[0] > 5);
  assert.ok(scales[900] < scales.at(-1)! * 0.35, 'small rocks should dominate');
  assert.ok(colors.size > 1000);
  assert.equal(
    new Set(
      batches(belt.root).map((mesh) =>
        Array.from(mesh.geometry.getAttribute('position').array).join(','),
      ),
    ).size,
    6,
  );
  belt.dispose();
  repeat.dispose();
});

void test('both detail levels have closed finite rock surfaces and conservative instance bounds', () => {
  const { belt } = population();
  const matrix = new THREE.Matrix4();
  const point = new THREE.Vector3();
  for (const camera of [
    new THREE.Vector3(0, 115, 170),
    new THREE.Vector3(37, 2, 0),
  ]) {
    belt.update(camera);
    for (const mesh of batches(belt.root)) {
      const positions = mesh.geometry.getAttribute('position');
      const normals = mesh.geometry.getAttribute('normal');
      const edges = new Map<string, number>();
      for (let i = 0; i < positions.count; i += 3) {
        const vertices = [i, i + 1, i + 2].map((j) => {
          point.fromBufferAttribute(positions, j);
          assert.ok(point.toArray().every(Number.isFinite));
          assert.ok(
            new THREE.Vector3().fromBufferAttribute(normals, j).length() > 0.99,
          );
          return point
            .toArray()
            .map((value) => value.toFixed(6))
            .join(',');
        });
        for (let j = 0; j < 3; j++) {
          const edge = [vertices[j], vertices[(j + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      assert.ok(
        [...edges.values()].every((count) => count === 2),
        'no open seams',
      );
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        for (let j = 0; j < positions.count; j++) {
          point.fromBufferAttribute(positions, j).applyMatrix4(matrix);
          assert.ok(mesh.boundingSphere!.distanceToPoint(point) < 1e-5);
        }
      }
    }
  }
  belt.dispose();
});

void test('scene integration bounds rendering cost, avoids buffer uploads, and releases both LODs', () => {
  const scene = new THREE.Scene();
  const { belt } = population();
  scene.add(belt.root);
  const meshes = batches(belt.root);
  const far = meshes.map((mesh) => mesh.geometry);
  const versions = meshes.map((mesh) => [
    mesh.instanceMatrix.version,
    mesh.instanceColor!.version,
  ]);
  assert.equal(new Set(meshes.map((mesh) => mesh.material)).size, 1);
  assert.equal(triangleCount(belt.root), 36000);
  belt.update(new THREE.Vector3(37, 0, 0));
  const near = meshes.map((mesh) => mesh.geometry);
  assert.equal(triangleCount(belt.root), 144000);
  // Distance is measured to the belt, including the far side of the Sun.
  belt.update(new THREE.Vector3(-37, 21, 0));
  assert.equal(meshes[0].geometry, near[0]);
  belt.update(new THREE.Vector3(-37, 27, 0));
  assert.equal(meshes[0].geometry, far[0]);
  belt.update(new THREE.Vector3(-37, 21, 0));
  assert.equal(meshes[0].geometry, far[0], 'hysteresis avoids LOD flicker');
  belt.root.visible = false;
  belt.update(new THREE.Vector3(37, 0, 0));
  assert.equal(meshes[0].geometry, far[0]);
  belt.root.visible = true;
  for (let i = 0; i < 1000; i++) belt.update(new THREE.Vector3(37, 0, 0));
  assert.deepEqual(
    meshes.map((mesh) => [
      mesh.instanceMatrix.version,
      mesh.instanceColor!.version,
    ]),
    versions,
  );
  let disposedGeometries = 0;
  let disposedMeshes = 0;
  let disposedMaterials = 0;
  for (const geometry of [...far, ...near])
    geometry.addEventListener('dispose', () => disposedGeometries++);
  for (const mesh of meshes)
    mesh.addEventListener('dispose', () => disposedMeshes++);
  (meshes[0].material as THREE.Material).addEventListener(
    'dispose',
    () => disposedMaterials++,
  );
  belt.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(belt.root.children.length, 0);
  assert.equal(disposedGeometries, 12);
  assert.equal(disposedMeshes, 6);
  assert.equal(disposedMaterials, 1);
});
