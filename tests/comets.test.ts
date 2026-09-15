import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  comets,
  cometActivity,
  cometPerihelion,
  cometElements,
} from '../lib/comets.ts';
import { J2000_MS, DAY_MS } from '../lib/simulation-time.ts';
import { bodies, eccentricPosition, orbitPosition } from '../lib/solar.ts';
import { moonSystems } from '../lib/moons.ts';
import { createCometSystem } from '../components/comet-system.ts';
import { isOrbitLine } from '../components/orbit-line.ts';
import { parseAsteroidModel } from '../lib/asteroid-model.ts';

void test('all eight planets have satellite information, including the two without moons', () => {
  for (const body of bodies.filter((b) => b.id !== 'sun' && b.id !== 'pluto')) {
    const system = moonSystems[body.id];
    assert.ok(system?.summary, body.id);
    assert.equal(
      system.moons.length === 0,
      ['mercury', 'venus'].includes(body.id),
    );
    assert.equal(
      new Set(system.moons.map((m) => m.en)).size,
      system.moons.length,
    );
    for (const moon of system.moons)
      assert.ok(moon.description && moon.source && moon.highlight);
  }
  assert.equal(moonSystems.jupiter.moons.length, 4);
  assert.equal(moonSystems.uranus.moons.length, 5);
});

void test('eccentric comet trajectories satisfy Kepler equation and close for positive and negative times', () => {
  for (const c of comets) {
    const inclination = (c.inc * Math.PI) / 180,
      a = c.au * 3.1;
    for (const fraction of [
      -0.999999, -0.5, -0.001, 0, 0.000001, 0.001, 0.1, 0.5, 0.999999,
    ]) {
      const days = fraction * c.period;
      const p = orbitPosition(c, days, 'distance');
      const x = p[0] / a + c.e;
      const y =
        (p[1] * Math.sin(inclination) - p[2] * Math.cos(inclination)) /
        (a * Math.sqrt(1 - c.e ** 2));
      assert.ok(Math.abs(x * x + y * y - 1) < 1e-10, c.id);
      const eccentric = Math.atan2(y, x);
      const error =
        eccentric - c.e * Math.sin(eccentric) - fraction * 2 * Math.PI;
      assert.ok(Math.abs(Math.sin(error / 2)) < 1e-10, `${c.id}: ${fraction}`);
      const next = orbitPosition(c, days + c.period, 'distance');
      assert.ok(Math.hypot(...p.map((v, i) => v - next[i])) < 1e-7);
    }
    const peri = eccentricPosition(c, 0, 'distance');
    const apo = eccentricPosition(c, Math.PI, 'distance');
    assert.ok(Math.abs(Math.hypot(...peri) - a * (1 - c.e)) < 1e-8);
    assert.ok(Math.abs(Math.hypot(...apo) - a * (1 + c.e)) < 1e-8);
  }
});

void test('Halley is retrograde and speeds up near perihelion', () => {
  const c = comets[0],
    p = orbitPosition(c, 0, 'distance'),
    q = orbitPosition(c, 0.01, 'distance');
  assert.ok(p[2] * q[0] - p[0] * q[2] < 0);
  const a = orbitPosition(c, c.period / 2, 'distance'),
    b = orbitPosition(c, c.period / 2 + 0.01, 'distance');
  const ratio =
    Math.hypot(...q.map((v, i) => v - p[i])) /
    Math.hypot(...b.map((v, i) => v - a[i]));
  assert.ok(Math.abs(ratio - (1 + c.e) / (1 - c.e)) < 0.001);
});

void test('comet nucleus meshes are body-specific and loaded shapes stay cached', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        className: '',
        style: { display: '' },
        setAttribute() {},
        remove() {},
        textContent: '',
      }),
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const requests: { resolve: (value: Response) => void }[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        requests.push({ resolve });
      }),
  );
  const modelBytes = new Map(
    comets.map((comet) => {
      const bytes = readFileSync(
        `public/models/comets/${comet.shapeModel}.bin`,
      );
      return [
        comet.id,
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ] as const;
    }),
  );
  const scene = new THREE.Scene();
  const system = createCometSystem(scene, {
    appendChild() {},
  } as unknown as HTMLElement);
  system.update('halley', 0, false);
  assert.equal(requests.length, 1);
  requests[0].resolve(new Response(modelBytes.get('halley')));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const halleyGeometry = system.nucleus.geometry;
  system.update('67p', 0, false);
  assert.equal(requests.length, 2);
  requests[1].resolve(new Response(modelBytes.get('67p')));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sixtySevenGeometry = system.nucleus.geometry;
  assert.notEqual(sixtySevenGeometry, halleyGeometry);
  system.update('halley', 0, false);
  assert.equal(system.nucleus.geometry, halleyGeometry);
  assert.equal(requests.length, 2, 'revisit reuses the loaded comet mesh');
  for (const comet of comets) {
    const model = parseAsteroidModel(modelBytes.get(comet.id)!);
    assert.ok(model.positions.length > 0, comet.id);
    assert.ok(model.indices.length > 0, comet.id);
  }
  let nucleusDisposed = false;
  system.nucleus.geometry.addEventListener('dispose', () => {
    nucleusDisposed = true;
  });
  system.dispose();
  assert.equal(nucleusDisposed, true, 'dispose releases the active nucleus');
  assert.equal(scene.getObjectByName('comet-system'), undefined);
});

void test('comet scene preserves the absolute date across selections and keeps its tail antisolar', () => {
  const original = globalThis.document;
  const label = {
    className: '',
    setAttribute() {},
    style: { display: '' },
    textContent: '',
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => label },
  });
  try {
    const scene = new THREE.Scene();
    const system = createCometSystem(scene, {
      appendChild() {},
    } as unknown as HTMLElement);
    const peri = (cometPerihelion(comets[0], 0) - J2000_MS) / DAY_MS;
    system.update('halley', peri, true);
    const initial = system.position.clone();
    const group = scene.getObjectByName('comet-system')!;
    assert.equal(
      group.children.filter((c) => isOrbitLine(c) && c.visible).length,
      1,
    );
    const tail = scene.getObjectByName('ion-tail')!;
    const atmosphere = scene.getObjectByName('comet-atmosphere')!;
    assert.ok(atmosphere.visible);
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(
      tail.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert.ok(direction.dot(initial.clone().normalize()) > 0.99999);
    system.update('halley', peri + 100, false);
    assert.ok(system.position.distanceTo(initial) > 0.1);
    assert.equal(
      group.children.filter((c) => isOrbitLine(c) && c.visible).length,
      0,
    );
    system.update('encke', peri + 100, true);
    system.update('halley', peri, true);
    assert.ok(system.position.distanceTo(initial) < 1e-10);
    system.update('halley', peri + cometElements(comets[0]).period / 2, true);
    assert.equal(atmosphere.visible, false);
    system.update(null, peri, true);
    system.project(new THREE.PerspectiveCamera(), 1000, 500, true);
    assert.equal(group.visible, false);
    assert.equal(label.style.display, 'none');
  } finally {
    if (original)
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: original,
      });
    else Reflect.deleteProperty(globalThis, 'document');
  }
  assert.equal(cometActivity(10), 0);
  assert.equal(cometActivity(0.3), 1);
});
