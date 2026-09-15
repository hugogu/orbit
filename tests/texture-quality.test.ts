import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync, existsSync } from 'node:fs';
import { createTextureManager } from '../components/texture-manager';
import { bodies } from '../lib/solar';
import {
  highResolutionTextures,
  texturePath,
  shouldLoadHighResolution,
} from '../lib/texture-quality';

void test('quality respects device preferences, GPU limits and actual source resolutions', () => {
  assert.equal(shouldLoadHighResolution('auto', true, false), false);
  assert.equal(shouldLoadHighResolution('auto', false, true), false);
  assert.equal(shouldLoadHighResolution('auto', false, false), true);
  assert.equal(shouldLoadHighResolution('ultra', true, true), true);
  assert.equal(shouldLoadHighResolution('standard', false, false), false);
  assert.equal(
    texturePath('earth_daymap', true, 4096),
    '/textures/2k_earth_daymap.jpg',
  );
  assert.equal(texturePath('jupiter', true, 4096), '/textures/8k_jupiter.jpg');
  assert.equal(texturePath('uranus', true, 8192), '/textures/2k_uranus.jpg');
  const manifest = JSON.parse(
    readFileSync(
      new URL('../public/textures/source-manifest.json', import.meta.url),
      'utf8',
    ),
  ) as { filename: string; width: number }[];
  for (const [name, map] of Object.entries(highResolutionTextures)) {
    assert.equal(
      manifest.find((m) => m.filename === map.file)?.width,
      map.width,
    );
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, true, 8192)}`, import.meta.url),
      ),
    );
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, false, 8192)}`, import.meta.url),
      ),
    );
  }
});

void test('every body texture is registered and has a local fallback', () => {
  assert.ok(highResolutionTextures.uranus, 'Uranus map catalog entry');
  assert.ok(highResolutionTextures.pluto, 'Pluto map catalog entry');
  for (const body of bodies.filter((body) => body.texture)) {
    const name = body.texture!;
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, false, 8192)}`, import.meta.url),
      ),
      `${body.id} fallback map`,
    );
    if (highResolutionTextures[name]) {
      assert.ok(
        existsSync(
          new URL(`../public${texturePath(name, true, 8192)}`, import.meta.url),
        ),
        `${body.id} high-resolution map`,
      );
    }
  }
});

void test('asteroid maps load without waiting for a focused selection', () => {
  const scene = readFileSync('components/solar-scene.tsx', 'utf8');
  assert.match(
    scene,
    /asteroidSystem\.setTexture\(asteroid\.id, texture\)[\s\S]*?lazy: false/,
  );
  assert.match(
    scene,
    /asteroidSystem\.setNormalTexture\(asteroid\.id, texture\)[\s\S]*?lazy: false/,
  );
});

void test('terrestrial surface maps are body-specific and locally available', () => {
  const surfaceBodies = bodies.filter((body) => body.surfaceTexture);
  assert.deepEqual(
    surfaceBodies.map((body) => body.id),
    ['mercury', 'venus', 'earth', 'mars'],
  );
  for (const body of surfaceBodies) {
    const name = body.surfaceTexture!;
    assert.ok(highResolutionTextures[name], `${body.id} surface catalog entry`);
    assert.equal(
      texturePath(name, false, 8192),
      `/textures/planets/2k_${body.id}-normal.png?v=terrain-v2`,
    );
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, false, 8192)}`, import.meta.url),
      ),
      `${body.id} surface map`,
    );
  }
});

void test('terrestrial height maps have physical ranges and local fallbacks', () => {
  const terrainBodies = bodies.filter((body) => body.heightTexture);
  assert.deepEqual(
    terrainBodies.map((body) => body.id),
    ['mercury', 'venus', 'earth', 'mars'],
  );
  for (const body of terrainBodies) {
    const name = body.heightTexture!;
    assert.ok(highResolutionTextures[name], `${body.id} terrain catalog entry`);
    assert.ok(
      body.terrainMinKm !== undefined && body.terrainMaxKm !== undefined,
      `${body.id} terrain range`,
    );
    assert.ok(
      body.terrainMaxKm! > body.terrainMinKm!,
      `${body.id} terrain order`,
    );
    assert.ok(body.flattening !== undefined, `${body.id} physical flattening`);
    assert.equal(
      texturePath(name, false, 8192),
      `/textures/planets/2k_${body.id}-height.png?v=terrain-v2`,
    );
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, false, 8192)}`, import.meta.url),
      ),
      `${body.id} height map`,
    );
  }
});

void test('gapped moon maps use a cache-busted continuous revision', () => {
  const repaired = [
    'ariel',
    'miranda',
    'oberon',
    'titania',
    'triton',
    'umbriel',
  ];
  for (const name of repaired) {
    const map = highResolutionTextures[name];
    assert.equal(map.revision, 'filled-v1', `${name} revision marker`);
    assert.match(
      texturePath(name, false, 8192),
      /\?v=filled-v1$/,
      `${name} standard map cache key`,
    );
    assert.match(
      texturePath(name, true, 8192),
      /\?v=filled-v1$/,
      `${name} high map cache key`,
    );
  }
});

void test('opt-in surface maps skip preload and keep data color space', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  let visible: THREE.Texture | undefined;
  manager.register(
    'surface_earth_normal',
    (texture) => {
      visible = texture;
    },
    { lazy: true, preload: false, colorSpace: THREE.NoColorSpace },
  );
  manager.preload();
  assert.equal(pending.size, 0);
  manager.update('standard', 'earth_daymap', false, false, true, [
    'surface_earth_normal',
  ]);
  assert.deepEqual(
    [...pending.keys()],
    ['/textures/planets/2k_earth-normal.png?v=terrain-v2'],
  );
  const texture = new THREE.Texture();
  pending.get('/textures/planets/2k_earth-normal.png?v=terrain-v2')!(texture);
  pending.clear();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(visible, texture);
  assert.equal(texture.colorSpace, THREE.NoColorSpace);
  manager.dispose();
});

void test('opt-in height maps skip preload and keep data color space', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  let visible: THREE.Texture | undefined;
  manager.register(
    'terrain_earth',
    (texture) => {
      visible = texture;
    },
    { lazy: true, preload: false, colorSpace: THREE.NoColorSpace },
  );
  manager.preload();
  assert.equal(pending.size, 0);
  manager.update('standard', 'earth_daymap', false, false, true, [
    'terrain_earth',
  ]);
  assert.deepEqual(
    [...pending.keys()],
    ['/textures/planets/2k_earth-height.png?v=terrain-v2'],
  );
  const texture = new THREE.Texture();
  pending.get('/textures/planets/2k_earth-height.png?v=terrain-v2')!(texture);
  pending.clear();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(visible, texture);
  assert.equal(texture.colorSpace, THREE.NoColorSpace);
  manager.dispose();
});

void test('Ceres retains visited color and normal maps after selecting Mars, with seamless quality downgrades', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const manager = createTextureManager(
    {
      capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
    } as THREE.WebGLRenderer,
    () => {},
  );
  const material = new THREE.MeshStandardMaterial();
  const clear = t.mock.fn();
  const options = {
    lazy: true,
    preload: false,
    retainOnNavigation: true,
    clear,
  };
  manager.register(
    'asteroid_ceres',
    (texture) => {
      material.map = texture;
    },
    options,
  );
  manager.register(
    'asteroid_ceres_normal',
    (texture) => {
      material.normalMap = texture;
    },
    {
      ...options,
      colorSpace: THREE.NoColorSpace,
    },
  );
  manager.register('asteroid_bennu', () => {}, options);
  manager.preload();
  manager.update('standard', 'mars', false, false);
  assert.equal(pending.size, 0, 'unvisited asteroids remain lazy');
  const active = ['asteroid_ceres', 'asteroid_ceres_normal'];
  manager.update('standard', null, false, false, true, active);
  const color = new THREE.Texture(),
    normal = new THREE.Texture();
  const colorDispose = t.mock.method(color, 'dispose');
  const normalDispose = t.mock.method(normal, 'dispose');
  pending.get('/textures/asteroids/2k_ceres.jpg')!(color);
  pending.get('/textures/asteroids/2k_ceres-normal.png')!(normal);
  pending.clear();
  await new Promise((resolve) => setImmediate(resolve));
  manager.update('standard', 'mars', false, false);
  assert.equal(material.map, color);
  assert.equal(material.normalMap, normal);
  assert.equal(normal.colorSpace, THREE.NoColorSpace);
  assert.equal(clear.mock.callCount(), 0);
  assert.equal(colorDispose.mock.callCount(), 0);
  assert.equal(normalDispose.mock.callCount(), 0);
  assert.equal(pending.size, 0);

  manager.update('ultra', null, false, false, true, active);
  const highColor = new THREE.Texture(),
    highNormal = new THREE.Texture();
  const highDispose = t.mock.method(highColor, 'dispose');
  pending.get('/textures/asteroids/4k_ceres.jpg')!(highColor);
  pending.get('/textures/asteroids/4k_ceres-normal.png')!(highNormal);
  pending.clear();
  await new Promise((resolve) => setImmediate(resolve));
  manager.update('ultra', 'mars', false, false);
  assert.equal(
    material.map,
    highColor,
    'keep the old map until its replacement is ready',
  );
  assert.equal(highDispose.mock.callCount(), 0);
  const fallbackColor = new THREE.Texture(),
    fallbackNormal = new THREE.Texture();
  const fallbackDispose = t.mock.method(fallbackColor, 'dispose');
  pending.get('/textures/asteroids/2k_ceres.jpg')!(fallbackColor);
  pending.get('/textures/asteroids/2k_ceres-normal.png')!(fallbackNormal);
  pending.clear();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(material.map, fallbackColor);
  assert.equal(material.normalMap, fallbackNormal);
  assert.equal(highDispose.mock.callCount(), 1);
  assert.equal(clear.mock.callCount(), 0);
  manager.dispose();
  assert.equal(fallbackDispose.mock.callCount(), 1);
  material.dispose();
  const scene = readFileSync('components/solar-scene.tsx', 'utf8');
  for (const method of ['clearTexture', 'clearNormalTexture'])
    assert.match(
      scene,
      new RegExp(`retainOnNavigation: true,[^}]*asteroidSystem\\.${method}`),
    );
});

void test('rapid terrain toggles retain a shared pending texture and decoding failures release it', async (t) => {
  let finish!: (texture: THREE.Texture) => void;
  const loader = t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    () =>
      new Promise<THREE.Texture>((resolve) => {
        finish = resolve;
      }),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const notice = t.mock.fn();
  const manager = createTextureManager(renderer, notice);
  const apply = t.mock.fn();
  manager.register('terrain_earth', apply, { lazy: true, preload: false });
  const update = (active: boolean) =>
    manager.update(
      'standard',
      null,
      false,
      false,
      true,
      active ? ['terrain_earth'] : [],
    );
  update(true);
  update(false);
  update(true);
  assert.equal(loader.mock.callCount(), 1);
  const texture = new THREE.Texture();
  const dispose = t.mock.method(texture, 'dispose');
  finish(texture);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(apply.mock.callCount(), 1);
  assert.equal(dispose.mock.callCount(), 0);
  update(false);
  assert.equal(dispose.mock.callCount(), 1);

  manager.register(
    'terrain_mars',
    () => {
      throw new Error('decode failed');
    },
    {
      lazy: true,
      preload: false,
    },
  );
  manager.update('standard', null, false, false, true, ['terrain_mars']);
  const invalid = new THREE.Texture();
  const invalidDispose = t.mock.method(invalid, 'dispose');
  finish(invalid);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(invalidDispose.mock.callCount(), 1);
  assert.equal(notice.mock.callCount(), 1);
  manager.dispose();
});

void test('async texture swaps retain visible maps, discard stale loads and recover from failure', async (t) => {
  const pending = new Map<
    string,
    { resolve: (texture: THREE.Texture) => void; reject: () => void }
  >();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve, reject) =>
        pending.set(path, { resolve, reject }),
      ),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 16 },
  } as THREE.WebGLRenderer;
  const notices: string[] = [];
  const manager = createTextureManager(renderer, (message) =>
    notices.push(message),
  );
  let visible: THREE.Texture | undefined;
  const finish = async (path: string) => {
    const texture = new THREE.Texture();
    const dispose = t.mock.method(texture, 'dispose');
    assert.ok(pending.has(path), path);
    pending.get(path)!.resolve(texture);
    pending.delete(path);
    await Promise.resolve();
    return { texture, dispose };
  };
  manager.register('earth_daymap', (texture) => {
    visible = texture;
  });
  const standard = await finish('/textures/2k_earth_daymap.jpg');
  manager.update('ultra', 'earth_daymap', false, false);
  assert.equal(visible, standard.texture);
  manager.update('standard', 'earth_daymap', false, false);
  const stale = await finish('/textures/8k_earth_daymap.jpg');
  assert.equal(stale.dispose.mock.callCount(), 1);
  const replacement = await finish('/textures/2k_earth_daymap.jpg');
  assert.equal(visible, replacement.texture);
  assert.equal(standard.dispose.mock.callCount(), 1);
  manager.update('ultra', 'earth_daymap', false, false);
  pending.get('/textures/8k_earth_daymap.jpg')!.reject();
  pending.delete('/textures/8k_earth_daymap.jpg');
  await Promise.resolve();
  const fallback = await finish('/textures/2k_earth_daymap.jpg');
  manager.update('ultra', 'earth_daymap', false, false);
  assert.equal(pending.size, 0);
  assert.equal(notices.length, 1);
  assert.equal(visible, fallback.texture);
  manager.dispose();
  assert.equal(fallback.dispose.mock.callCount(), 1);
});

void test('navigation defers focused high-resolution upgrades until the transition settles', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  manager.register('earth_daymap', () => {});
  pending.get('/textures/2k_earth_daymap.jpg')!(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'earth_daymap', false, false, true, [], true);
  assert.equal(pending.has('/textures/8k_earth_daymap.jpg'), false);
  manager.update('ultra', 'earth_daymap', false, false);
  assert.equal(pending.has('/textures/8k_earth_daymap.jpg'), true);
  pending.get('/textures/8k_earth_daymap.jpg')!(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', null, false, false, true, [], true);
  manager.update('ultra', null, false, false);
  assert.equal(
    pending.has('/textures/2k_earth_daymap.jpg'),
    false,
    'keep the previous high-resolution map during navigation',
  );
  manager.update('standard', null, false, false, true, [], true);
  assert.equal(
    pending.has('/textures/2k_earth_daymap.jpg'),
    true,
    'an explicit standard-quality choice still applies during navigation',
  );
  pending.get('/textures/2k_earth_daymap.jpg')!(new THREE.Texture());
  manager.dispose();
});

void test('only the focused body and background upgrade; unmount disposes late arrivals', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  for (const name of [
    'earth_daymap',
    'earth_nightmap',
    'mars',
    'stars_milky_way',
  ])
    manager.register(name, () => {});
  for (const resolve of pending.values()) resolve(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'mars', false, false);
  assert.deepEqual([...pending.keys()].sort(), [
    '/textures/8k_mars.jpg',
    '/textures/8k_stars_milky_way.jpg',
  ]);
  for (const resolve of pending.values()) resolve(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'earth_daymap', false, false, false);
  assert.deepEqual([...pending.keys()].sort(), [
    '/textures/2k_mars.jpg',
    '/textures/2k_stars_milky_way.jpg',
    '/textures/8k_earth_daymap.jpg',
    '/textures/8k_earth_nightmap.jpg',
  ]);
  manager.dispose();
  for (const resolve of pending.values()) {
    const texture = new THREE.Texture();
    const dispose = t.mock.method(texture, 'dispose');
    resolve(texture);
    await Promise.resolve();
    assert.equal(dispose.mock.callCount(), 1);
  }
});

void test('idle preloading warms lazy maps and keeps them attached after navigation', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  let applied: THREE.Texture | null = null;
  let cleared = 0;
  const manager = createTextureManager(renderer, () => {});
  manager.register(
    'phobos',
    (texture) => {
      applied = texture;
    },
    {
      lazy: true,
      clear: () => {
        cleared++;
      },
    },
  );
  manager.preload();
  const texture = new THREE.Texture();
  pending.get('/textures/satellites/2k_phobos.jpg')!(texture);
  pending.clear();
  await Promise.resolve();
  manager.update('standard', null, false, false);
  await Promise.resolve();
  assert.equal(applied, texture);
  manager.update('standard', 'deimos', false, false);
  assert.equal(cleared, 0);
  assert.equal(applied, texture);
  manager.dispose();
});

void test('lazy satellite maps load for the selected surface and release on navigation', async (t) => {
  const pending = new Map<string, (texture: THREE.Texture) => void>();
  t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    (path: string) =>
      new Promise<THREE.Texture>((resolve) => pending.set(path, resolve)),
  );
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
  } as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  let cleared = 0;
  manager.register('phobos', () => {}, {
    lazy: true,
    clear: () => {
      cleared++;
    },
  });
  manager.update('standard', null, false, false, true, []);
  assert.equal(pending.size, 0);
  manager.update('standard', 'phobos', false, false, true, ['phobos']);
  assert.deepEqual([...pending.keys()], ['/textures/satellites/2k_phobos.jpg']);
  const standard = new THREE.Texture();
  pending.get('/textures/satellites/2k_phobos.jpg')!(standard);
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'phobos', false, false, true, ['phobos']);
  assert.deepEqual([...pending.keys()], ['/textures/satellites/4k_phobos.jpg']);
  manager.update('standard', 'deimos', false, false, true, ['deimos']);
  assert.equal(cleared, 1);
  const stale = new THREE.Texture();
  const dispose = t.mock.method(stale, 'dispose');
  pending.get('/textures/satellites/4k_phobos.jpg')!(stale);
  pending.delete('/textures/satellites/4k_phobos.jpg');
  await Promise.resolve();
  assert.equal(dispose.mock.callCount(), 1);
  manager.dispose();
});

void test('unmount cancels queued preloads and never uploads their late results', async (t) => {
  const pending: ((texture: THREE.Texture) => void)[] = [];
  const load = t.mock.method(
    THREE.TextureLoader.prototype,
    'loadAsync',
    () => new Promise<THREE.Texture>((resolve) => pending.push(resolve)),
  );
  const warm = t.mock.fn();
  const apply = t.mock.fn();
  const renderer = {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
    initTexture: warm,
  } as unknown as THREE.WebGLRenderer;
  const manager = createTextureManager(renderer, () => {});
  for (const name of ['phobos', 'deimos', 'titania', 'oberon'])
    manager.register(name, apply, { lazy: true });
  manager.preload();
  assert.equal(load.mock.callCount(), 2, 'bounded background concurrency');
  manager.dispose();
  for (const finish of pending) {
    const texture = new THREE.Texture();
    const dispose = t.mock.method(texture, 'dispose');
    finish(texture);
    await Promise.resolve();
    assert.equal(dispose.mock.callCount(), 1);
  }
  await new Promise((resolve) => setImmediate(resolve));
  manager.preload();
  manager.update('ultra', 'phobos', false, false);
  assert.equal(load.mock.callCount(), 2, 'the remaining queue stays cancelled');
  assert.equal(warm.mock.callCount(), 0);
  assert.equal(apply.mock.callCount(), 0);
});
