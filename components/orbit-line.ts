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
  brightness: number,
  points: THREE.Vector3[] = [],
) {
  const geometry = new LineGeometry();
  if (points.length > 0) geometry.setFromPoints(points);
  // Draw guide paths before opaque bodies. This keeps a continuous line free
  // of segment self-occlusion, while bodies still hide their far-side arcs.
  // Line2 inherits LineSegments2.onBeforeRender, which updates the material
  // resolution from the active renderer viewport on every render.
  const dimmedColor = new THREE.Color(color).multiplyScalar(brightness);
  const material = new LineMaterial({
    color: dimmedColor,
    depthTest: false,
    depthWrite: false,
  });
  (material as WideLineMaterial).linewidth = DEFAULT_ORBIT_LINE_WIDTH;
  const line = new Line2(geometry, material);
  line.renderOrder = -1;
  return line;
}

export function setOrbitLinePoints(line: OrbitLine, points: THREE.Vector3[]) {
  line.geometry.dispose();
  line.geometry = new LineGeometry().setFromPoints(points);
}

export function sampleClosedOrbit(
  sample: (phase: number) => THREE.Vector3,
  segments = ORBIT_PATH_SEGMENTS,
) {
  const points = Array.from({ length: segments }, (_, index) =>
    sample(index / segments),
  );
  if (points.length > 0) points.push(points[0].clone());
  return points;
}

export function setOrbitLineWidth(line: OrbitLine, width: number) {
  (line.material as WideLineMaterial).linewidth = width;
}

export function setOrbitLineForeground(line: OrbitLine, foreground: boolean) {
  // Close-up true-size views can make the selected body's guide path appear
  // disconnected because the body hides its near-side segment. Keep the
  // default occlusion for the overview, but show the focused path as a guide.
  line.renderOrder = foreground ? 1 : -1;
}

export function isOrbitLine(object: THREE.Object3D): object is OrbitLine {
  return (object as Partial<OrbitLine>).isLine2 === true;
}
