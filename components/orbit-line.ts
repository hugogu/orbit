import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DEFAULT_ORBIT_LINE_WIDTH } from '@/lib/orbit-line-width';

export type OrbitLine = Line2;
export const ORBIT_PATH_SEGMENTS = 2048;

type WideLineMaterial = LineMaterial & { linewidth: number };

export function createOrbitLine(
  color: THREE.ColorRepresentation,
  opacity: number,
  points: THREE.Vector3[] = [],
) {
  const geometry = new LineGeometry();
  if (points.length > 0) geometry.setFromPoints(points);
  // Adjacent screen-space segments overlap at oblique angles. Keep the depth
  // test so bodies hide the far side, but never let one segment occlude another.
  const material = new LineMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  (material as WideLineMaterial).linewidth = DEFAULT_ORBIT_LINE_WIDTH;
  return new Line2(geometry, material);
}

export function setOrbitLinePoints(line: OrbitLine, points: THREE.Vector3[]) {
  line.geometry.dispose();
  line.geometry = new LineGeometry().setFromPoints(points);
}

export function setOrbitLineWidth(line: OrbitLine, width: number) {
  (line.material as WideLineMaterial).linewidth = width;
}

export function isOrbitLine(object: THREE.Object3D): object is OrbitLine {
  return (object as Partial<OrbitLine>).isLine2 === true;
}
