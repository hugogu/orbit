import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  activityEnvelope,
  solarActivityAt,
  solarActivityRegion,
  solarRotationRate,
  solarSurfacePoint,
  SOLAR_REFERENCE_RATE,
} from '../lib/solar-activity';
import { createSunEffects } from '../components/sun-effects';
import { bodyOrientation } from '../lib/ephemeris';
import { advanceTime, DAY_MS, J2000_MS } from '../lib/simulation-time';

void test('activity forms over days, decays completely and is reproducible across date seeks', () => {
  assert.equal(activityEnvelope(0, 30), 0);
  assert.ok(activityEnvelope(0.5, 30) > 0 && activityEnvelope(0.5, 30) < 1);
  assert.equal(activityEnvelope(2, 30), 1);
  assert.ok(activityEnvelope(28, 30) < 1);
  assert.equal(activityEnvelope(30, 30), 0);
  assert.equal(activityEnvelope(31, 30), 0);
  for (const days of [-109572, 0, 9750, 73413]) {
    const regions = solarActivityAt(days);
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      assert.ok(region.prominenceDays >= 14 && region.prominenceDays <= 86);
      assert.ok(region.sunspotDays >= 6 && region.sunspotDays <= 64);
      assert.equal(
        solarActivityRegion(i, region.born + region.prominenceDays + 0.01)
          .prominence,
        0,
      );
      assert.equal(
        solarActivityRegion(i, region.born + region.sunspotDays + 0.21).sunspot,
        0,
      );
      assert.ok(
        Math.abs(
          Math.hypot(...solarSurfacePoint(region.latitude, region.longitude)) -
            1,
        ) < 1e-12,
      );
    }
    solarActivityAt(days + 365);
    assert.deepEqual(solarActivityAt(days), regions);
    assert.notDeepEqual(
      solarActivityAt(days + 200).map((r) => r.id),
      regions.map((r) => r.id),
    );
  }
});
void test('active regions rotate at latitude-dependent physical rates, not wall-clock speed', () => {
  assert.equal(solarRotationRate(0), 360 / 25);
  assert.equal(solarRotationRate(Math.PI / 2), 360 / 36);
  const birth = solarActivityRegion(0, 9750).born;
  const a = solarActivityRegion(0, birth + 2),
    b = solarActivityRegion(0, birth + 3);
  assert.ok(
    Math.abs(
      ((b.longitude - a.longitude) * 180) / Math.PI +
        SOLAR_REFERENCE_RATE -
        solarRotationRate(a.latitude),
    ) < 1e-9,
  );
  const worldA = new THREE.Vector3(
    ...solarSurfacePoint(a.latitude, a.longitude),
  ).applyQuaternion(bodyOrientation('sun', birth + 2));
  const worldB = new THREE.Vector3(
    ...solarSurfacePoint(b.latitude, b.longitude),
  ).applyQuaternion(bodyOrientation('sun', birth + 3));
  assert.ok(worldA.distanceTo(worldB) > 0.1);
  const second = solarActivityRegion(0, birth + 2 + 1 / 86400);
  assert.ok(Math.abs(second.longitude - a.longitude) < 1e-6);
});
void test('pause freezes plasma and spots, accelerated simulation evolves them, and disabling clears both', () => {
  const surface = new THREE.MeshBasicMaterial();
  const effects = createSunEffects(1, surface);
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = 5;
  const snapshot = (ms: number, enabled = true) => {
    const days = (ms - J2000_MS) / DAY_MS;
    effects.update(days, camera, bodyOrientation('sun', days), enabled);
    const plasma = effects.root.getObjectByName(
      'sun-prominence-filaments',
    ) as THREE.InstancedMesh;
    const corona = effects.root.getObjectByName('sun-corona') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    return {
      plasma: Array.from(plasma.geometry.getAttribute('activity').array),
      matrices: Array.from(plasma.instanceMatrix.array),
      frame: corona.material.uniforms.solarFrame.value.elements.slice(),
      flow: corona.material.uniforms.flowOffset.value.toArray(),
      spots: effects.spots.solarSpots.value.map((s) => s.toArray()),
      count: effects.spots.solarSpotCount.value,
    };
  };
  const ms = J2000_MS + 9750 * DAY_MS;
  const initial = snapshot(ms);
  assert.ok(initial.count > 0);
  assert.deepEqual(snapshot(advanceTime(ms, 10, 1, true)), initial);
  const after = snapshot(advanceTime(ms, 1, 1, false));
  assert.notDeepEqual(after.plasma, initial.plasma);
  assert.notDeepEqual(
    after.frame,
    initial.frame,
    'coronal filaments follow the rotating solar frame',
  );
  assert.notDeepEqual(after.spots, initial.spots);
  assert.deepEqual(snapshot(ms), initial);
  snapshot(ms, false);
  assert.equal(effects.root.visible, false);
  assert.equal(effects.spots.solarSpotCount.value, 0);
  assert.deepEqual(snapshot(ms), initial);
  assert.equal(effects.root.visible, true);
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {},
  };
  surface.onBeforeCompile(
    shader as Parameters<typeof surface.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  assert.ok(shader.fragmentShader.includes('solarSpotTransmission()'));
  assert.equal(
    (shader.uniforms as Record<string, unknown>).solarSpotCount,
    effects.spots.solarSpotCount,
  );
});
