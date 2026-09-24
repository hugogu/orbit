import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AstroTime } from 'astronomy-engine';
import * as THREE from 'three';
import {
  asteroids,
  asteroidPosition,
  asteroidOrbitPoint,
} from '../lib/asteroids';
import { displayRadius, kmToScene } from '../lib/display-scale';
import { bodyFromHash } from '../lib/body-navigation';
import { catalogEntry, bodyDetailsPath, seoLocales } from '../lib/seo';
import { texturePath } from '../lib/texture-quality';
import { existsSync, readFileSync } from 'node:fs';
import {
  parseAsteroidModel,
  asteroidModelScale,
  encodeAsteroidModel,
} from '../lib/asteroid-model';
import { createAsteroidSystem } from '../components/asteroid-system';
import { createSceneLabelOcclusion } from '../components/scene-label';
import BodyNavigation from '../components/body-navigation';
import AsteroidDetails from '../components/asteroid-details';
import { I18nProvider } from '../lib/i18n/provider';
import { translator } from '../lib/i18n';
import { observatoryTools } from '../lib/observatory-tools';
import { normalizeModel } from '../scripts/convert-asteroid-models';

void test('asteroid snapshots use their own epochs, preserve orbital planes, and close after one period', () => {
  for (const asteroid of asteroids) {
    const { epoch, au, e, mean, period, inc, node } = asteroid.orbit;
    const at = AstroTime.FromTerrestrialTime(epoch - 2451545).ut;
    const after = AstroTime.FromTerrestrialTime(epoch - 2451545 + period).ut;
    const position = new THREE.Vector3(
      ...asteroidPosition(asteroid, at, 'distance'),
    );
    const repeat = new THREE.Vector3(
      ...asteroidPosition(asteroid, after, 'distance'),
    );
    assert.ok(position.distanceTo(repeat) < 1e-7, asteroid.id);
    const peri = new THREE.Vector3(
      ...asteroidOrbitPoint(asteroid, 0, 'distance'),
    );
    const apo = new THREE.Vector3(
      ...asteroidOrbitPoint(asteroid, Math.PI, 'distance'),
    );
    assert.ok(Math.abs(peri.length() - au * (1 - e) * 3.1) < 1e-10);
    assert.ok(Math.abs(apo.length() - au * (1 + e) * 3.1) < 1e-10);
    // Independent Kepler solution at the epoch checks that mean anomaly is not reset to zero.
    let eccentric = (mean * Math.PI) / 180;
    for (let i = 0; i < 20; i++)
      eccentric -=
        (eccentric - e * Math.sin(eccentric) - (mean * Math.PI) / 180) /
        (1 - e * Math.cos(eccentric));
    const expected = new THREE.Vector3(
      ...asteroidOrbitPoint(asteroid, eccentric, 'distance'),
    );
    assert.ok(position.distanceTo(expected) < 1e-9);
    const deg = Math.PI / 180;
    const normal = new THREE.Vector3(
      Math.sin(node * deg) * Math.sin(inc * deg),
      Math.cos(inc * deg),
      Math.cos(node * deg) * Math.sin(inc * deg),
    );
    assert.ok(Math.abs(position.dot(normal)) < 1e-10);
    const moved = new THREE.Vector3(
      ...asteroidPosition(asteroid, at + 0.01, 'distance'),
    );
    assert.ok(position.clone().cross(moved).dot(normal) > 0);
    for (const days of [-109572, 0, 73049])
      assert.ok(
        asteroidPosition(asteroid, days, 'illustrated').every(Number.isFinite),
      );
    for (const scale of ['illustrated', 'distance'] as const)
      assert.equal(
        displayRadius(asteroid.id, scale, true),
        asteroid.radius * kmToScene(scale),
      );
  }
});

void test('every asteroid is addressable from navigation, profiles, textures, and browser tools', () => {
  assert.equal(asteroids.length, 9);
  assert.equal(
    new Set(asteroids.map((item) => item.id)).size,
    asteroids.length,
  );
  assert.equal(asteroids.find((item) => item.id === 'ceres')!.type, '矮行星');
  let selected = '';
  const focus = observatoryTools({
    focus(id) {
      selected = id;
    },
    simulation() {},
  })[0];
  for (const asteroid of asteroids) {
    assert.equal(bodyFromHash(`#${asteroid.id}`), asteroid.id);
    assert.equal(catalogEntry(asteroid.id)?.kind, 'asteroid');
    focus.execute({ id: asteroid.id });
    assert.equal(selected, asteroid.id);
    if (asteroid.texture) {
      assert.ok(
        existsSync(
          `public${texturePath(asteroid.texture, false, 2048).split('?')[0]}`,
        ),
      );
      assert.ok(
        existsSync(
          `public${texturePath(asteroid.texture, true, 8192).split('?')[0]}`,
        ),
      );
    }
    if (asteroid.normalTexture)
      assert.ok(
        existsSync(
          `public${texturePath(asteroid.normalTexture, false, 2048).split('?')[0]}`,
        ),
      );
    assert.equal(
      asteroid.shapeModel === null ? asteroid.id === 'ceres' : true,
      true,
    );
    for (const locale of seoLocales) {
      const t = translator(locale);
      const html = renderToStaticMarkup(
        createElement(
          I18nProvider,
          { initialLocale: locale },
          createElement(AsteroidDetails, { asteroid }),
          createElement(BodyNavigation, {
            selected: asteroid.id,
            onSelect() {},
          }),
        ),
      );
      assert.ok(html.includes(bodyDetailsPath(locale, asteroid.id)));
      assert.ok(html.includes(t(asteroid.name)));
      assert.doesNotMatch(html, /NaN|undefined/);
      if (locale === 'en') assert.doesNotMatch(html, /\p{Script=Han}/u);
    }
  }
});

void test('mission shape exports and surface sources stay body-specific', () => {
  const models = new Set<string>();
  const textures = new Set<string>();
  for (const asteroid of asteroids) {
    assert.notEqual(asteroid.texture, 'asteroid_surface', asteroid.id);
    if (asteroid.texture) textures.add(asteroid.texture);
    if (!asteroid.shapeModel) {
      assert.equal(asteroid.id, 'ceres');
      continue;
    }
    models.add(asteroid.shapeModel);
    const bytes = readFileSync(
      `public/models/asteroids/${asteroid.shapeModel}.bin`,
    );
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const model = parseAsteroidModel(buffer);
    assert.ok(model.positions.length >= 3 * 1000, asteroid.id);
    assert.ok(
      model.indices.length >= (asteroid.id === 'pallas' ? 3 * 800 : 3 * 1000),
      asteroid.id,
    );
    assert.ok(
      model.uvs.some((value) => value !== 0),
      asteroid.id,
    );
  }
  assert.equal(models.size, 8);
  assert.equal(textures.size, 8);
  const pallas = asteroids.find((item) => item.id === 'pallas')!;
  const pallasBytes = readFileSync(
    `public/models/asteroids/${pallas.shapeModel}.bin`,
  );
  const pallasModel = parseAsteroidModel(
    pallasBytes.buffer.slice(
      pallasBytes.byteOffset,
      pallasBytes.byteOffset + pallasBytes.byteLength,
    ),
  );
  assert.equal(pallas.texture, 'asteroid_pallas');
  assert.equal(pallasModel.indices.length / 3, 800);
  assert.equal(pallasModel.positions.length / 3, pallasModel.indices.length);
  const psyche = asteroids.find((item) => item.id === 'psyche')!;
  const psycheBytes = readFileSync(
    `public/models/asteroids/${psyche.shapeModel}.bin`,
  );
  const psycheModel = parseAsteroidModel(
    psycheBytes.buffer.slice(
      psycheBytes.byteOffset,
      psycheBytes.byteOffset + psycheBytes.byteLength,
    ),
  );
  assert.equal(psyche.texture, 'asteroid_psyche');
  assert.equal(psycheModel.indices.length / 3, 1352);
  assert.equal(psycheModel.positions.length / 3, psycheModel.indices.length);
});

void test('model normal fallback applies one face normal to each face vertex', () => {
  const model = normalizeModel(
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    Array.from({ length: 12 }, () => 0),
    Array.from({ length: 8 }, () => NaN),
    [0, 1, 2, 0, 2, 3],
  );
  assert.deepEqual(Array.from(model.normals.slice(9, 12)), [1, 0, 0]);
  const mixed = normalizeModel(
    [0, 0, 0, 1, 0, 0, 0, 1, 0],
    [0, 0, 1, NaN, 0, 0, 0, 0, 0],
    Array(6).fill(NaN),
    [0, 1, 2],
  );
  assert.deepEqual([...mixed.normals], [0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const corrupt = encodeAsteroidModel(mixed);
  new DataView(corrupt.buffer).setFloat32(16, NaN, true);
  assert.throws(
    () => parseAsteroidModel(new Uint8Array(corrupt).buffer),
    /non-finite/,
  );
});

void test('observed asteroid shapes retain volume-based sizes and DAMIT north is the Y axis', () => {
  for (const asteroid of asteroids.filter((a) => a.shapeModel)) {
    const bytes = readFileSync(
      `public/models/asteroids/${asteroid.shapeModel}.bin`,
    );
    const model = parseAsteroidModel(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const scale = asteroidModelScale(model);
    let volume = 0;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < model.indices.length; i += 3) {
      a.fromArray(model.positions, model.indices[i] * 3).multiplyScalar(scale);
      b.fromArray(model.positions, model.indices[i + 1] * 3).multiplyScalar(
        scale,
      );
      c.fromArray(model.positions, model.indices[i + 2] * 3).multiplyScalar(
        scale,
      );
      volume += a.dot(b.cross(c)) / 6;
    }
    assert.ok(
      Math.abs(Math.abs(volume) - (4 * Math.PI) / 3) < 1e-6,
      asteroid.id,
    );
    if (asteroid.id === 'pallas' || asteroid.id === 'psyche') {
      const box = new THREE.Box3().setFromBufferAttribute(
        new THREE.BufferAttribute(model.positions, 3),
      );
      const extent = box.getSize(new THREE.Vector3());
      assert.ok(
        extent.y < extent.x && extent.y < extent.z,
        `${asteroid.id} polar axis`,
      );
    }
  }
});

void test('asteroid model loading is focused, cancellable, and leaves recoverable fallback shapes', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        style: {},
        classList: { toggle() {} },
        setAttribute() {},
      }),
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const requests: {
    signal: AbortSignal;
    resolve: (value: Response) => void;
  }[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve) =>
        requests.push({ signal: options.signal!, resolve }),
      ),
  );
  const scene = new THREE.Scene(),
    roots = new Map<string, THREE.Group>(),
    meshes = new Map<string, THREE.Mesh>();
  let errors = 0;
  const system = createAsteroidSystem(
    scene,
    roots,
    meshes,
    { appendChild() {} } as unknown as HTMLElement,
    () => {},
    () => errors++,
  );
  assert.equal(requests.length, 0);
  const base = meshes.get('pallas')!.geometry;
  const first = system.setFocus('pallas');
  assert.equal(requests.length, 1);
  assert.equal(system.setFocus('pallas'), first);
  const second = system.setFocus('psyche');
  assert.equal(requests[0].signal.aborted, true);
  const bytes = readFileSync('public/models/asteroids/pallas.bin');
  requests[0].resolve(new Response(bytes));
  await first;
  assert.equal(meshes.get('pallas')!.geometry, base);
  requests[1].resolve(new Response(null, { status: 503 }));
  await second;
  assert.equal(errors, 1);
  await system.setFocus(null);
  const retry = system.setFocus('pallas');
  assert.equal(requests.length, 3);
  requests[2].resolve(new Response(bytes));
  await retry;
  const loaded = meshes.get('pallas')!.geometry;
  const dispose = t.mock.method(loaded, 'dispose');
  assert.notEqual(loaded, base);
  await system.setFocus(null);
  assert.equal(meshes.get('pallas')!.geometry, loaded);
  assert.equal(dispose.mock.callCount(), 0);
  await system.setFocus('pallas');
  assert.equal(requests.length, 3, 'revisit reuses the loaded model');
  const late = system.setFocus('psyche');
  system.dispose();
  assert.equal(dispose.mock.callCount(), 1);
  assert.equal(requests[3].signal.aborted, true);
  requests[3].resolve(new Response(bytes));
  await late;
  assert.equal(errors, 1);
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
});

void test('asteroid and comet groups start collapsed and expand for direct selections', () => {
  const nav = (selected: string | null) =>
    renderToStaticMarkup(
      createElement(BodyNavigation, { selected, onSelect() {} }),
    );
  const states = (html: string) =>
    [
      ...html.matchAll(
        /class="small-body-expander" aria-expanded="(true|false)"/g,
      ),
    ].map((match) => match[1]);
  assert.deepEqual(states(nav(null)), ['false', 'false']);
  assert.deepEqual(states(nav('bennu')), ['true', 'false']);
  assert.deepEqual(states(nav('halley')), ['false', 'true']);
  assert.ok(
    nav(null).includes(bodyDetailsPath('zh-CN', 'ceres')),
    'collapsed links stay crawlable',
  );
});

void test('asteroid scene integrates picking, materials, paused time, true scales, and occlusion', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const labels: {
    onclick?: () => void;
    textContent: string;
    style: Record<string, string>;
    classList: { toggle(): void };
    setAttribute(): void;
  }[] = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement() {
        const label = {
          textContent: '',
          style: {},
          classList: { toggle() {} },
          setAttribute() {},
        };
        labels.push(label);
        return label;
      },
    },
  });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (input: string) => {
      const path = new URL(input, 'http://localhost').pathname;
      const bytes = readFileSync(`public${path}`);
      return {
        ok: true,
        async arrayBuffer() {
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      };
    },
  });
  const scene = new THREE.Scene(),
    roots = new Map<string, THREE.Group>(),
    meshes = new Map<string, THREE.Mesh>();
  try {
    let selected = '';
    const system = createAsteroidSystem(
      scene,
      roots,
      meshes,
      { appendChild() {} } as unknown as HTMLElement,
      (id) => {
        selected = id;
      },
    );
    for (const id of ['pallas', 'psyche']) {
      const atlas = new THREE.Texture();
      system.setTexture(id, atlas);
      assert.equal(
        (meshes.get(id)!.material as THREE.MeshStandardMaterial).map,
        null,
      );
      await system.setFocus(id);
      assert.equal(
        (meshes.get(id)!.material as THREE.MeshStandardMaterial).map,
        atlas,
      );
      assert.equal(atlas.generateMipmaps, false);
      assert.ok(meshes.get(id)!.geometry.boundingSphere!.radius > 1, id);
      system.clearTexture(id);
      atlas.dispose();
    }
    await system.setFocus('bennu');
    system.update(0, 'illustrated', false, 'bennu', true);
    system.localize(translator('en'));
    const texture = new THREE.Texture();
    system.setTexture('bennu', texture);
    assert.equal(meshes.size, 9);
    const bennu = roots.get('bennu')!,
      mesh = meshes.get('bennu')!;
    const before = bennu.position.clone(),
      rotation = mesh.rotation.clone();
    system.update(0, 'illustrated', false, 'bennu', true);
    assert.ok(bennu.position.equals(before));
    assert.ok(mesh.rotation.equals(rotation));
    assert.equal((mesh.material as THREE.MeshStandardMaterial).map, texture);
    assert.equal(scene.getObjectByName('bennu-orbit')!.visible, true);
    assert.equal(scene.getObjectByName('vesta-orbit')!.visible, false);
    const camera = new THREE.PerspectiveCamera(47, 1, 0.001, 1000);
    camera.position.copy(bennu.position).add(new THREE.Vector3(0, 0.3, 2));
    camera.lookAt(bennu.position);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), camera);
    assert.equal(
      raycaster.intersectObjects([...meshes.values()], false)[0].object.userData
        .id,
      'bennu',
    );
    const index = asteroids.findIndex((item) => item.id === 'bennu');
    labels[index].onclick!();
    assert.equal(selected, 'bennu');
    const blocker = new THREE.Mesh(
      new THREE.SphereGeometry(0.4),
      new THREE.MeshBasicMaterial(),
    );
    blocker.position.copy(camera.position).lerp(bennu.position, 0.5);
    scene.add(blocker);
    meshes.set('blocker', blocker);
    const occlusion = createSceneLabelOcclusion(meshes);
    occlusion.update(camera);
    system.project(camera, 600, 600, 'bennu', true, occlusion.isOccluded);
    assert.equal(labels[index].style.display, 'none');
    blocker.visible = false;
    occlusion.update(camera);
    system.project(camera, 600, 600, 'bennu', true, occlusion.isOccluded);
    assert.equal(labels[index].style.display, 'block');
    system.localize(translator('ja'));
    assert.equal(labels[index].textContent, 'ベンヌ');
    assert.ok(bennu.position.equals(before));
    system.update(1, 'distance', true, 'bennu', false);
    assert.notDeepEqual(bennu.position, before);
    assert.equal(bennu.scale.x, displayRadius('bennu', 'distance', true));
    assert.equal(scene.getObjectByName('bennu-orbit')!.visible, false);
    texture.dispose();
    system.dispose();
  } finally {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        if (!Array.isArray(object.material)) object.material.dispose();
      }
    });
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
    if (fetchDescriptor)
      Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
    else Reflect.deleteProperty(globalThis, 'fetch');
  }
});
