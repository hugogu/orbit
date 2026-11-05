import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import {
  createOrbitLine,
  isOrbitLine,
  ORBIT_PATH_SEGMENTS,
  sampleClosedOrbit,
  setOrbitLinePoints,
  setOrbitLineWidth,
} from '../components/orbit-line';
import { DEFAULT_ORBIT_LINE_WIDTH } from '../lib/orbit-line-width';
import { bodies } from '../lib/solar';
import { orbitingMoons } from '../lib/moon-orbits';
import { asteroids } from '../lib/asteroids';
import { displayRadius } from '../lib/display-scale';

void test('the renderer queue preserves near arcs and occludes far arcs at every body scale', () => {
  // Exercise Three's actual sorting and sphere intersections, rather than only
  // checking renderOrder's numeric value. This fails when guides are drawn
  // under bodies or when a focused true-size guide disables depth testing.
  for (const body of [...bodies, ...orbitingMoons, ...asteroids]) {
    for (const scale of ['illustrated', 'distance'] as const) {
      for (const realSizes of [false, true]) {
        const radius = displayRadius(body.id, scale, realSizes);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 32, 24),
          new THREE.MeshBasicMaterial(),
        );
        const camera = new THREE.PerspectiveCamera(
          47,
          1,
          radius * 0.01,
          radius * 100,
        );
        camera.position.z = radius * 8;
        camera.updateMatrixWorld();
        mesh.updateMatrixWorld();
        const line = createOrbitLine(
          '#ffffff',
          0.3,
          sampleClosedOrbit((phase) => {
            const angle = phase * Math.PI * 2;
            return new THREE.Vector3(
              Math.cos(angle) * radius * 2.5,
              0,
              Math.sin(angle) * radius * 2.5,
            );
          }),
        );
        // A depth buffer only keeps what earlier, depth-writing objects wrote.
        // Follow the sorted draw calls at a ray crossing the near/far arcs.
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const surface = raycaster.intersectObject(mesh)[0].distance;
        for (const [arc, expected] of [
          ['near', 'orbit'],
          ['far', 'body'],
        ] as const) {
          const point = new THREE.Vector3(
            0,
            0,
            (arc === 'near' ? 1 : -1) * radius * 2.5,
          );
          const pathDistance = point.distanceTo(camera.position);
          // The type declarations require properties and comparators, while
          // this renderer API uses its built-in comparators when omitted.
          const list = new WebGLRenderList(undefined!);
          list.push(line, line.geometry, line.material, 0, pathDistance, null);
          list.push(mesh, mesh.geometry, mesh.material, 0, surface, null);
          list.sort(undefined!, undefined!, false);
          let depth = Infinity;
          let visible = '';
          for (const item of list.opaque) {
            const distance = item.object === line ? pathDistance : surface;
            if (item.material.depthTest && distance > depth) continue;
            visible = item.object === line ? 'orbit' : 'body';
            if (item.material.depthWrite) depth = distance;
          }
          assert.equal(
            visible,
            expected,
            `${body.id} ${scale} realSizes=${realSizes} ${arc}`,
          );
        }
        line.geometry.dispose();
        line.material.dispose();
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }
});

void test('orbit lines use a wide-line material and accept a configured pixel width', () => {
  assert.equal(ORBIT_PATH_SEGMENTS, 2048);
  const line = createOrbitLine(0xffffff, 0.3, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  assert.ok(isOrbitLine(line));
  assert.equal(
    line.material.color.getHex(),
    new THREE.Color(0xffffff).multiplyScalar(0.3).getHex(),
  );
  assert.equal(
    (line.material as typeof line.material & { linewidth: number }).linewidth,
    DEFAULT_ORBIT_LINE_WIDTH,
  );
  assert.equal(line.material.transparent, false);
  assert.equal(line.material.depthWrite, false);
  // Bodies are drawn first, so testing against their depth hides the far-side
  // arc alone and leaves the arc passing in front of a body visible.
  assert.equal(line.material.depthTest, true);
  assert.ok(line.renderOrder > 0);
  line.onBeforeRender({
    getViewport(target: THREE.Vector4) {
      return target.set(0, 0, 1920, 1080);
    },
  } as unknown as THREE.WebGLRenderer);
  assert.deepEqual(line.material.resolution.toArray(), [1920, 1080]);
  const before = line.geometry;
  setOrbitLineWidth(line, 5);
  setOrbitLinePoints(line, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  assert.notEqual(line.geometry, before);
  assert.equal(
    (line.material as typeof line.material & { linewidth: number }).linewidth,
    5,
  );
  line.geometry.dispose();
  line.material.dispose();
});

void test('closed orbit sampling distributes endpoint drift without a seam kink', () => {
  const phases: number[] = [];
  const points = sampleClosedOrbit((phase) => {
    phases.push(phase);
    const angle = phase * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) + phase * 0.25,
      Math.sin(angle),
      phase * 0.1,
    );
  });
  assert.equal(points.length, ORBIT_PATH_SEGMENTS + 1);
  assert.equal(phases.length, ORBIT_PATH_SEGMENTS + 1);
  assert.equal(phases.at(-1), 1);
  assert.deepEqual(points[0].toArray(), points.at(-1)!.toArray());
  for (const index of [1, 511, 1024, 2047]) {
    const angle = (index / ORBIT_PATH_SEGMENTS) * Math.PI * 2;
    assert.ok(
      points[index].distanceTo(
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0),
      ) < 1e-12,
    );
  }
  const outgoing = points[1].clone().sub(points[0]).normalize();
  const incoming = points.at(-1)!.clone().sub(points.at(-2)!).normalize();
  assert.ok(outgoing.angleTo(incoming) < 0.004);
});
