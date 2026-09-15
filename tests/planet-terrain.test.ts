import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp/lib/index.js';
import * as THREE from 'three';
import { bodies } from '../lib/solar';
import {
  createTerrainGeometry,
  sampleTerrainHeight,
  terrainElevationKm,
  terrainNormal,
  oblateScale,
  type HeightField,
  type TerrainParameters,
} from '../lib/planet-terrain';
import { resampleElevation } from '../scripts/generate-planet-terrain';
import {
  registerPlanetSurface,
  registerTerrainGeometry,
} from '../components/planet-surface';
import { createTextureManager } from '../components/texture-manager';
import { texturePath } from '../lib/texture-quality';
import { createSceneLabelOcclusion } from '../components/scene-label';
import { orbitingMoons } from '../lib/moon-orbits';

function fieldFrom(values: number[], width: number): HeightField {
  const data = new Uint8Array(values.length * 3);
  values.forEach((value, i) => {
    const packed = Math.round(value * 65535);
    data[i * 3] = packed >> 8;
    data[i * 3 + 1] = packed & 255;
  });
  return { data, width, height: values.length / width, channels: 3 };
}
const testBody: TerrainParameters = {
  id: 'test',
  radius: 100,
  terrainMinKm: 0,
  terrainMaxKm: 1,
};

void test('resampling respects source longitude, cell averages, nodata, and gridline seams', () => {
  const grid = {
    data: [10, 20, 30, 40, 10, 20, 30, 40],
    width: 4,
    height: 2,
    west: 0,
  };
  assert.deepEqual(
    [...resampleElevation(grid, 4, 2)],
    [30, 40, 10, 20, 30, 40, 10, 20],
  );
  assert.deepEqual(
    [...resampleElevation({ ...grid, west: -180 }, 2, 1)],
    [15, 35],
  );
  assert.deepEqual(
    [
      ...resampleElevation(
        {
          ...grid,
          data: [-32768, 20, 30, 40, -32768, 20, 30, 40],
          west: -180,
          nodata: -32768,
        },
        2,
        1,
      ),
    ],
    [20, 35],
  );
  const gridline = {
    data: [0, 10, 20, 30, 0, 0, 10, 20, 30, 0, 0, 10, 20, 30, 0],
    width: 5,
    height: 3,
    west: -180,
    gridline: true,
  };
  assert.deepEqual(
    [...resampleElevation(gridline, 4, 2)],
    [5, 15, 25, 15, 5, 15, 25, 15],
  );
});

void test('published terrain landmarks occupy the correct hemisphere and normals use the same heights', async () => {
  for (const [id, lon, lat, minimum, maximum] of [
    ['earth', 86.9, 28, 4, 9],
    ['mars', -133.2, 18.65, 15, 23],
    ['mars', 70, -42.4, -9, -4],
    ['venus', 3, 65, 5, 13],
  ] as const) {
    const body = bodies.find((b) => b.id === id)! as TerrainParameters;
    const { data, info } = await sharp(
      `public/textures/planets/2k_${id}-height.png`,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    const field = {
      data,
      width: info.width,
      height: info.height,
      channels: info.channels,
    };
    const sample = sampleTerrainHeight(
      field,
      (lon + 180) / 360,
      (lat + 90) / 180,
    );
    const elevation = terrainElevationKm(sample, body);
    assert.ok(
      elevation > minimum && elevation < maximum,
      `${id} (${lon},${lat}): ${elevation} km`,
    );
    const normalMap = await sharp(`public/textures/planets/2k_${id}-normal.png`)
      .raw()
      .toBuffer();
    const x = Math.floor(((lon + 180) / 360) * info.width),
      y = Math.floor(((90 - lat) / 180) * info.height);
    const n = terrainNormal(
      field,
      body,
      (x + 0.5) / info.width,
      1 - (y + 0.5) / info.height,
    );
    const at = (y * info.width + x) * 3;
    const actual = new THREE.Vector3(
      ...[0, 1, 2].map((c) => normalMap[at + c] / 127.5 - 1),
    ).normalize();
    assert.ok(n.dot(actual) > 0.9999, `${id} normal/geometry alignment`);
  }
});

void test('LOLA terrain preserves the South Pole–Aitken basin in the Moon geometry', async () => {
  const moon = orbitingMoons.find((body) => body.en === 'Moon')!;
  const { data, info } = await sharp(
    'public/textures/planets/2k_moon-height.png',
  )
    .raw()
    .toBuffer({ resolveWithObject: true });
  const field = {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
  const elevation = terrainElevationKm(
    sampleTerrainHeight(field, (180 + 180) / 360, (-53 + 90) / 180),
    {
      id: moon.id,
      radius: moon.radius!,
      terrainMinKm: moon.terrainMinKm!,
      terrainMaxKm: moon.terrainMaxKm!,
    },
  );
  assert.ok(
    elevation > -6 && elevation < -3,
    `South Pole–Aitken elevation: ${elevation} km`,
  );
});

void test('terrain geometry updates bounds and picking, closes poles/seams, and shades its slopes', () => {
  const uniform = fieldFrom(Array(32).fill(1), 8);
  const geometry = createTerrainGeometry(uniform, testBody, 1);
  assert.ok(Math.abs(geometry.boundingSphere!.radius - 1.06) < 1e-5);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 3),
    new THREE.Vector3(0, 0, -1),
  );
  assert.ok(Math.abs(ray.intersectObject(mesh)[0].point.z - 1.06) < 1e-5);
  const slopes = fieldFrom(
    Array.from({ length: 32 }, (_, i) => (i % 8) / 7),
    8,
  );
  const deformed = createTerrainGeometry(slopes, testBody, 1);
  const p = deformed.getAttribute('position'),
    n = deformed.getAttribute('normal');
  for (let row = 1; row < 128; row++) {
    const a = row * 257,
      b = a + 256;
    assert.ok(
      new THREE.Vector3()
        .fromBufferAttribute(p, a)
        .distanceTo(new THREE.Vector3().fromBufferAttribute(p, b)) < 1e-6,
    );
    assert.ok(
      new THREE.Vector3()
        .fromBufferAttribute(n, a)
        .equals(new THREE.Vector3().fromBufferAttribute(n, b)),
    );
  }
  for (const row of [0, 128])
    for (let col = 1; col <= 256; col++)
      assert.ok(
        new THREE.Vector3()
          .fromBufferAttribute(p, row * 257)
          .distanceTo(
            new THREE.Vector3().fromBufferAttribute(p, row * 257 + col),
          ) < 1e-6,
      );
  const index = 64 * 257 + 128;
  assert.ok(
    new THREE.Vector3()
      .fromBufferAttribute(p, index)
      .normalize()
      .dot(new THREE.Vector3().fromBufferAttribute(n, index)) < 0.999999,
  );
  assert.equal(
    terrainElevationKm(0, { ...testBody, id: 'earth', terrainMinKm: -10 }),
    0,
  );
  geometry.dispose();
  deformed.dispose();
  material.dispose();
});

void test('oblate planets preserve volumetric mean radius and measured flattening', () => {
  for (const body of bodies) {
    const s = oblateScale(body.flattening);
    assert.ok(Math.abs(s.x * s.y * s.z - 1) < 1e-12, body.id);
    assert.ok(
      Math.abs(1 - s.y / s.x - (body.flattening ?? 0)) < 1e-12,
      body.id,
    );
  }
});

void test('independent planet surface toggles restore meshes, reject late loads, and hide Venus clouds', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const textures = createTextureManager(
    {
      capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 1 },
    } as THREE.WebGLRenderer,
    () => {},
  );
  const venus = bodies.find((b) => b.id === 'venus')!;
  const base = new THREE.SphereGeometry(venus.size, 96, 64);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(base, material);
  const surface = registerPlanetSurface(venus, mesh, textures, () =>
    fieldFrom(Array(32).fill(1), 8),
  );
  const finish = async (name: string) => {
    const texture = new THREE.Texture();
    pending.get(texturePath(name, false, 8192))!(texture);
    await new Promise((resolve) => setImmediate(resolve));
    return texture;
  };
  const update = (active: string[]) =>
    textures.update('standard', venus.texture!, false, false, true, active);
  const clouds = await finish(venus.texture!);
  assert.equal(material.map, clouds);
  update([venus.heightTexture!]);
  await finish(venus.heightTexture!);
  const dense = mesh.geometry;
  const disposed = t.mock.method(dense, 'dispose');
  assert.notEqual(dense, base);
  assert.equal(material.normalMap, null);
  assert.equal(material.map, null);
  update([venus.heightTexture!, venus.surfaceTexture!]);
  await finish(venus.surfaceTexture!);
  assert.equal(mesh.geometry, dense);
  assert.equal(material.normalMapType, THREE.ObjectSpaceNormalMap);
  update([venus.surfaceTexture!]);
  assert.equal(mesh.geometry, base);
  assert.equal(disposed.mock.callCount(), 1);
  assert.equal(material.map, null);
  update([]);
  assert.equal(material.map, clouds);
  assert.equal(material.normalMap, null);
  update([venus.heightTexture!]);
  update([]);
  const stale = await finish(venus.heightTexture!);
  assert.equal(mesh.geometry, base);
  assert.notEqual(material.map, stale);
  textures.dispose();
  surface.dispose();
  base.dispose();
  material.dispose();
});

void test('the Moon replaces and restores only its focused terrain geometry', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const textures = createTextureManager(
    {
      capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 1 },
    } as THREE.WebGLRenderer,
    () => {},
  );
  const moon = orbitingMoons.find((body) => body.en === 'Moon')!;
  const base = new THREE.SphereGeometry(moon.size, 64, 48);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(base, material);
  const surface = registerTerrainGeometry(
    {
      id: moon.id,
      heightTexture: moon.heightTexture!,
      terrainMinKm: moon.terrainMinKm!,
      terrainMaxKm: moon.terrainMaxKm!,
      radius: moon.radius!,
      size: moon.size,
    },
    mesh,
    textures,
    () => fieldFrom(Array(32).fill(1), 8),
  );
  textures.update('standard', moon.texture, false, false, true, [
    moon.heightTexture!,
  ]);
  const texture = new THREE.Texture();
  pending.get(texturePath(moon.heightTexture!, false, 8192))!(texture);
  await new Promise((resolve) => setImmediate(resolve));
  const dense = mesh.geometry;
  assert.notEqual(dense, base);
  textures.update('standard', moon.texture, false, false, true, []);
  assert.equal(mesh.geometry, base);
  surface.dispose();
  textures.dispose();
  base.dispose();
  material.dispose();
});

void test('label occlusion follows a replaced terrain/model geometry', () => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1));
  mesh.position.set(0.5, 0, 0);
  mesh.updateMatrixWorld();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 3);
  camera.updateMatrixWorld();
  const labels = createSceneLabelOcclusion(new Map([['occluder', mesh]]));
  labels.update(camera);
  assert.equal(labels.isOccluded('target', new THREE.Vector3(0, 0, -3)), false);
  mesh.geometry.dispose();
  mesh.geometry = new THREE.SphereGeometry(0.8);
  labels.update(camera);
  assert.equal(labels.isOccluded('target', new THREE.Vector3(0, 0, -3)), true);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});
