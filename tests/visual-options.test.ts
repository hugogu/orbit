import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { bodies } from '../lib/solar';
import { orbitingMoons } from '../lib/moon-orbits';
import { displayRadius, moonDisplayOffset } from '../lib/display-scale';
import { moonVectorKm } from '../lib/satellite-elements';
import { moonRadii } from '../lib/eclipse-shadows';
import { bodyFromHash } from '../lib/body-navigation';
import MoonDetails from '../components/moon-details';
import BodyNavigation from '../components/body-navigation';
import { createEclipseSystem } from '../components/eclipse-system';

void test('true sizes preserve all Sun/planet/moon radius ratios in either distance mode', () => {
  for (const scale of ['illustrated', 'distance'] as const) {
    const earth = displayRadius('earth', scale, true);
    for (const body of bodies)
      assert.ok(
        Math.abs(
          displayRadius(body.id, scale, true) / earth - body.radius / 6371,
        ) < 1e-10,
      );
    for (const moon of orbitingMoons)
      assert.ok(
        Math.abs(
          displayRadius(moon.id, scale, true) / earth -
            moonRadii[moon.en] / 6371,
        ) < 1e-10,
      );
  }
  assert.equal(displayRadius('sun', 'distance', false), 4.8 * 0.09);
  assert.equal(displayRadius('earth', 'distance', false), 0.32);
});
void test('true distance and size use the same scale for moving satellite separation', () => {
  for (const moon of orbitingMoons)
    for (const days of [0, 9750.25]) {
      const separation = moonDisplayOffset(
        moon,
        days,
        'distance',
        true,
      ).length();
      const radius = displayRadius(moon.id, 'distance', true);
      assert.ok(
        Math.abs(
          separation / radius -
            moonVectorKm(moon, days).length() / moonRadii[moon.en],
        ) < 1e-8,
      );
    }
});
void test('every satellite has a directly addressable personal article and an expanded parent directory', () => {
  for (const moon of orbitingMoons) {
    assert.equal(bodyFromHash(`#${moon.id}`), moon.id);
    const html = renderToStaticMarkup(
      createElement(MoonDetails, { moon, onSelect() {} }),
    );
    assert.ok(html.includes(`<h2>${moon.name}</h2>`));
    assert.ok(html.includes(moon.description));
    assert.ok(html.includes(`data-curiosity="${moon.id}"`));
    assert.ok(html.includes(`href="#${moon.id}"`));
    assert.ok(html.includes(moonRadii[moon.en].toLocaleString()));
    const nav = renderToStaticMarkup(
      createElement(BodyNavigation, { selected: moon.id, onSelect() {} }),
    );
    assert.ok(nav.includes('class="moon-children"'));
    assert.ok(nav.includes(`aria-current="true"`));
    assert.ok(nav.includes(moon.name));
  }
  assert.equal(bodyFromHash('#unknown'), null);
  assert.equal(bodyFromHash('#<script>'), null);
});
void test('Earth night texture follows solar direction even with eclipse shadows disabled', () => {
  const material = new THREE.MeshStandardMaterial();
  const meshes = new Map([
    ['earth', new THREE.Mesh(new THREE.SphereGeometry(1), material)],
  ]);
  const system = createEclipseSystem(meshes);
  const texture = new THREE.Texture();
  system.setEarthNightMap(texture);
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {} as Record<string, { value: unknown }>,
  };
  material.onBeforeCompile(
    shader as Parameters<typeof material.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  assert.equal(shader.uniforms.earthNightMap.value, texture);
  assert.equal(shader.uniforms.earthNightReady.value, 1);
  assert.match(shader.fragmentShader, /nightBlend=1.0-smoothstep/);
  system.update(0, 'earth', false, true);
  const before = (shader.uniforms.eclipseSun.value as THREE.Vector3).clone();
  assert.equal(shader.uniforms.eclipseCount.value, 0);
  system.update(100, 'earth', false, true);
  assert.ok(
    before.distanceTo(shader.uniforms.eclipseSun.value as THREE.Vector3) > 1,
  );
  assert.equal(system.guideRoot.visible, false);
  system.dispose();
});
