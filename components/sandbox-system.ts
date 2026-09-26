import * as THREE from 'three';
import type { Translate } from '../lib/i18n';
import { AU_SCENE_UNITS } from '../lib/display-scale';
import { bodies } from '../lib/solar';
import { orbitingMoons } from '../lib/moon-orbits';
import {
  moonDisplayDistance,
  sandboxRadius,
  scenePosition,
  spinStep,
} from '../lib/sandbox/display';
import { osculatingOrbit } from '../lib/sandbox/derived';
import { auToKm } from '../lib/sandbox/scenario';
import type { PointMass, Vec3 } from '../lib/sandbox/physics';
import type { SandboxRun } from '../lib/sandbox/run';
import {
  createOrbitLine,
  setOrbitLinePoints,
  setOrbitLineWidth,
  type OrbitLine,
} from './orbit-line';
import { createSandboxTrail, type SandboxTrail } from './sandbox-trail';
import { createSceneLabel } from './scene-label';

/** How dim the untouched system is drawn against the edited one. */
const GHOST_OPACITY = 0.42;
const GHOST_TRAIL_BRIGHTNESS = 0.32;
const VARIANT_TRAIL_BRIGHTNESS = 0.85;
const VARIANT_RING_BRIGHTNESS = 0.5;
const GHOST_RING_BRIGHTNESS = 0.22;
/**
 * Seconds between reshaping a moon's ring. A ring follows its planet every
 * frame; its shape only changes as the orbit does, which is far slower.
 */
const RING_RESHAPE_SECONDS = 0.2;
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
  /** The mesh's own radius, which its root's scale divides out. */
  unit: number;
  label: HTMLButtonElement;
  project: ReturnType<typeof createSceneLabel>;
};

type Ring = {
  line: OrbitLine;
  shaped: number;
  /** What it was last shaped from, as `orbitInputs` lists it. */
  from: number[];
};

/**
 * What a moon's ring is drawn from: its place and motion about its planet,
 * and the two masses that bend it.
 */
function orbitInputs(point: PointMass, planet: PointMass) {
  return [
    ...point.position.map((value, axis) => value - planet.position[axis]),
    ...point.velocity.map((value, axis) => value - planet.velocity[axis]),
    point.mass,
    planet.mass,
  ];
}

/**
 * Draws a sandbox run.
 *
 * Bodies forked from the catalogue keep the observatory's own meshes, textures
 * and labels — the sandbox only takes over where they are placed — so entering
 * the mode does not turn the Solar System into abstract dots. Bodies the
 * viewer created get their own plain spheres here, and the untouched fork is
 * drawn as wireframe ghosts with their own paths. A moon borrows the
 * explorer's mesh for it, shared rather than copied, and is drawn out from
 * its planet along the moon map with its current orbit as a ring.
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
  const trails = new Map<string, SandboxTrail>();
  const ghostTrails = new Map<string, SandboxTrail>();
  // Accumulated display rotation per body. Integrating the rate frame by
  // frame keeps the turn continuous when the viewer changes the time rate,
  // which reading an angle straight off elapsed time could not do once the
  // rate is capped for legibility.
  const phase = new Map<string, number>();
  const spinRotation = new THREE.Quaternion();
  const tiltRotation = new THREE.Quaternion();
  // One segment from a body to where it would have been: the clearest way to
  // read "the same instant" off the screen rather than off the panel.
  const connector = createOrbitLine(0xffffff, 0.75);
  connector.visible = false;
  group.add(connector);
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const rings = new Map<string, Ring>();
  const ghostRings = new Map<string, Ring>();
  let clock = 0;
  let ringSizes: boolean | null = null;
  const anchor = new THREE.Vector3();
  let visible = false;

  // A catalogue mesh is built at the body's authored `size`, so its group
  // scale has to divide that out before applying the run's own radius.
  const meshUnit = (id: string) =>
    bodies.find((body) => body.id === id)?.size ??
    orbitingMoons.find((moon) => moon.id === id)?.size ??
    1;
  // The explorer keeps moon roots in the same map as the planets, inside a
  // container the sandbox hides, so only a planet's root is taken over.
  const planetIds = new Set(bodies.map((body) => body.id));
  const parentOf = (run: SandboxRun, id: string) =>
    run.facts.find((body) => body.id === id)?.parentId;

  /**
   * Where a body is drawn. Everything sits at its true place except a moon,
   * which is drawn out from its planet along the moon map so that it is seen
   * beside a planet drawn thousands of times its size.
   *
   * `drawn` is whichever of the run's own interpolated maps `id` belongs to —
   * `run.drawn` for the edited system, `run.baselineDrawn` for the untouched
   * one — so a moon is remapped from the same moment on screen its planet is
   * drawn at, not from the last whole step.
   */
  function shownAt(
    run: SandboxRun,
    drawn: Map<string, Vec3>,
    id: string,
    position: Vec3,
    realSizes: boolean,
    into: THREE.Vector3,
  ) {
    into.set(...scenePosition(position));
    const parentId = parentOf(run, id);
    const planetPosition = parentId ? drawn.get(parentId) : undefined;
    if (!parentId || !planetPosition) return into;
    anchor.set(...scenePosition(planetPosition));
    into.sub(anchor);
    const distance = into.length();
    if (distance === 0) return into.copy(anchor);
    return into
      .multiplyScalar(
        moonDisplayDistance(parentId, distance, realSizes) / distance,
      )
      .add(anchor);
  }
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
    // A moon wears the explorer's own mesh, texture and all. The geometry and
    // material stay the explorer's: they are borrowed, and never disposed here.
    const borrowed = planetIds.has(point.id) ? undefined : meshes.get(point.id);
    const mesh = borrowed
      ? new THREE.Mesh(borrowed.geometry, borrowed.material)
      : new THREE.Mesh(
          sphere,
          new THREE.MeshStandardMaterial({
            color: colorOf(run, point.id),
            roughness: 1,
          }),
        );
    mesh.userData.borrowed = !!borrowed;
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
    const entry = {
      root,
      mesh,
      unit: borrowed ? meshUnit(point.id) : 1,
      label,
      project: createSceneLabel(label),
    };
    extras.set(point.id, entry);
    return entry;
  }

  /**
   * Draws each moon's current orbit as a ring around its planet, through the
   * same map the moon itself is drawn with. An orbit that has opened into an
   * escape has no ring to draw.
   */
  function drawRings(
    run: SandboxRun,
    store: Map<string, Ring>,
    points: readonly PointMass[],
    brightness: number,
    show: boolean,
    options: SandboxSceneOptions,
  ) {
    const reshape = ringSizes !== options.realSizes;
    const present = new Set<string>();
    for (const point of points) {
      const parentId = parentOf(run, point.id);
      if (!parentId) continue;
      present.add(point.id);
      let ring = store.get(point.id);
      if (!ring) {
        ring = {
          line: createOrbitLine(colorOf(run, point.id), brightness),
          shaped: -Infinity,
          from: [],
        };
        group.add(ring.line);
        store.set(point.id, ring);
      }
      const planet = points.find((item) => item.id === parentId);
      if (!show || !planet) {
        ring.line.visible = false;
        continue;
      }
      ring.line.position.set(...scenePosition(planet.position));
      setOrbitLineWidth(ring.line, options.lineWidth);
      // Moving, a ring follows its orbit a few times a second. Paused, the
      // clock that paces it stands still, so the ring is reshaped whenever
      // what it is drawn from has changed: an edit, a rewind or a new run.
      if (
        !reshape &&
        options.seconds > 0 &&
        clock - ring.shaped < RING_RESHAPE_SECONDS
      )
        continue;
      const from = orbitInputs(point, planet);
      if (!reshape && from.every((value, index) => value === ring.from[index]))
        continue;
      ring.shaped = clock;
      ring.from = from;
      const orbit = osculatingOrbit(point, planet);
      ring.line.visible = !!orbit;
      if (!orbit) continue;
      setOrbitLinePoints(
        ring.line,
        orbit.map((offset) => {
          const at = new THREE.Vector3(...scenePosition(offset));
          const distance = at.length();
          return distance === 0
            ? at
            : at.multiplyScalar(
                moonDisplayDistance(parentId, distance, options.realSizes) /
                  distance,
              );
        }),
      );
    }
    for (const [id, ring] of store)
      if (!present.has(id)) ring.line.visible = false;
  }

  function trailFor(
    store: Map<string, SandboxTrail>,
    id: string,
    color: THREE.ColorRepresentation,
    brightness: number,
  ) {
    const existing = store.get(id);
    if (existing) return existing;
    const trail = createSandboxTrail(color, brightness);
    group.add(trail.line);
    store.set(id, trail);
    return trail;
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

  /**
   * Draws every trail a system has kept, each on to where its body is drawn.
   * A body absorbed in a merge is gone from the system but not from its
   * trails, whose end is where it hit, so its trail is drawn on to that point
   * rather than on to a body.
   */
  function drawTrails(
    run: SandboxRun,
    store: Map<string, SandboxTrail>,
    histories: Map<string, Vec3[]>,
    heads: Map<string, Vec3>,
    brightness: number,
    show: boolean,
    width: number,
  ) {
    for (const [id, history] of histories) {
      const trail = trailFor(store, id, colorOf(run, id), brightness);
      if (!show || history.length === 0) {
        trail.line.visible = false;
        continue;
      }
      setOrbitLineWidth(trail.line, width);
      trail.draw(history, heads.get(id) ?? history[history.length - 1]);
    }
    for (const [id, trail] of store)
      if (!histories.has(id)) trail.line.visible = false;
  }

  function place(
    object: THREE.Object3D,
    point: PointMass,
    drawn: Map<string, Vec3>,
    run: SandboxRun,
    realSizes: boolean,
    unit = 1,
  ) {
    shownAt(
      run,
      drawn,
      point.id,
      drawn.get(point.id) ?? point.position,
      realSizes,
      object.position,
    );
    object.scale.setScalar(
      sandboxRadius(auToKm(point.radius), sourceOf(run, point.id), realSizes) /
        unit,
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
      clock += options.seconds;
      const live = new Set(run.variant.map((point) => point.id));
      for (const [id, extra] of extras)
        if (!live.has(id)) {
          extra.root.visible = false;
          extra.label.style.display = 'none';
        }
      for (const point of run.variant) {
        // Drawn at the moment on screen rather than at the last whole step,
        // so a body moves on every frame whatever the step and the rate.
        const position = run.drawn.get(point.id) ?? point.position;
        // A forked body keeps the observatory's own mesh; only its placement
        // comes from the simulation.
        const root = planetIds.has(point.id) ? roots.get(point.id) : undefined;
        if (root) {
          const pivot = meshes.get(point.id)?.parent;
          if (pivot) orient(pivot, point.id, run, options);
          root.position.set(...scenePosition(position));
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
          place(
            extra.root,
            point,
            run.drawn,
            run,
            options.realSizes,
            extra.unit,
          );
        }
      }
      drawRings(
        run,
        rings,
        run.variant,
        VARIANT_RING_BRIGHTNESS,
        options.trails,
        options,
      );
      drawTrails(
        run,
        trails,
        run.trails,
        run.drawn,
        VARIANT_TRAIL_BRIGHTNESS,
        options.trails,
        options.lineWidth,
      );

      const shadowed = new Set(run.baseline.map((point) => point.id));
      for (const point of run.baseline) {
        const ghost = ghostFor(run, point);
        ghost.visible = options.baseline;
        place(ghost, point, run.baselineDrawn, run, options.realSizes);
      }
      drawRings(
        run,
        ghostRings,
        run.baseline,
        GHOST_RING_BRIGHTNESS,
        options.baseline && options.trails,
        options,
      );
      ringSizes = options.realSizes;
      for (const [id, ghost] of ghosts)
        if (!shadowed.has(id)) ghost.visible = false;
      drawTrails(
        run,
        ghostTrails,
        run.baselineTrails,
        run.baselineDrawn,
        GHOST_TRAIL_BRIGHTNESS,
        options.baseline && options.trails,
        options.lineWidth,
      );

      const focus = options.selected;
      const here = focus ? run.drawn.get(focus) : undefined;
      const there = focus ? run.baselineDrawn.get(focus) : undefined;
      const gap =
        here && there
          ? Math.hypot(...here.map((value, axis) => value - there[axis]))
          : 0;
      // Below a pixel the segment is noise; above it, it is the measurement.
      connector.visible =
        options.baseline && gap * AU_SCENE_UNITS > 0.05 && !!here && !!there;
      if (connector.visible && focus && here && there)
        setOrbitLinePoints(connector, [
          shownAt(
            run,
            run.drawn,
            focus,
            here,
            options.realSizes,
            new THREE.Vector3(),
          ),
          shownAt(
            run,
            run.baselineDrawn,
            focus,
            there,
            options.realSizes,
            new THREE.Vector3(),
          ),
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
      const selectedParent = options.selected
        ? parentOf(run, options.selected)
        : undefined;
      for (const point of run.variant) {
        const extra = extras.get(point.id);
        if (!extra) continue;
        // A moon is named only around the planet being looked at, as in the
        // explorer; thirteen names at once would bury the planets'.
        const parentId = parentOf(run, point.id);
        const named =
          !parentId ||
          options.selected === point.id ||
          options.selected === parentId ||
          selectedParent === parentId;
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
          options.labels && named,
          point.id === options.selected,
          false,
        );
      }
    },
    /** Scene-unit position of a body in the edited system, for camera framing. */
    positionOf(run: SandboxRun, id: string, realSizes: boolean) {
      const position = run.drawn.get(id);
      return position
        ? shownAt(run, run.drawn, id, position, realSizes, new THREE.Vector3())
        : null;
    },
    dispose() {
      for (const extra of extras.values()) extra.label.remove();
      group.traverse((object) => {
        if (object.userData.borrowed) return;
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
