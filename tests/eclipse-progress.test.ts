import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  calculateEclipsesForDay,
  eclipseProgress,
  eventAtTime,
  solarCircumstance,
  solarContactMargin,
  solarPathWidth,
} from '../lib/eclipse-progress';
import { createEclipsePath } from '../components/eclipse-path';
import { DAY_MS } from '../lib/simulation-time';

const total = calculateEclipsesForDay(Date.parse('2024-04-08'))[0];
const annular = calculateEclipsesForDay(Date.parse('2023-10-14'))[0];

void test('solar global contacts bracket the entire event, not a local observing window', () => {
  assert.equal(total.kind, 'total');
  assert.ok(
    total.start < total.central!.start && total.central!.start < total.peak,
  );
  assert.ok(total.peak < total.central!.end && total.central!.end < total.end);
  for (const central of [false, true]) {
    const range = central ? total.central! : total;
    assert.ok(solarContactMargin(range.start - 1000, central) > 0);
    assert.ok(solarContactMargin(range.start + 1000, central) < 0);
    assert.ok(solarContactMargin(range.end - 1000, central) < 0);
    assert.ok(solarContactMargin(range.end + 1000, central) > 0);
  }
  // NASA global contacts and WGS84 path (spherical model tolerance):
  // https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2024Apr08Tpath.html
  assert.ok(
    Math.abs(total.start - Date.parse('2024-04-08T15:42:00Z')) < 120000,
  );
  assert.ok(Math.abs(total.end - Date.parse('2024-04-08T20:52:00Z')) < 120000);
});

void test('full paths include both ends and use Earth-fixed physical geometry', () => {
  for (const event of [total, annular]) {
    const path = event.path!;
    assert.equal(path.coverage, 'central');
    assert.ok(path.centers[0].time < event.peak - 90 * 60000);
    assert.ok(path.centers.at(-1)!.time > event.peak + 90 * 60000);
    assert.ok(path.triangles.length > 0 && path.triangles.length % 9 === 0);
    for (let i = 0; i < path.triangles.length; i += 3) {
      assert.ok(
        Math.abs(Math.hypot(...path.triangles.slice(i, i + 3)) - 1) < 1e-6,
      );
    }
  }
  const mexico = solarCircumstance(Date.parse('2024-04-08T18:00:00Z'))!;
  assert.ok(Math.abs(mexico.latitude - (20 + 19.2 / 60)) < 0.5);
  assert.ok(Math.abs(mexico.longitude + (108 + 45.8 / 60)) < 0.5);
  assert.equal(mexico.kind, 'total');
  assert.equal(mexico.obscuration, 1);
  assert.ok(
    Math.abs(solarPathWidth(Date.parse('2024-04-08T18:00:00Z'))! - 201) < 10,
  );
  const ring = solarCircumstance(annular.peak)!;
  assert.equal(ring.kind, 'annular');
  assert.ok(ring.obscuration > 0.8 && ring.obscuration < 0.99);
});

void test('partial eclipses have a coverage area without an invented central track', () => {
  const partial = calculateEclipsesForDay(Date.parse('2025-03-29'))[0];
  assert.equal(partial.kind, 'partial');
  assert.equal(partial.central, undefined);
  assert.equal(partial.path!.coverage, 'partial');
  assert.equal(partial.path!.centers.length, 0);
  assert.ok(partial.path!.triangles.length > 0);
  assert.equal(solarCircumstance(partial.peak), null);
});

void test('hybrid events retain total and annular sections', () => {
  const hybrid = calculateEclipsesForDay(Date.parse('2023-04-20'))[0];
  assert.equal(hybrid.kind, 'hybrid');
  assert.deepEqual(
    [...new Set(hybrid.path!.centers.map((p) => p.kind))].sort(),
    ['annular', 'total'],
  );
});

void test('lunar phases reflect total, partial and penumbral circumstances', () => {
  for (const [date, kind, phaseCount, stage] of [
    ['2025-03-14', 'total', 7, '全食阶段'],
    ['2024-09-18', 'partial', 5, '偏食阶段'],
    ['2024-03-25', 'penumbral', 3, '半影阶段'],
  ] as const) {
    const event = calculateEclipsesForDay(Date.parse(date))[0];
    assert.equal(event.type, 'lunar');
    assert.equal(event.kind, kind);
    assert.equal(event.phases.length, phaseCount);
    assert.equal(eclipseProgress(event, event.peak).stage, stage);
    assert.ok(
      Math.abs(eclipseProgress(event, event.peak).fraction - 0.5) < 1e-6,
    );
    assert.equal(event.path, undefined);
    for (let i = 1; i < event.phases.length; i++)
      assert.ok(event.phases[i].time > event.phases[i - 1].time);
  }
});

void test('progress survives midnight, backwards seeks and ordinary dates without stale events', () => {
  const day = Date.parse('2016-03-08');
  const event = calculateEclipsesForDay(day)[0];
  assert.ok(event.start < day + DAY_MS && event.end > day + DAY_MS);
  assert.equal(calculateEclipsesForDay(day + DAY_MS)[0].id, event.id);
  assert.equal(eventAtTime([event], event.peak), event);
  assert.equal(eventAtTime([event], event.start - 1), null);
  assert.equal(eventAtTime([event], event.end + 1), null);
  assert.equal(eclipseProgress(event, event.start - 1000).fraction, 0);
  assert.equal(eclipseProgress(event, event.end + 1000).fraction, 1);
  assert.equal(eclipseProgress(event, event.start).fraction, 0);
  assert.equal(eclipseProgress(event, event.start).stage, '全球偏食阶段');
  assert.deepEqual(calculateEclipsesForDay(Date.parse('2024-04-12')), []);
  assert.throws(() => calculateEclipsesForDay(NaN));
});

void test('path rendering reuses geometry, follows display scale, hides stale paths and releases GPU resources', () => {
  const earth = new THREE.Mesh();
  const path = createEclipsePath(earth);
  path.update(total, total.peak, true, 2);
  assert.equal(path.root.parent, earth);
  assert.equal(path.root.visible, true);
  assert.equal(path.root.scale.x, 2);
  const band = path.root.children[0] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
  const geometry = band.geometry;
  assert.equal(band.material.stencilFunc, THREE.EqualStencilFunc);
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  path.update(total, total.peak + 30000, true, 0.01);
  assert.equal(band.geometry, geometry);
  assert.equal(path.root.scale.x, 0.01);
  const hits: THREE.Intersection[] = [];
  for (const child of path.root.children)
    child.raycast(new THREE.Raycaster(), hits);
  assert.equal(hits.length, 0);
  path.update(total, total.peak, false, 2);
  assert.equal(path.root.visible, false);
  path.update(total, total.end + 1, true, 2);
  assert.equal(path.root.visible, false);
  path.update(null, total.end + DAY_MS, true, 2);
  assert.equal(disposed, 1);
  path.dispose();
  assert.equal(path.root.parent, null);
});
