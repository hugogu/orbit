import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAsteroidBelt } from '../components/asteroid-belt';
import { advanceTime, DAY_MS, J2000_MS } from '../lib/simulation-time';

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
  const material = batches(belt.root)[0].material as THREE.MeshStandardMaterial;
  assert.ok(material.emissive.r > 0);
  assert.ok(material.emissiveIntensity > 0);
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
  assert.ok(
    scales.at(-1)! < 0.085,
    'background rocks stay much smaller than named asteroids',
  );
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
    belt.update(camera, 0);
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
    (mesh.geometry.getAttribute('beltMotion') as THREE.InstancedBufferAttribute)
      .version,
  ]);
  assert.equal(new Set(meshes.map((mesh) => mesh.material)).size, 1);
  assert.equal(triangleCount(belt.root), 36000);
  belt.update(new THREE.Vector3(37, 0, 0), 0);
  const near = meshes.map((mesh) => mesh.geometry);
  for (let i = 0; i < meshes.length; i++)
    assert.equal(
      near[i].getAttribute('beltMotion'),
      far[i].getAttribute('beltMotion'),
    );
  assert.equal(triangleCount(belt.root), 144000);
  // Distance is measured to the belt, including the far side of the Sun.
  belt.update(new THREE.Vector3(-37, 21, 0), 0);
  assert.equal(meshes[0].geometry, near[0]);
  belt.update(new THREE.Vector3(-37, 27, 0), 0);
  assert.equal(meshes[0].geometry, far[0]);
  belt.update(new THREE.Vector3(-37, 21, 0), 0);
  assert.equal(meshes[0].geometry, far[0], 'hysteresis avoids LOD flicker');
  belt.root.visible = false;
  belt.update(new THREE.Vector3(37, 0, 0), 0);
  assert.equal(meshes[0].geometry, far[0]);
  belt.root.visible = true;
  for (let i = 0; i < 1000; i++)
    belt.update(new THREE.Vector3(37, 0, 0), i * 10);
  assert.deepEqual(
    meshes.map((mesh) => [
      mesh.instanceMatrix.version,
      mesh.instanceColor!.version,
      (
        mesh.geometry.getAttribute(
          'beltMotion',
        ) as THREE.InstancedBufferAttribute
      ).version,
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

void test('orbital rates follow Kepler spacing while spin rates vary independently', () => {
  const { belt } = population();
  const matrix = new THREE.Matrix4();
  const center = new THREE.Vector3();
  const orbits: { radius: number; rate: number }[] = [];
  const spins = new Set<number>();
  for (const mesh of batches(belt.root)) {
    const motion = mesh.geometry.getAttribute('beltMotion');
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      center.setFromMatrixPosition(matrix);
      const au = 2.1 + ((center.length() - 35) / 5) * 1.2;
      const periodYears = 1 / (motion.getX(i) * 365.256);
      assert.ok(Math.abs(periodYears ** 2 / au ** 3 - 1) < 2e-6);
      orbits.push({ radius: center.length(), rate: motion.getX(i) });
      spins.add(motion.getY(i));
    }
  }
  orbits.sort((a, b) => a.radius - b.radius);
  assert.ok(orbits[0].rate / orbits.at(-1)!.rate > 1.9);
  for (let i = 1; i < orbits.length; i++)
    assert.ok(orbits[i].rate <= orbits[i - 1].rate);
  assert.ok(spins.size >= 6);
  assert.ok([...spins].every((rate) => Number.isInteger(rate) && rate > 0));
  belt.dispose();
});

void test('GPU motion shares the simulation clock through pause, acceleration, backward seeks, and hidden intervals', () => {
  const { belt } = population();
  const material = batches(belt.root)[0].material as THREE.MeshStandardMaterial;
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {} as Record<string, { value: unknown }>,
  };
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  const clock = shader.uniforms.beltTime.value as THREE.Vector2;
  const camera = new THREE.Vector3(37, 0, 0);
  let ms = J2000_MS + 1000.25 * DAY_MS;
  const update = () => belt.update(camera, (ms - J2000_MS) / DAY_MS);
  update();
  assert.deepEqual(clock.toArray(), [1000, 0.25]);
  ms = advanceTime(ms, 1, 365, true);
  update();
  assert.deepEqual(
    clock.toArray(),
    [1000, 0.25],
    'pause freezes orbital and spin phases',
  );
  ms = advanceTime(ms, 1, 365, false);
  update();
  assert.deepEqual(clock.toArray(), [1365, 0.25]);
  for (const days of [-109572.75, -0.001, 0, 73048.123456]) {
    belt.update(camera, days);
    assert.ok(Math.abs(clock.x + clock.y - days) < 1e-10);
    assert.ok(clock.y >= 0 && clock.y < 1);
  }
  belt.root.visible = false;
  belt.update(camera, 42.5);
  belt.root.visible = true;
  belt.update(camera, 42.5);
  assert.deepEqual(
    clock.toArray(),
    [42, 0.5],
    'seeking while hidden must not leave stale motion',
  );
  assert.match(shader.vertexShader, /mvPosition = beltMatrix \* mvPosition/);
  assert.match(
    shader.vertexShader,
    /worldPosition = beltMatrix \* worldPosition/,
  );
  assert.match(shader.vertexShader, /mat3 im = mat3\( beltMatrix \)/);
  assert.equal(shader.fragmentShader, THREE.ShaderLib.standard.fragmentShader);
  belt.dispose();
});

void test('culling bounds enclose every orbit and spin phase in either detail level', () => {
  const { belt } = population();
  const matrix = new THREE.Matrix4();
  const center = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();
  const orbit = new THREE.Quaternion();
  const point = new THREE.Vector3();
  for (const camera of [
    new THREE.Vector3(0, 115, 170),
    new THREE.Vector3(37, 0, 0),
  ]) {
    for (const days of [-109572.125, 0.4, 365.75, 73048.3]) {
      belt.update(camera, days);
      for (const mesh of batches(belt.root)) {
        const positions = mesh.geometry.getAttribute('position');
        const motion = mesh.geometry.getAttribute('beltMotion');
        for (let i = 0; i < mesh.count; i += 5) {
          mesh.getMatrixAt(i, matrix);
          matrix.decompose(center, orientation, scale);
          orbit.setFromAxisAngle(axis, days * motion.getX(i) * 2 * Math.PI);
          spin.setFromAxisAngle(axis, days * motion.getY(i) * 2 * Math.PI);
          center.applyQuaternion(orbit);
          orientation.premultiply(orbit).multiply(spin);
          matrix.compose(center, orientation, scale);
          for (let j = 0; j < positions.count; j++) {
            point.fromBufferAttribute(positions, j).applyMatrix4(matrix);
            assert.ok(mesh.boundingSphere!.containsPoint(point));
          }
        }
      }
    }
  }
  belt.dispose();
});
