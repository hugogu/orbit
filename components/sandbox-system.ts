import * as THREE from 'three';
import type { Translate } from '../lib/i18n';
import { AU_SCENE_UNITS } from '../lib/display-scale';
import { bodies } from '../lib/solar';
import { sandboxRadius, scenePosition, spinStep } from '../lib/sandbox/display';
import { auToKm } from '../lib/sandbox/scenario';
import type { PointMass, Vec3 } from '../lib/sandbox/physics';
import type { SandboxRun } from '../lib/sandbox/run';
import {
  createOrbitLine,
  setOrbitLinePoints,
  setOrbitLineWidth,
  type OrbitLine,
} from './orbit-line';
import { createSceneLabel } from './scene-label';

/** How dim the untouched system is drawn against the edited one. */
const GHOST_OPACITY = 0.42;
const GHOST_TRAIL_BRIGHTNESS = 0.32;
const VARIANT_TRAIL_BRIGHTNESS = 0.85;
/** Points a smoothed trail may be drawn with, whatever it was sampled at. */
const TRAIL_RENDER_CAP = 1800;

/**
 * A trail is recorded on a time grid, so the faster a body goes round the
 * fewer points its orbit gets — a long run leaves the innermost planet with a
 * couple of dozen per lap. Joining those straight draws an ellipse as a
 * polygon. A centripetal Catmull-Rom spline follows the arc the samples
 * actually lie on, which is the curve the body travelled; it is uneven
 * spacing this handles, not missing physics, so it cannot invent a path the
 * samples do not support.
 */
export function smoothed(points: THREE.Vector3[]) {
  if (points.length < 3) return points;
  // A trail has nothing beyond its oldest point or beyond the body itself,
  // and asked to guess a tangent there the spline swings wide: a bulge thirty
  // times the interior error sat on the first and last segment. Each end gets
  // a reflected neighbour to take its tangent from, and the curve is then
  // read back over the real span alone so those extensions are never drawn.
  // Continued to second order (3a − 3b + c), which carries the curvature on
  // past the end. A straight continuation sits on the chord's extension, off
  // the arc, and hands the end segment the very tangent error it was meant
  // to remove.
  const continued = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    a.clone().sub(b).multiplyScalar(3).add(c);
  const last = points.length - 1;
  const control = [
    continued(points[0], points[1], points[2]),
    ...points,
    continued(points[last], points[last - 1], points[last - 2]),
  ];
  const curve = new THREE.CatmullRomCurve3(control, false, 'centripetal');
  // `getPoint` walks control points, not arc length, so the real span is
  // simply the segments between the two phantoms.
  const segments = control.length - 1;
  const from = 1 / segments;
  const span = (segments - 2) / segments;
  const count = Math.min(TRAIL_RENDER_CAP, (points.length - 1) * 4);
  return Array.from({ length: count + 1 }, (_, index) =>
    curve.getPoint(from + (span * index) / count),
  );
}

export type SandboxSceneOptions = {
  /** Draw the untouched fork alongside the edited system. */
  baseline: boolean;
  /** Draw the travelled paths. */
  trails: boolean;
  realSizes: boolean;
  selected: string | null;
  labels: boolean;
  lineWidth: number;
  /** Real seconds since the last frame, for the rotation. */
  seconds: number;
  /** Simulated days per real second, the rate the rotation follows. */
  daysPerSecond: number;
  /** Names a body's label the moment it appears, not only on a locale change. */
  translate: Translate;
};

type Extra = {
  root: THREE.Group;
  mesh: THREE.Mesh;
  label: HTMLButtonElement;
  project: ReturnType<typeof createSceneLabel>;
};

/**
 * Draws a sandbox run.
 *
 * Bodies forked from the catalogue keep the observatory's own meshes, textures
 * and labels — the sandbox only takes over where they are placed — so entering
 * the mode does not turn the Solar System into abstract dots. Bodies the
 * viewer created get their own plain spheres here, and the untouched fork is
 * drawn as wireframe ghosts with their own paths.
 */
export function createSandboxSystem(
  scene: THREE.Scene,
  roots: Map<string, THREE.Group>,
  meshes: Map<string, THREE.Mesh>,
  layer: HTMLElement,
  onSelect: (id: string) => void,
) {
  const group = new THREE.Group();
  group.name = 'sandbox';
  scene.add(group);
  const extras = new Map<string, Extra>();
  const ghosts = new Map<string, THREE.Mesh>();
  const trails = new Map<string, OrbitLine>();
  const ghostTrails = new Map<string, OrbitLine>();
  // One segment from a body to where it would have been: the clearest way to
  // read "the same instant" off the screen rather than off the panel.
  const drawn = new Map<OrbitLine, number>();
  // Accumulated display rotation per body. Integrating the rate frame by
  // frame keeps the turn continuous when the viewer changes the time rate,
  // which reading an angle straight off elapsed time could not do once the
  // rate is capped for legibility.
  const phase = new Map<string, number>();
  const spinRotation = new THREE.Quaternion();
  const tiltRotation = new THREE.Quaternion();
  const connector = createOrbitLine(0xffffff, 0.75);
  connector.visible = false;
  group.add(connector);
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  let visible = false;

  // A catalogue mesh is built at the body's authored `size`, so its group
  // scale has to divide that out before applying the run's own radius.
  const meshUnit = (id: string) =>
    bodies.find((body) => body.id === id)?.size ?? 1;
  const colorOf = (run: SandboxRun, id: string) =>
    run.facts.find((body) => body.id === id)?.color ?? '#ffffff';
  const sourceOf = (run: SandboxRun, id: string) =>
    run.facts.find((body) => body.id === id)?.sourceId ?? null;

  /** A body's label text and the reading of it, from one place. */
  function nameLabel(label: HTMLButtonElement, name: string, t: Translate) {
    label.textContent = t(name);
    label.setAttribute('aria-label', t('探索{{name}}', { name: t(name) }));
  }

  function extraFor(run: SandboxRun, point: PointMass, t: Translate) {
    const existing = extras.get(point.id);
    if (existing) return existing;
    const root = new THREE.Group();
    group.add(root);
    const mesh = new THREE.Mesh(
      sphere,
      new THREE.MeshStandardMaterial({
        color: colorOf(run, point.id),
        roughness: 1,
      }),
    );
    mesh.userData.id = point.id;
    root.add(mesh);
    const label = document.createElement('button');
    label.className = 'planet-label';
    label.onclick = () => onSelect(point.id);
    // Named here rather than only on a locale change: a body added mid-run
    // would otherwise sit in the scene as a blank, unreadable button until
    // the viewer happened to switch language.
    nameLabel(
      label,
      run.facts.find((b) => b.id === point.id)?.name ?? point.id,
      t,
    );
    layer.appendChild(label);
    const entry = { root, mesh, label, project: createSceneLabel(label) };
    extras.set(point.id, entry);
    return entry;
  }

  function lineFor(
    store: Map<string, OrbitLine>,
    id: string,
    color: THREE.ColorRepresentation,
    brightness: number,
  ) {
    const existing = store.get(id);
    if (existing) return existing;
    const line = createOrbitLine(color, brightness);
    group.add(line);
    store.set(id, line);
    return line;
  }

  function ghostFor(run: SandboxRun, point: PointMass) {
    const existing = ghosts.get(point.id);
    if (existing) return existing;
    const mesh = new THREE.Mesh(
      sphere,
      new THREE.MeshBasicMaterial({
        color: colorOf(run, point.id),
        wireframe: true,
        transparent: true,
        opacity: GHOST_OPACITY,
      }),
    );
    group.add(mesh);
    ghosts.set(point.id, mesh);
    return mesh;
  }

  function drawTrail(
    line: OrbitLine,
    history: Vec3[] | undefined,
    head: Vec3,
    show: boolean,
    width: number,
  ) {
    line.visible = show;
    if (!show || !history || history.length < 2) {
      line.visible = false;
      return;
    }
    setOrbitLineWidth(line, width);
    // The history only grows a point every sampling interval, so rebuilding
    // the geometry on every frame would rewrite hundreds of unchanged
    // vertices for nothing. The head trails the body by at most one sample.
    if (drawn.get(line) === history.length) return;
    drawn.set(line, history.length);
    setOrbitLinePoints(
      line,
      smoothed([
        ...history.map((point) => new THREE.Vector3(...scenePosition(point))),
        new THREE.Vector3(...scenePosition(head)),
      ]),
    );
  }

  function place(
    object: THREE.Object3D,
    point: PointMass,
    run: SandboxRun,
    realSizes: boolean,
  ) {
    object.position.set(...scenePosition(point.position));
    object.scale.setScalar(
      sandboxRadius(auToKm(point.radius), sourceOf(run, point.id), realSizes),
    );
  }

  const projected = new THREE.Vector3();
  const north = new THREE.Vector3(0, 1, 0);
  const roll = new THREE.Vector3(0, 0, 1);

  /** Turns a body about its own axis and leans it by its tilt. */
  function orient(
    pivot: THREE.Object3D,
    id: string,
    run: SandboxRun,
    options: SandboxSceneOptions,
  ) {
    const spec = run.facts.find((body) => body.id === id);
    const turned =
      (phase.get(id) ?? 0) +
      spinStep(spec?.spinDays ?? 0, options.daysPerSecond, options.seconds);
    phase.set(id, turned % (Math.PI * 2));
    pivot.quaternion
      .copy(spinRotation.setFromAxisAngle(north, turned))
      .premultiply(
        tiltRotation.setFromAxisAngle(
          roll,
          ((spec?.tilt ?? 0) * Math.PI) / 180,
        ),
      );
  }

  return {
    /** Catalogue bodies the run no longer contains, so the scene can hide them. */
    missing(run: SandboxRun) {
      const present = new Set(run.variant.map((point) => point.id));
      return (id: string) => !present.has(id);
    },
    setVisible(next: boolean) {
      visible = next;
      group.visible = next;
      if (!next)
        for (const extra of extras.values()) extra.label.style.display = 'none';
    },
    update(run: SandboxRun, options: SandboxSceneOptions) {
      if (!visible) return;
      const live = new Set(run.variant.map((point) => point.id));
      for (const [id, extra] of extras)
        if (!live.has(id)) {
          extra.root.visible = false;
          extra.label.style.display = 'none';
        }
      for (const point of run.variant) {
        // A forked body keeps the observatory's own mesh; only its placement
        // comes from the simulation.
        const root = roots.get(point.id);
        if (root) {
          const pivot = meshes.get(point.id)?.parent;
          if (pivot) orient(pivot, point.id, run, options);
          root.position.set(...scenePosition(point.position));
          root.scale.setScalar(
            sandboxRadius(
              auToKm(point.radius),
              sourceOf(run, point.id),
              options.realSizes,
            ) / meshUnit(point.id),
          );
        } else {
          const extra = extraFor(run, point, options.translate);
          extra.root.visible = true;
          orient(extra.mesh, point.id, run, options);
          place(extra.root, point, run, options.realSizes);
        }
        drawTrail(
          lineFor(
            trails,
            point.id,
            colorOf(run, point.id),
            VARIANT_TRAIL_BRIGHTNESS,
          ),
          run.trails.get(point.id),
          point.position,
          options.trails,
          options.lineWidth,
        );
      }
      for (const [id, line] of trails) if (!live.has(id)) line.visible = false;

      const shadowed = new Set(run.baseline.map((point) => point.id));
      for (const point of run.baseline) {
        const ghost = ghostFor(run, point);
        ghost.visible = options.baseline;
        place(ghost, point, run, options.realSizes);
        drawTrail(
          lineFor(
            ghostTrails,
            point.id,
            colorOf(run, point.id),
            GHOST_TRAIL_BRIGHTNESS,
          ),
          run.baselineTrails.get(point.id),
          point.position,
          options.baseline && options.trails,
          options.lineWidth,
        );
      }
      for (const [id, ghost] of ghosts)
        if (!shadowed.has(id)) ghost.visible = false;
      for (const [id, line] of ghostTrails)
        if (!shadowed.has(id)) line.visible = false;

      const focus = options.selected;
      const here = run.variant.find((point) => point.id === focus);
      const there = run.baseline.find((point) => point.id === focus);
      const gap =
        here && there
          ? Math.hypot(
              ...here.position.map(
                (value, axis) => value - there.position[axis],
              ),
            )
          : 0;
      // Below a pixel the segment is noise; above it, it is the measurement.
      connector.visible =
        options.baseline && gap * AU_SCENE_UNITS > 0.05 && !!here && !!there;
      if (connector.visible && here && there)
        setOrbitLinePoints(connector, [
          new THREE.Vector3(...scenePosition(here.position)),
          new THREE.Vector3(...scenePosition(there.position)),
        ]);
    },
    localize(run: SandboxRun, t: Translate) {
      for (const [id, extra] of extras)
        nameLabel(
          extra.label,
          run.facts.find((b) => b.id === id)?.name ?? id,
          t,
        );
    },
    project(
      run: SandboxRun,
      camera: THREE.Camera,
      width: number,
      height: number,
      options: SandboxSceneOptions,
    ) {
      if (!visible) return;
      for (const point of run.variant) {
        const extra = extras.get(point.id);
        if (!extra) continue;
        projected.copy(extra.root.position);
        projected.y +=
          sandboxRadius(
            auToKm(point.radius),
            sourceOf(run, point.id),
            options.realSizes,
          ) * 1.2;
        projected.project(camera);
        extra.project(
          projected,
          width,
          height,
          options.labels,
          point.id === options.selected,
          false,
        );
      }
    },
    /** Scene-unit position of a body in the edited system, for camera framing. */
    positionOf(run: SandboxRun, id: string) {
      const point = run.variant.find((item) => item.id === id);
      return point ? new THREE.Vector3(...scenePosition(point.position)) : null;
    },
    dispose() {
      for (const extra of extras.values()) extra.label.remove();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      sphere.dispose();
      scene.remove(group);
    },
  };
}
