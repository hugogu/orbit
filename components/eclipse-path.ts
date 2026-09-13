import * as THREE from 'three';
import type { EclipseProgressEvent } from '../lib/eclipse-progress';
import { solarCircumstance } from '../lib/eclipse-progress';

export function createEclipsePath(earth: THREE.Mesh) {
  const root = new THREE.Group();
  root.name = 'solar-eclipse-path';
  root.visible = false;
  earth.add(root);
  // A swept path contains overlapping footprints. Stencil makes each visible
  // pixel blend once, keeping opacity uniform even where the shadow slows down.
  const material = new THREE.MeshBasicMaterial({
    color: 0xe5c78f,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.EqualStencilFunc,
    stencilZPass: THREE.IncrementWrapStencilOp,
  });
  const band = new THREE.Mesh(new THREE.BufferGeometry(), material);
  band.renderOrder = 2;
  const line = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xf8dfaa,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  line.renderOrder = 3;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false }),
  );
  marker.renderOrder = 4;
  for (const mesh of [band, line, marker]) {
    mesh.raycast = () => {};
    root.add(mesh);
  }
  let current: EclipseProgressEvent | null = null;
  let lastTime = NaN;
  return {
    root,
    update(
      event: EclipseProgressEvent | null,
      time: number,
      enabled: boolean,
      radius: number,
    ) {
      const solar = event?.type === 'solar' && event.path ? event : null;
      if (solar !== current) {
        current = solar;
        band.geometry.dispose();
        line.geometry.dispose();
        band.geometry = new THREE.BufferGeometry();
        line.geometry = new THREE.BufferGeometry();
        if (solar?.path) {
          band.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(solar.path.triangles, 3),
          );
          band.geometry.computeBoundingSphere();
          const points: number[] = [];
          solar.path.centers.forEach((p, i, centers) => {
            if (i && p.time - centers[i - 1].time < 90000)
              points.push(...centers[i - 1].point, ...p.point);
          });
          line.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(points, 3),
          );
          line.geometry.computeBoundingSphere();
        }
        lastTime = NaN;
      }
      root.visible =
        !!solar && enabled && time >= solar.start && time <= solar.end;
      if (!root.visible) return;
      root.scale.setScalar(radius);
      band.scale.setScalar(1.002);
      line.scale.setScalar(1.003);
      if (
        !Number.isFinite(lastTime) ||
        Math.abs(time - lastTime) >= 1000 ||
        time < lastTime
      ) {
        const now = solarCircumstance(time);
        marker.visible = !!now;
        if (now) marker.position.fromArray(now.point).multiplyScalar(1.004);
        lastTime = time;
      }
    },
    dispose() {
      root.removeFromParent();
      for (const mesh of [band, line, marker]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    },
  };
}
