import * as THREE from 'three';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { scenePosition } from '../lib/sandbox/display';
import type { Vec3 } from '../lib/sandbox/physics';
import { createOrbitLine, type OrbitLine } from './orbit-line';

/** Drawn segments per recorded span: a lap of two dozen points reads as a curve. */
const SUBDIVISIONS = 4;
/** Segments a trail's buffer starts with; it doubles whenever it fills. */
const INITIAL_SEGMENTS = 1024;
/** Closer than this to its last recorded point, a body is treated as on it. */
const COINCIDENT_AU = 1e-9;

/**
 * Carries a path on past its end, for the spline to take a tangent from.
 *
 * A trail has nothing beyond its oldest point or beyond the body itself, and
 * asked to guess a tangent there the spline swings wide: a bulge thirty times
 * the interior error sat on the first and last segment. Continued to second
 * order (3a − 3b + c), which carries the curvature on past the end. A straight
 * continuation sits on the chord's extension, off the arc, and hands the end
 * segment the very tangent error it was meant to remove.
 */
function continued(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  return a.clone().sub(b).multiplyScalar(3).add(c);
}

/**
 * The drawn points over spans `first` to `last` of the centripetal
 * Catmull-Rom spline through `path`, from `path[first]` on.
 *
 * A span reads only its own two points and one either side, continued past
 * either end of `path` where there is none. That locality is what lets a trail
 * be drawn a piece at a time: once the points around a span are recorded, the
 * span never changes again.
 */
function spans(path: THREE.Vector3[], first: number, last: number) {
  const end = path.length - 1;
  const control = (index: number) =>
    index < 0
      ? continued(path[0], path[1], path[2])
      : index > end
        ? continued(path[end], path[end - 1], path[end - 2])
        : path[index];
  const points = [path[first]];
  for (let index = first; index < last; index++) {
    const curve = new THREE.CatmullRomCurve3(
      [control(index - 1), path[index], path[index + 1], control(index + 2)],
      false,
      'centripetal',
    );
    // The middle third of a four-point curve is this span.
    for (let step = 1; step < SUBDIVISIONS; step++)
      points.push(curve.getPoint((1 + step / SUBDIVISIONS) / 3));
    points.push(path[index + 1]);
  }
  return points;
}

/**
 * A trail is recorded once per turn of the body's heading, a couple of dozen
 * points a lap, and joining those straight draws an ellipse as a polygon. A
 * centripetal Catmull-Rom spline follows the arc the samples actually lie on,
 * which is the curve the body travelled; it is uneven spacing this handles,
 * not missing physics, so it cannot invent a path the samples do not support.
 */
export function smoothed(points: THREE.Vector3[]) {
  return points.length < 3 ? points : spans(points, 0, points.length - 1);
}

export type SandboxTrail = {
  line: OrbitLine;
  /** Draws `history` on to the body at `head`, redrawing only what moved. */
  draw(history: Vec3[], head: Vec3): void;
};

/**
 * A trail that can hold a whole run.
 *
 * Rebuilding the curve every frame cost as much as the trail was long, which
 * is what used to keep trails short. Spans whose surrounding points are all
 * recorded are final, so they are written once to a buffer that only grows;
 * each frame redraws just the last recorded span and the way on to the body.
 */
export function createSandboxTrail(
  color: THREE.ColorRepresentation,
  brightness: number,
): SandboxTrail {
  const line = createOrbitLine(color, brightness);
  // Its extent changes every frame and it is never picked, so a bounding
  // volume would only cost a pass over every point to keep current.
  line.frustumCulled = false;
  let buffer: THREE.InstancedInterleavedBuffer | null = null;
  // Segments written for good, and the recorded spans they cover.
  let sealed = 0;
  let spansDone = 0;
  // The recorded point the sealed part starts from. A trail that has lost its
  // oldest part, or belongs to a new run, starts from another one.
  let origin: Vec3 | undefined;

  const toScene = (point: Vec3) => new THREE.Vector3(...scenePosition(point));

  function reserve(segments: number) {
    const capacity = buffer ? buffer.array.length / 6 : 0;
    if (segments <= capacity) return;
    let size = Math.max(INITIAL_SEGMENTS, capacity * 2);
    while (size < segments) size *= 2;
    const array = new Float32Array(size * 6);
    if (buffer) array.set(buffer.array.subarray(0, sealed * 6));
    buffer = new THREE.InstancedInterleavedBuffer(array, 6, 1);
    buffer.setUsage(THREE.DynamicDrawUsage);
    const geometry = new LineGeometry();
    geometry.setAttribute(
      'instanceStart',
      new THREE.InterleavedBufferAttribute(buffer, 3, 0),
    );
    geometry.setAttribute(
      'instanceEnd',
      new THREE.InterleavedBufferAttribute(buffer, 3, 3),
    );
    line.geometry.dispose();
    line.geometry = geometry;
  }

  /** Writes a polyline as segments from segment `at` on; returns how many. */
  function write(points: THREE.Vector3[], at: number) {
    const count = Math.max(0, points.length - 1);
    if (count === 0) return 0;
    reserve(at + count);
    const array = buffer!.array;
    for (let index = 0; index < count; index++) {
      const from = points[index];
      const to = points[index + 1];
      const offset = (at + index) * 6;
      array[offset] = from.x;
      array[offset + 1] = from.y;
      array[offset + 2] = from.z;
      array[offset + 3] = to.x;
      array[offset + 4] = to.y;
      array[offset + 5] = to.z;
    }
    return count;
  }

  return {
    line,
    draw(history, head) {
      if (history[0] !== origin) {
        origin = history[0];
        sealed = 0;
        spansDone = 0;
      }
      const recorded = history.length;
      const dirty = sealed;
      // Spans up to the third-last recorded point have all four of their
      // points recorded.
      const final = recorded - 2;
      if (final > spansDone) {
        const from = Math.max(0, spansDone - 1);
        const path = history.slice(from).map(toScene);
        sealed += write(spans(path, spansDone - from, final - from), sealed);
        spansDone = final;
      }
      // The rest moves with the body. Right after a point is recorded the body
      // sits on it, and a span of no length has no direction to take.
      const last = history[recorded - 1];
      const moved =
        Math.hypot(head[0] - last[0], head[1] - last[1], head[2] - last[2]) >
        COINCIDENT_AU;
      const from = Math.max(0, spansDone - 1);
      const path = history.slice(from).map(toScene);
      if (moved) path.push(toScene(head));
      const tail =
        path.length < 3 ? path : spans(path, spansDone - from, path.length - 1);
      const drawn = sealed + write(tail, sealed);
      // A body that has not left its only point has no trail yet.
      line.visible = drawn > 0;
      if (!buffer || drawn === 0) return;
      (line.geometry as LineGeometry).instanceCount = drawn;
      buffer.addUpdateRange(dirty * 6, (drawn - dirty) * 6);
      buffer.needsUpdate = true;
    },
  };
}
