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
  assert.equal(texturePath('uranus', true, 8192), '/textures/4k_uranus.jpg');
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
  manager.register('phobos', (texture) => {
    applied = texture;
  }, {
    lazy: true,
    clear: () => {
      cleared++;
    },
  });
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
