import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import sharp from 'sharp/lib/index.js';
import { readFileSync, existsSync } from 'node:fs';
import { createTextureManager } from '../components/texture-manager';
import { bodies } from '../lib/solar';
import { orbitingMoons, moonTextureNames } from '../lib/moon-orbits';
import { asteroids } from '../lib/asteroids';
import {
  highResolutionTextures,
  textureLoadingOptions,
  texturePath,
  shouldLoadHighResolution,
} from '../lib/texture-quality';
import { textureFileRevisions } from '../lib/texture-revisions';

const textureUrl = (name: string, high = false) =>
  texturePath(name, high, 8192);

void test('quality respects device preferences, GPU limits and actual source resolutions', () => {
  assert.equal(shouldLoadHighResolution('auto', true, false), false);
  assert.equal(shouldLoadHighResolution('auto', false, true), false);
  assert.equal(shouldLoadHighResolution('auto', false, false), true);
  assert.equal(shouldLoadHighResolution('ultra', true, true), true);
  assert.equal(shouldLoadHighResolution('standard', false, false), false);
  assert.equal(
    texturePath('earth_daymap', true, 4096),
    `/textures/2k_earth_daymap.jpg?v=${textureFileRevisions['2k_earth_daymap.jpg']}`,
  );
  assert.equal(
    texturePath('jupiter', true, 4096),
    `/textures/8k_jupiter.jpg?v=${textureFileRevisions['8k_jupiter.jpg']}`,
  );
  assert.equal(
    texturePath('uranus', true, 8192),
    `/textures/2k_uranus.jpg?v=${textureFileRevisions['2k_uranus.jpg']}`,
  );
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

void test('texture loading prioritizes the first view and leaves other bodies on demand', () => {
  for (const name of ['earth_daymap', 'sun', 'stars_milky_way'])
    assert.deepEqual(textureLoadingOptions(name), {
      lazy: false,
      preload: false,
    });
  for (const name of ['moon', 'mars'])
    assert.deepEqual(textureLoadingOptions(name), {
      lazy: true,
      preload: true,
    });
  for (const name of ['mercury', 'jupiter', 'phobos', 'pluto'])
    assert.deepEqual(textureLoadingOptions(name), {
      lazy: true,
      preload: false,
    });
});

void test('every local texture URL carries the source file content revision', () => {
  for (const [file, revision] of Object.entries(textureFileRevisions)) {
    assert.match(revision, /^[a-f0-9]{16}$/);
    const source = new URL(`../public/textures/${file}`, import.meta.url);
    assert.ok(existsSync(source), `${file} exists for its content revision`);
    assert.equal(
      createHash('sha256')
        .update(readFileSync(source))
        .digest('hex')
        .slice(0, 16),
      revision,
      `${file} revision matches its content`,
    );
  }
});

void test('the startup and idle queues exclude unrelated body textures', async (t) => {
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
  for (const name of [
    'earth_daymap',
    'sun',
    'stars_milky_way',
    'moon',
    'mars',
    'mercury',
  ])
    manager.register(name, () => {}, textureLoadingOptions(name));
  manager.preload();
  assert.deepEqual(
    [...pending.keys()].sort(),
    [
      textureUrl('earth_daymap'),
      textureUrl('sun'),
      textureUrl('stars_milky_way'),
      textureUrl('moon'),
      textureUrl('mars'),
    ].sort(),
  );
  for (const finish of pending.values()) finish(new THREE.Texture());
  await new Promise((resolve) => setImmediate(resolve));
  manager.dispose();
});

void test('lazy Earth night lighting still loads when Earth is focused', async (t) => {
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
  manager.register(
    'earth_nightmap',
    () => {},
    textureLoadingOptions('earth_nightmap'),
  );
  manager.update('standard', 'earth_daymap', false, false);
  assert.deepEqual([...pending.keys()], [textureUrl('earth_nightmap')]);
  pending.get(textureUrl('earth_nightmap'))!(new THREE.Texture());
  await new Promise((resolve) => setImmediate(resolve));
  manager.dispose();
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

void test('surface colour maps are opaque and keep their colour at both qualities', async () => {
  // An alpha channel is read as opacity by browsers and premultiplied by
  // resizers, which is how a 2K derivative once lost all of Io's colour.
  const names = new Set([
    ...bodies.flatMap((body) => (body.texture ? [body.texture] : [])),
    ...Object.values(moonTextureNames),
    ...asteroids.flatMap((asteroid) =>
      asteroid.texture ? [asteroid.texture] : [],
    ),
  ]);
  const meanColour = async (name: string, high: boolean) => {
    const file = `public${texturePath(name, high, 8192).split('?')[0]}`;
    const { hasAlpha } = await sharp(file).metadata();
    assert.equal(hasAlpha, false, `${file} has an alpha channel`);
    // Reduce first so large JPEGs decode at a fraction of their size.
    const { data, info } = await sharp(file)
      .resize(256, 128, { fit: 'fill' })
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const stats = await sharp(data, {
      raw: { width, height, channels },
    }).stats();
    return stats.channels.map((channel) => channel.mean);
  };
  // One body at a time, so only its two maps are ever being decoded.
  for (const name of names) {
    const [standard, high] = await Promise.all([
      meanColour(name, false),
      meanColour(name, true),
    ]);
    standard.forEach((mean, channel) =>
      assert.ok(
        Math.abs(mean - high[channel]) < 4,
        `${name} standard map channel ${channel}: ${mean} vs ${high[channel]}`,
      ),
    );
  }
});

void test('asteroid maps load on focus and keep visited surfaces attached', () => {
  const scene = readFileSync(
    new URL('../components/solar-scene.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    scene,
    /asteroidSystem\.setTexture\(asteroid\.id, texture\)[\s\S]*?lazy: true,[\s\S]*?preload: false/,
  );
  assert.match(
    scene,
    /asteroidSystem\.setNormalTexture\(asteroid\.id, texture\)[\s\S]*?lazy: true,[\s\S]*?preload: false/,
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
      `/textures/planets/2k_${body.id}-normal.png?v=${textureFileRevisions[`planets/2k_${body.id}-normal.png`]}-terrain-v2`,
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
      `/textures/planets/2k_${body.id}-height.png?v=${textureFileRevisions[`planets/2k_${body.id}-height.png`]}-terrain-v2`,
    );
    assert.ok(
      existsSync(
        new URL(`../public${texturePath(name, false, 8192)}`, import.meta.url),
      ),
      `${body.id} height map`,
    );
  }
});

void test('the Moon has an on-demand LOLA terrain map with physical bounds', () => {
  const moon = orbitingMoons.find((body) => body.en === 'Moon')!;
  assert.equal(moon.heightTexture, 'terrain_moon');
  assert.equal(moon.surfaceTexture, 'surface_moon_normal');
  assert.equal(moon.radius, 1737.4);
  assert.ok(moon.terrainMinKm! < 0);
  assert.ok(moon.terrainMaxKm! > 0);
  assert.equal(
    texturePath(moon.heightTexture!, false, 8192),
    `/textures/planets/2k_moon-height.png?v=${textureFileRevisions['planets/2k_moon-height.png']}-terrain-v1`,
  );
  assert.ok(
    existsSync(
      new URL(
        `../public${texturePath(moon.heightTexture!, false, 8192)}`,
        import.meta.url,
      ),
    ),
  );
  assert.equal(
    texturePath(moon.surfaceTexture!, false, 8192),
    `/textures/planets/2k_moon-normal.png?v=${textureFileRevisions['planets/2k_moon-normal.png']}-terrain-v1`,
  );
  const scene = readFileSync(
    new URL('../components/solar-scene.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    scene,
    /selectedMoonSurface[\s\S]*?selectedMoonTerrain[\s\S]*?activeBodyTextures/,
  );
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
      /\?v=[a-f0-9]{16}-filled-v1$/,
      `${name} standard map cache key`,
    );
    assert.match(
      texturePath(name, true, 8192),
      /\?v=[a-f0-9]{16}-filled-v1$/,
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
  assert.deepEqual([...pending.keys()], [textureUrl('surface_earth_normal')]);
  const texture = new THREE.Texture();
  pending.get(textureUrl('surface_earth_normal'))!(texture);
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
  assert.deepEqual([...pending.keys()], [textureUrl('terrain_earth')]);
  const texture = new THREE.Texture();
  pending.get(textureUrl('terrain_earth'))!(texture);
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
  pending.get(textureUrl('asteroid_ceres'))!(color);
  pending.get(textureUrl('asteroid_ceres_normal'))!(normal);
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
  pending.get(textureUrl('asteroid_ceres', true))!(highColor);
  pending.get(textureUrl('asteroid_ceres_normal', true))!(highNormal);
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
  pending.get(textureUrl('asteroid_ceres'))!(fallbackColor);
  pending.get(textureUrl('asteroid_ceres_normal'))!(fallbackNormal);
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
  const standard = await finish(textureUrl('earth_daymap'));
  manager.update('ultra', 'earth_daymap', false, false);
  assert.equal(visible, standard.texture);
  manager.update('standard', 'earth_daymap', false, false);
  const stale = await finish(textureUrl('earth_daymap', true));
  assert.equal(stale.dispose.mock.callCount(), 1);
  const replacement = await finish(textureUrl('earth_daymap'));
  assert.equal(visible, replacement.texture);
  assert.equal(standard.dispose.mock.callCount(), 1);
  manager.update('ultra', 'earth_daymap', false, false);
  pending.get(textureUrl('earth_daymap', true))!.reject();
  pending.delete(textureUrl('earth_daymap', true));
  await Promise.resolve();
  const fallback = await finish(textureUrl('earth_daymap'));
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
  pending.get(textureUrl('earth_daymap'))!(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'earth_daymap', false, false, true, [], true);
  assert.equal(pending.has(textureUrl('earth_daymap', true)), false);
  manager.update('ultra', 'earth_daymap', false, false);
  assert.equal(pending.has(textureUrl('earth_daymap', true)), true);
  pending.get(textureUrl('earth_daymap', true))!(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', null, false, false, true, [], true);
  manager.update('ultra', null, false, false);
  assert.equal(
    pending.has(textureUrl('earth_daymap')),
    false,
    'keep the previous high-resolution map during navigation',
  );
  manager.update('standard', null, false, false, true, [], true);
  assert.equal(
    pending.has(textureUrl('earth_daymap')),
    true,
    'an explicit standard-quality choice still applies during navigation',
  );
  pending.get(textureUrl('earth_daymap'))!(new THREE.Texture());
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
    textureUrl('mars', true),
    textureUrl('stars_milky_way', true),
  ]);
  for (const resolve of pending.values()) resolve(new THREE.Texture());
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'earth_daymap', false, false, false);
  assert.deepEqual([...pending.keys()].sort(), [
    textureUrl('mars'),
    textureUrl('stars_milky_way'),
    textureUrl('earth_daymap', true),
    textureUrl('earth_nightmap', true),
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
  pending.get(textureUrl('phobos'))!(texture);
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
  assert.deepEqual([...pending.keys()], [textureUrl('phobos')]);
  const standard = new THREE.Texture();
  pending.get(textureUrl('phobos'))!(standard);
  pending.clear();
  await Promise.resolve();
  manager.update('ultra', 'phobos', false, false, true, ['phobos']);
  assert.deepEqual([...pending.keys()], [textureUrl('phobos', true)]);
  manager.update('standard', 'deimos', false, false, true, ['deimos']);
  assert.equal(cleared, 1);
  const stale = new THREE.Texture();
  const dispose = t.mock.method(stale, 'dispose');
  pending.get(textureUrl('phobos', true))!(stale);
  pending.delete(textureUrl('phobos', true));
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
