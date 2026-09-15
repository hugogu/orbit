import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bodies } from '../lib/solar.ts';
import { moonSystems } from '../lib/moons.ts';
import {
  orbitingMoons,
  moonOffset,
  moonSystemExtent,
} from '../lib/moon-orbits.ts';
import { createMoonSystem } from '../components/moon-system.ts';
import { createTextureManager } from '../components/texture-manager.ts';
import { displayRadius, moonDisplayOffset } from '../lib/display-scale';

void test('every published moon has a unique orbit and stays outside its parent', () => {
  assert.equal(
    orbitingMoons.length,
    Object.values(moonSystems).reduce(
      (sum, system) => sum + system.moons.length,
      0,
    ),
  );
  assert.equal(
    new Set(orbitingMoons.map((m) => m.id)).size,
    orbitingMoons.length,
  );
  for (const moon of orbitingMoons) {
    const parent = bodies.find((b) => b.id === moon.parentId)!;
    assert.ok(
      moon.period > 0 && moon.distance * (1 - moon.e) > parent.size + moon.size,
    );
    const initial = moonOffset(moon, 0, 'illustrated');
    const end = moonOffset(moon, moon.period, 'illustrated');
    assert.ok(Math.hypot(...initial.map((v, i) => v - end[i])) < 1e-8);
    assert.notDeepEqual(
      initial,
      moonOffset(moon, moon.period / 4, 'illustrated'),
    );
  }
});

void test('Triton orbits opposite its parent spin, and both display scales preserve periods', () => {
  const moon = orbitingMoons.find((m) => m.en === 'Triton')!;
  const p = new THREE.Vector3(...moonOffset(moon, 0, 'illustrated'));
  const q = new THREE.Vector3(...moonOffset(moon, 0.001, 'illustrated'));
  const tilt =
    (bodies.find((b) => b.id === moon.parentId)!.tilt * Math.PI) / 180;
  const axis = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
  assert.ok(p.clone().cross(q).dot(axis) < 0);
  for (const m of orbitingMoons) {
    const a = moonOffset(m, 12, 'illustrated'),
      b = moonOffset(m, 12, 'distance');
    assert.ok(a.every((v, i) => Math.abs(v * 0.32 - b[i]) < 1e-10));
    assert.ok(
      moonSystemExtent(m.parentId, 'illustrated') >= m.distance * (1 + m.e),
    );
  }
});

void test('rendered moon entities move with their parents, remain pickable and respect pause inputs', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const labels: {
    onclick?: () => void;
    style: Record<string, string>;
    classList: { toggle: () => void };
    setAttribute: () => void;
  }[] = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const label = {
          style: {},
          classList: { toggle() {} },
          setAttribute() {},
        };
        labels.push(label);
        return label;
      },
    },
  });
  try {
    const scene = new THREE.Scene(),
      roots = new Map<string, THREE.Group>(),
      meshes = new Map<string, THREE.Mesh>(),
      textures = createTextureManager(
        {
          capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 1 },
        } as THREE.WebGLRenderer,
        () => {},
      );
    for (const b of bodies) {
      const root = new THREE.Group();
      roots.set(b.id, root);
      scene.add(root);
    }
    let selected = '';
    const system = createMoonSystem(
      scene,
      roots,
      meshes,
      { appendChild() {} } as unknown as HTMLElement,
      (id) => {
        selected = id;
      },
      new THREE.Texture(),
      textures,
    );
    system.update(0, 'illustrated', 'jupiter', true);
    const io = roots.get('moon-io')!,
      before = io.position.clone();
    assert.equal(meshes.size, orbitingMoons.length);
    assert.equal(meshes.get('moon-io')!.userData.id, 'moon-io');
    system.update(0, 'illustrated', 'jupiter', true);
    assert.ok(io.position.equals(before));
    roots.get('jupiter')!.position.set(10, 20, 30);
    system.update(0, 'illustrated', 'jupiter', true);
    assert.ok(
      io.position
        .clone()
        .sub(before)
        .equals(new THREE.Vector3(10, 20, 30)),
    );
    const moved = io.position.clone();
    system.update(0.1, 'illustrated', 'moon-io', true);
    assert.ok(io.position.distanceTo(moved) > 0.01);
    assert.equal(scene.getObjectByName('moon-io-orbit')!.visible, true);
    assert.equal(scene.getObjectByName('moon-titan-orbit')!.visible, false);
    labels[orbitingMoons.findIndex((m) => m.en === 'Io')].onclick!();
    assert.equal(selected, 'moon-io');
    system.update(0.1, 'distance', 'moon-io', false);
    assert.equal(scene.getObjectByName('moon-io-orbit')!.visible, false);
    assert.equal(io.scale.x, 0.32);
    const orbitBefore = (scene.getObjectByName('moon-io-orbit') as THREE.Line)
      .geometry;
    system.update(0.1, 'distance', 'moon-io', true, true);
    const profile = orbitingMoons.find((m) => m.id === 'moon-io')!;
    assert.ok(
      Math.abs(
        io.scale.x * profile.size - displayRadius(profile.id, 'distance', true),
      ) < 1e-12,
    );
    assert.ok(
      io.position
        .clone()
        .sub(roots.get('jupiter')!.position)
        .distanceTo(moonDisplayOffset(profile, 0.1, 'distance', true)) < 1e-12,
    );
    assert.notEqual(
      (scene.getObjectByName('moon-io-orbit') as THREE.Line).geometry,
      orbitBefore,
    );
    system.update(0.1, 'distance', 'moon-io', true, false);
    assert.equal(io.scale.x, 0.32);
    system.dispose();
    textures.dispose();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
