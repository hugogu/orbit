import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DEFAULT_ORBIT_LINE_WIDTH } from '@/lib/orbit-line-width';

export type OrbitLine = Line2;
export const ORBIT_PATH_SEGMENTS = 2048;
/** Above the bodies' default order, below surface overlays such as eclipse paths. */
const ORBIT_LINE_RENDER_ORDER = 1;

type WideLineMaterial = LineMaterial & { linewidth: number };

export function createOrbitLine(
  color: THREE.ColorRepresentation,
  brightness: number,
  points: THREE.Vector3[] = [],
) {
  const geometry = new LineGeometry();
  if (points.length > 0) geometry.setFromPoints(points);
  // Draw guide paths after the opaque bodies and depth-test against them, so a
  // body hides the arc behind it and not the one crossing in front. A moon's
  // guide is only a couple of planet radii wide, so discarding its near side
  // would sink the whole ring into the planet's disc.
  // Depth writes stay off and the dimming is baked into an opaque colour, so
  // adjacent wide-line segments can neither occlude nor double-blend each other.
  // Line2 inherits LineSegments2.onBeforeRender, which updates the material
  // resolution from the active renderer viewport on every render.
  const dimmedColor = new THREE.Color(color).multiplyScalar(brightness);
  const material = new LineMaterial({
    color: dimmedColor,
    depthWrite: false,
  });
  (material as WideLineMaterial).linewidth = DEFAULT_ORBIT_LINE_WIDTH;
  const line = new Line2(geometry, material);
  line.renderOrder = ORBIT_LINE_RENDER_ORDER;
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
  const points = Array.from({ length: segments + 1 }, (_, index) =>
    sample(index / segments),
  );
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return points;
  // Precise ephemerides include perturbations, so one nominal period may end
  // slightly away from the starting point. Spread that drift across the whole
  // guide instead of concentrating it in a visible closing segment.
  const drift = last.clone().sub(first);
  for (let index = 1; index < segments; index++)
    points[index].addScaledVector(drift, -index / segments);
  last.copy(first);
  return points;
}

export function setOrbitLineWidth(line: OrbitLine, width: number) {
  (line.material as WideLineMaterial).linewidth = width;
}

export function setOrbitLineForeground(line: OrbitLine, foreground: boolean) {
  // A true-size body can swallow most of its own guide path from close up.
  // Keep the default occlusion for the overview, but let the focused path show
  // through as a guide.
  line.material.depthTest = !foreground;
}

export function isOrbitLine(object: THREE.Object3D): object is OrbitLine {
  return (object as Partial<OrbitLine>).isLine2 === true;
}
