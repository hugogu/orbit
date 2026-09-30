import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  shadowFrame,
  diskObscuration,
  obscuration,
  possibleCasters,
  shadowBoundary,
  shadowAxisHit,
  shadowTrack,
} from '../lib/eclipse-shadows';
import { bodyOrientation } from '../lib/ephemeris';
import { DAY_MS, J2000_MS } from '../lib/simulation-time';
import { createEclipseSystem } from '../components/eclipse-system';
import { attachEclipseMaterial } from '../components/eclipse-material';
const days = (iso: string) => (Date.parse(iso) - J2000_MS) / DAY_MS;

void test('finite solar disc gives unobscured, partial, total and annular light levels', () => {
  assert.equal(diskObscuration(1, 1, 3), 0);
  assert.equal(diskObscuration(1, 2, 0), 1);
  assert.equal(diskObscuration(1, 0.5, 0), 0.25);
  assert.ok(Math.abs(diskObscuration(1, 1, 1) - 0.3910022) < 1e-6);
  for (let i = 0; i <= 200; i++)
    assert.ok(
      Number.isFinite(diskObscuration(0.0046, 0.0046, (i / 100) * 0.0046)),
    );
  assert.equal(
    obscuration(
      new THREE.Vector3(),
      new THREE.Vector3(1e8, 0, 0),
      new THREE.Vector3(-4e5, 0, 0),
      1737,
    ),
    0,
  );
});
void test('2024 total eclipse axis reaches Mexico and the penumbra encloses the umbra', () => {
  // NASA greatest eclipse: 25.3 N, 104.1 W (spherical rendering allows 0.5 degree).
  const d = days('2024-04-08T18:17:15Z'),
    frame = shadowFrame(d),
    earth = frame.get('earth')!,
    moon = frame.get('moon-moon')!,
    sun = frame.get('sun')!.position;
  assert.ok(possibleCasters(earth, frame).some((c) => c.id === moon.id));
  const hit = shadowAxisHit(earth, sun, moon)!;
  assert.ok(hit);
  const local = hit
    .clone()
    .normalize()
    .applyQuaternion(bodyOrientation('earth', d).invert());
  const lat = (Math.asin(local.y) * 180) / Math.PI,
    lon = (Math.atan2(-local.z, local.x) * 180) / Math.PI;
  assert.ok(Math.abs(lat - 25.3) < 0.5, `latitude ${lat}`);
  assert.ok(Math.abs(lon + 104.1) < 0.5, `longitude ${lon}`);
  assert.ok(
    obscuration(
      hit.clone().add(earth.position),
      sun,
      moon.position,
      moon.radius,
    ) > 0.999,
  );
  for (const kind of ['umbra', 'penumbra'] as const) {
    const points = shadowBoundary(earth, sun, moon, kind).filter(
      (p) => p !== null,
    );
    assert.ok(points.length > 100);
    for (const p of points) {
      assert.ok(Math.abs(p.length() - earth.radius) < 1e-5);
      const cover = obscuration(
        p.clone().add(earth.position),
        sun,
        moon.position,
        moon.radius,
      );
      assert.ok(
        kind === 'umbra' ? cover > 0.999 : cover < 0.0001,
        `${kind} coverage ${cover}`,
      );
    }
  }
  assert.equal(
    shadowBoundary(earth, sun, moon, 'antumbra').filter(Boolean).length,
    0,
  );
});
void test('2023 annular eclipse has an antumbra and cannot make a full shadow', () => {
  const frame = shadowFrame(days('2023-10-14T17:59:00Z')),
    earth = frame.get('earth')!,
    moon = frame.get('moon-moon')!,
    sun = frame.get('sun')!.position;
  const hit = shadowAxisHit(earth, sun, moon)!;
  const covered = obscuration(
    hit.clone().add(earth.position),
    sun,
    moon.position,
    moon.radius,
  );
  assert.ok(covered > 0.8 && covered < 0.99);
  assert.ok(shadowBoundary(earth, sun, moon, 'antumbra').some(Boolean));
  assert.equal(
    shadowBoundary(earth, sun, moon, 'umbra').filter(Boolean).length,
    0,
  );
});
void test('2025 lunar totality darkens the Moon and an ordinary date has no terrestrial shadow', () => {
  const frame = shadowFrame(days('2025-03-14T06:59:00Z')),
    moon = frame.get('moon-moon')!,
    earth = frame.get('earth')!,
    sun = frame.get('sun')!.position;
  const surface = moon.position
    .clone()
    .add(
      sun.clone().sub(moon.position).normalize().multiplyScalar(moon.radius),
    );
  assert.equal(obscuration(surface, sun, earth.position, earth.radius), 1);
  const ordinary = shadowFrame(days('2024-04-15T18:17:00Z'));
  assert.equal(possibleCasters(ordinary.get('earth')!, ordinary).length, 0);
});
void test('tracks follow rotating geography, are deterministic across seeks, and never join missing intersections', () => {
  const d = days('2024-04-08T18:17:15Z');
  const a = shadowTrack('earth', 'moon-moon', d),
    b = shadowTrack('earth', 'moon-moon', d + 0.01);
  assert.ok(a.some(Boolean));
  assert.notDeepEqual(a, b);
  assert.deepEqual(shadowTrack('earth', 'moon-moon', d), a);
  for (const p of a) if (p) assert.ok(Math.abs(p.length() - 1) < 1e-7);
  assert.ok(
    shadowTrack('earth', 'moon-moon', d - 0.05).some((p) => p === null),
  );
});
void test('material integration is independent of display scale and can disable shadows', () => {
  const material = new THREE.MeshStandardMaterial(),
    controller = attachEclipseMaterial(material);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  assert.ok(
    shader.fragmentShader.includes('outgoingLight *= eclipseTransmission()'),
  );
  const d = days('2024-04-08T18:17:15Z'),
    frame = shadowFrame(d),
    target = frame.get('earth')!,
    casters = possibleCasters(target, frame);
  controller.update(
    target,
    frame.get('sun')!.position,
    casters,
    bodyOrientation('earth', d).invert(),
    true,
  );
  const before = controller.uniforms.eclipseCasters.value.map((v) => v.clone());
  controller.update(
    { ...target, size: target.size * 0.32 },
    frame.get('sun')!.position,
    casters,
    bodyOrientation('earth', d).invert(),
    true,
  );
  assert.deepEqual(controller.uniforms.eclipseCasters.value, before);
  assert.ok(controller.uniforms.eclipseCount.value > 0);
  controller.update(
    target,
    frame.get('sun')!.position,
    casters,
    new THREE.Quaternion(),
    false,
  );
  assert.equal(controller.uniforms.eclipseCount.value, 0);
});
void test('scene guides update, hide on disable, and clean up GPU geometry', () => {
  const frame = shadowFrame(0),
    meshes = new Map<string, THREE.Mesh>();
  for (const [id, body] of frame)
    if (id !== 'sun')
      meshes.set(
        id,
        new THREE.Mesh(
          new THREE.SphereGeometry(body.size),
          new THREE.MeshStandardMaterial(),
        ),
      );
  const system = createEclipseSystem(meshes),
    d = days('2024-04-08T18:17:15Z');
  system.update(d, 'earth', true, true);
  assert.equal(system.guideRoot.parent, meshes.get('earth'));
  assert.ok(
    system.guideRoot.children.some(
      (o) => (o as THREE.LineSegments).geometry.drawRange.count > 0,
    ),
  );
  system.update(d, 'earth', true, true, false, true);
  for (let i = 3; i < system.guideRoot.children.length; i += 4) {
    assert.equal(
      (system.guideRoot.children[i] as THREE.LineSegments).geometry.drawRange
        .count,
      0,
    );
  }
  system.update(d + 0.1, 'earth', false, true);
  assert.equal(system.guideRoot.visible, false);
  system.update(d, 'moon-moon', true, true);
  assert.equal(system.guideRoot.parent, meshes.get('moon-moon'));
  system.dispose();
  assert.equal(system.guideRoot.parent, null);
});

void test('cached shadow positions preserve rotation and refresh on short date seeks', () => {
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material);
  const system = createEclipseSystem(new Map([['earth', mesh]]));
  const shader = {
    uniforms: {},
    vertexShader: '',
    fragmentShader: '',
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  const sun = () => shader.uniforms.eclipseSun.value as THREE.Vector3;
  const start = days('2024-04-08T18:17:15Z');
  system.update(start, 'earth', true, false);
  const initial = sun().clone();
  mesh.rotateY(0.01);
  system.update(start + 0.1 / 86400, 'earth', true, false);
  const rotated = initial
    .clone()
    .applyQuaternion(mesh.quaternion.clone().invert());
  assert.ok(
    sun().distanceTo(rotated) < 1e-8,
    'cached vectors follow the current surface rotation',
  );

  const assertCurrent = (time: number) => {
    const frame = shadowFrame(time);
    const receiver = frame.get('earth')!;
    const expected = frame
      .get('sun')!
      .position.clone()
      .sub(receiver.position)
      .applyQuaternion(mesh.quaternion.clone().invert())
      .divideScalar(receiver.radius);
    assert.ok(sun().distanceTo(expected) < 1e-8);
  };
  const shortSeek = start + 0.5 / 86400;
  system.update(shortSeek, 'earth', true, false, true);
  assertCurrent(shortSeek);
  system.update(start + 2 / 86400, 'earth', true, false);
  assertCurrent(start + 2 / 86400);
  system.update(start, 'earth', true, false);
  assertCurrent(start);
  system.dispose();
  mesh.geometry.dispose();
  material.dispose();
});

void test('only Earth casts copper atmospheric light onto the Moon, in its rotating physical frame', () => {
  const material = new THREE.MeshStandardMaterial();
  const controller = attachEclipseMaterial(material);
  const d = days('2025-03-14T06:59:00Z');
  const frame = shadowFrame(d);
  const moon = frame.get('moon-moon')!;
  const sun = frame.get('sun')!.position;
  const earth = frame.get('earth')!;
  const rotation = bodyOrientation(moon.id, d).invert();
  const casters = possibleCasters(moon, frame);
  controller.update(moon, sun, casters, rotation, true);
  assert.equal(
    casters[controller.uniforms.eclipseEarthIndex.value].id,
    'earth',
  );
  const localEarth = new THREE.Vector3().fromArray(
    controller.uniforms.eclipseCasters.value[
      controller.uniforms.eclipseEarthIndex.value
    ].toArray(),
  );
  assert.ok(
    localEarth.distanceTo(
      earth.position
        .clone()
        .sub(moon.position)
        .applyQuaternion(rotation)
        .divideScalar(moon.radius),
    ) < 1e-10,
  );
  const before = localEarth.clone();
  controller.update(
    { ...moon, size: moon.size * 100 },
    sun,
    casters,
    rotation,
    true,
  );
  assert.deepEqual(
    new THREE.Vector3().fromArray(
      controller.uniforms.eclipseCasters.value[
        controller.uniforms.eclipseEarthIndex.value
      ].toArray(),
    ),
    before,
  );
  controller.update(moon, sun, casters, rotation, false);
  assert.equal(controller.uniforms.eclipseEarthIndex.value, -1);
  controller.update(earth, sun, [moon], rotation, true);
  assert.equal(controller.uniforms.eclipseEarthIndex.value, -1);
  const ordinary = shadowFrame(days('2025-03-21T12:00:00Z'));
  const ordinaryMoon = ordinary.get(moon.id)!;
  controller.update(
    ordinaryMoon,
    ordinary.get('sun')!.position,
    possibleCasters(ordinaryMoon, ordinary),
    rotation,
    true,
  );
  assert.equal(controller.uniforms.eclipseEarthIndex.value, -1);
  material.dispose();
});

void test('partial lunar eclipse has a curved umbral edge on the physical lunar surface', () => {
  const frame = shadowFrame(days('2025-03-14T06:00:00Z'));
  const moon = frame.get('moon-moon')!;
  const earth = frame.get('earth')!;
  const sun = frame.get('sun')!.position;
  const boundary = shadowBoundary(moon, sun, earth, 'umbra').filter(
    (p) => p !== null,
  );
  assert.ok(boundary.length > 10);
  const toSun = sun.clone().sub(moon.position).normalize();
  const lateral = earth.position
    .clone()
    .sub(moon.position)
    .projectOnPlane(toSun)
    .normalize();
  const cover = (side: number) =>
    obscuration(
      moon.position
        .clone()
        .add(
          toSun
            .clone()
            .addScaledVector(lateral, side)
            .normalize()
            .multiplyScalar(moon.radius),
        ),
      sun,
      earth.position,
      earth.radius,
    );
  assert.ok(
    cover(2) > 0.999,
    'the limb toward the Earth shadow axis is in the umbra',
  );
  assert.ok(
    cover(-2) < 0.9,
    'the opposite limb still receives direct sunlight',
  );
  for (const p of boundary) {
    assert.ok(Math.abs(p.length() - moon.radius) < 1e-5);
    assert.ok(
      obscuration(
        p.clone().add(moon.position),
        sun,
        earth.position,
        earth.radius,
      ) > 0.999,
    );
  }
});

void test('ground Moon material composes physical eclipse lighting with its existing projection and phase shaders', () => {
  const material = new THREE.MeshBasicMaterial();
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = '/* ground projection */\n' + shader.vertexShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight *= 0.5;\n#include <opaque_fragment>',
    );
  };
  material.customProgramCacheKey = () => 'ground-body-shape-lit';
  const controller = attachEclipseMaterial(material);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.ok(shader.vertexShader.includes('/* ground projection */'));
  assert.ok(shader.vertexShader.includes('eclipseSurface=position'));
  assert.ok(
    shader.fragmentShader.indexOf('outgoingLight *= 0.5') <
      shader.fragmentShader.indexOf('outgoingLight *= eclipseTransmission()'),
  );
  assert.equal(
    shader.uniforms.eclipseEarthIndex,
    controller.uniforms.eclipseEarthIndex,
  );
  assert.ok(
    material.customProgramCacheKey().startsWith('ground-body-shape-lit-'),
  );
  material.dispose();
});
