import * as THREE from 'three';
import {
  asteroids,
  asteroidPosition,
  asteroidOrbitPoint,
} from '../lib/asteroids';
import { parseAsteroidModel, asteroidModelScale } from '../lib/asteroid-model';
import { displayRadius } from '../lib/display-scale';
import type { ScaleMode } from '../lib/solar';
import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';
import {
  createOrbitLine,
  setOrbitLinePoints,
  setOrbitLineWidth,
} from './orbit-line';
import { DEFAULT_ORBIT_LINE_WIDTH } from '../lib/orbit-line-width';

export function createAsteroidSystem(
  scene: THREE.Scene,
  roots: Map<string, THREE.Group>,
  meshes: Map<string, THREE.Mesh>,
  layer: HTMLElement,
  onSelect: (id: string) => void,
  onModelError: () => void = () => {},
) {
  const entries = asteroids.map((asteroid) => {
    const root = new THREE.Group();
    root.name = asteroid.id;
    scene.add(root);
    roots.set(asteroid.id, root);
    // Keep a small placeholder while the mission/PDS mesh is fetched. Ceres
    // deliberately stays near-spherical because its observed shape is close
    // to hydrostatic equilibrium and no bundled mesh is needed for it.
    const geometry: THREE.BufferGeometry = new THREE.SphereGeometry(1, 32, 20);
    const axisScale = Math.cbrt(
      1 / (asteroid.axes[0] * asteroid.axes[1] * asteroid.axes[2]),
    );
    geometry.scale(
      asteroid.axes[0] * axisScale,
      asteroid.axes[1] * axisScale,
      asteroid.axes[2] * axisScale,
    );
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: asteroid.color,
        roughness: asteroid.roughness,
        metalness: asteroid.metalness,
        bumpScale: 0.025,
      }),
    );
    mesh.userData.id = asteroid.id;
    root.add(mesh);
    meshes.set(asteroid.id, mesh);
    const path = createOrbitLine(asteroid.color, 0.35);
    path.name = `${asteroid.id}-orbit`;
    path.raycast = () => {};
    scene.add(path);
    const label = document.createElement('button');
    label.className = 'planet-label asteroid-label';
    label.onclick = () => onSelect(asteroid.id);
    layer.appendChild(label);
    return {
      asteroid,
      root,
      mesh,
      baseGeometry: geometry,
      surfaceTexture: null as THREE.Texture | null,
      path,
      label,
      projectLabel: createSceneLabel(label, -130),
    };
  });
  let disposed = false;
  let modelPromise: Promise<void> | null = null;
  let focusedId: string | null = null;
  let modelController: AbortController | null = null;
  let lastScale: ScaleMode | undefined;
  const projected = new THREE.Vector3();
  const applySurfaceTexture = (id: string, texture: THREE.Texture) => {
    const entry = entries.find((item) => item.asteroid.id === id);
    if (!entry) return;
    const material = entry.mesh.material as THREE.MeshStandardMaterial;
    entry.surfaceTexture = texture;
    // A facet atlas only has meaning on its paired model, never a fallback sphere.
    const atlas = id === 'pallas' || id === 'psyche';
    if (atlas) {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.anisotropy = 1;
      texture.needsUpdate = true;
    }
    material.map =
      atlas && entry.mesh.geometry === entry.baseGeometry ? null : texture;
    material.color.set(material.map ? 0xffffff : entry.asteroid.color);
    material.needsUpdate = true;
  };
  const applyNormalTexture = (id: string, texture: THREE.Texture) => {
    const entry = entries.find((item) => item.asteroid.id === id);
    if (!entry) return;
    const material = entry.mesh.material as THREE.MeshStandardMaterial;
    texture.colorSpace = THREE.NoColorSpace;
    material.normalMap = texture;
    material.normalScale.set(0.72, 0.72);
    material.needsUpdate = true;
  };
  return {
    setTexture(id: string, texture: THREE.Texture) {
      applySurfaceTexture(id, texture);
    },
    setNormalTexture(id: string, texture: THREE.Texture) {
      applyNormalTexture(id, texture);
    },
    clearTexture(id: string) {
      const entry = entries.find((item) => item.asteroid.id === id);
      if (!entry) return;
      const material = entry.mesh.material as THREE.MeshStandardMaterial;
      entry.surfaceTexture = null;
      material.map = null;
      material.color.set(entry.asteroid.color);
      material.needsUpdate = true;
    },
    clearNormalTexture(id: string) {
      const entry = entries.find((item) => item.asteroid.id === id);
      if (!entry) return;
      const material = entry.mesh.material as THREE.MeshStandardMaterial;
      material.normalMap = null;
      material.needsUpdate = true;
    },
    setFocus(id: string | null) {
      if (disposed || focusedId === id)
        return modelPromise ?? Promise.resolve();
      modelController?.abort();
      focusedId = id;
      const entry = entries.find(({ asteroid }) => asteroid.id === id);
      modelPromise = null;
      // Loaded shapes remain visible alongside other bodies and can be revisited
      // without changing their silhouette. Only unfinished requests are aborted.
      if (
        !entry?.asteroid.shapeModel ||
        entry.mesh.geometry !== entry.baseGeometry
      )
        return Promise.resolve();
      const { asteroid, mesh } = entry;
      const controller = new AbortController();
      modelController = controller;
      modelPromise = (async () => {
        try {
          const response = await fetch(
            `/models/asteroids/${asteroid.shapeModel}.bin?v=shape-v2`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = parseAsteroidModel(await response.arrayBuffer());
          if (disposed || controller.signal.aborted) return;
          const modelScale = asteroidModelScale(data);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(data.positions, 3),
          );
          geometry.setAttribute(
            'normal',
            new THREE.BufferAttribute(data.normals, 3),
          );
          geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
          geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
          // Normalize volume to the catalog mean radius, not an unrelated
          // placeholder axis; otherwise true-size mode silently changes size.
          geometry.scale(modelScale, modelScale, modelScale);
          geometry.computeBoundingSphere();
          geometry.computeBoundingBox();
          mesh.geometry = geometry;
          if (entry.surfaceTexture)
            applySurfaceTexture(asteroid.id, entry.surfaceTexture);
        } catch {
          if (!disposed && !controller.signal.aborted) onModelError();
        }
      })();
      return modelPromise;
    },
    localize(t: Translate) {
      for (const { asteroid, label } of entries) {
        label.textContent = t(asteroid.name);
        label.setAttribute(
          'aria-label',
          t('探索{{name}}', { name: t(asteroid.name) }),
        );
      }
    },
    update(
      days: number,
      scale: ScaleMode,
      realSizes: boolean,
      selected: string | null,
      orbits: boolean,
      orbitLineWidth = DEFAULT_ORBIT_LINE_WIDTH,
    ) {
      for (const { asteroid, root, mesh, path } of entries) {
        root.position.set(...asteroidPosition(asteroid, days, scale));
        root.scale.setScalar(displayRadius(asteroid.id, scale, realSizes));
        // Rotation phase is tied to the shared UTC clock. The imported mesh
        // carries the observed body shape; pole orientation remains outside
        // this lightweight catalog snapshot.
        mesh.rotation.y =
          (((days * 24) / asteroid.rotationHours) % 1) * Math.PI * 2;
        path.visible = orbits && selected === asteroid.id;
        setOrbitLineWidth(path, orbitLineWidth);
        if (scale !== lastScale) {
          setOrbitLinePoints(
            path,
            Array.from(
              { length: 257 },
              (_, i) =>
                new THREE.Vector3(
                  ...asteroidOrbitPoint(
                    asteroid,
                    (i / 256) * Math.PI * 2,
                    scale,
                  ),
                ),
            ),
          );
        }
      }
      lastScale = scale;
    },
    project(
      camera: THREE.Camera,
      width: number,
      height: number,
      selected: string | null,
      labels: boolean,
      isOccluded: (id: string, center: THREE.Vector3) => boolean,
    ) {
      for (const { asteroid, root, mesh, projectLabel } of entries) {
        projected.copy(root.position);
        projected.y +=
          root.scale.x * mesh.geometry.boundingSphere!.radius * 1.2;
        projected.project(camera);
        // Keep the overview readable; all named asteroids remain pickable and in navigation.
        const enabled = labels && selected === asteroid.id;
        projectLabel(
          projected,
          width,
          height,
          enabled,
          true,
          enabled && isOccluded(asteroid.id, root.position),
        );
      }
    },
    dispose() {
      disposed = true;
      modelController?.abort();
      for (const entry of entries)
        if (entry.mesh.geometry !== entry.baseGeometry) {
          entry.mesh.geometry.dispose();
          entry.mesh.geometry = entry.baseGeometry;
        }
    },
  };
}
