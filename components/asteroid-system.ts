import * as THREE from 'three';
import {
  asteroids,
  asteroidPosition,
  asteroidOrbitPoint,
} from '../lib/asteroids';
import { parseAsteroidModel } from '../lib/asteroid-model';
import { displayRadius } from '../lib/display-scale';
import type { ScaleMode } from '../lib/solar';
import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';

export function createAsteroidSystem(
  scene: THREE.Scene,
  roots: Map<string, THREE.Group>,
  meshes: Map<string, THREE.Mesh>,
  layer: HTMLElement,
  onSelect: (id: string) => void,
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
    geometry.scale(asteroid.axes[0], asteroid.axes[1], asteroid.axes[2]);
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
    const path = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: asteroid.color,
        transparent: true,
        opacity: 0.35,
      }),
    );
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
      path,
      label,
      projectLabel: createSceneLabel(label, -130),
    };
  });
  let disposed = false;
  let modelPromise: Promise<void> | null = null;
  let lastScale: ScaleMode | undefined;
  const projected = new THREE.Vector3();
  const applySurfaceTexture = (id: string, texture: THREE.Texture) => {
    const entry = entries.find((item) => item.asteroid.id === id);
    if (!entry) return;
    const material = entry.mesh.material as THREE.MeshStandardMaterial;
    material.map = texture;
    material.color.set(0xffffff);
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
    setTexture(idOrTexture: string | THREE.Texture, texture?: THREE.Texture) {
      if (typeof idOrTexture === 'string') {
        if (texture) applySurfaceTexture(idOrTexture, texture);
        return;
      }
      // Kept for the scene unit test and for callers from older integrations;
      // production registration always targets the matching asteroid.
      for (const { asteroid } of entries) applySurfaceTexture(asteroid.id, idOrTexture);
    },
    setNormalTexture(id: string, texture: THREE.Texture) {
      applyNormalTexture(id, texture);
    },
    clearTexture(id: string) {
      const entry = entries.find((item) => item.asteroid.id === id);
      if (!entry) return;
      const material = entry.mesh.material as THREE.MeshStandardMaterial;
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
    loadModels() {
      if (modelPromise) return modelPromise;
      modelPromise = Promise.all(
        entries
          .filter(({ asteroid }) => asteroid.shapeModel)
          .map(async ({ asteroid, mesh }) => {
            try {
              const response = await fetch(
                `/models/asteroids/${asteroid.shapeModel}.bin`,
              );
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const data = parseAsteroidModel(await response.arrayBuffer());
              if (disposed) return;
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(data.positions, 3),
              );
              geometry.setAttribute(
                'normal',
                new THREE.BufferAttribute(data.normals, 3),
              );
              geometry.setAttribute(
                'uv',
                new THREE.BufferAttribute(data.uvs, 2),
              );
              geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
              // The conversion pipeline normalizes model vertices to a unit
              // circumradius. Match the placeholder's outer radius without
              // applying the axes again; imported mission shapes already
              // carry their own measured aspect ratios.
              const modelScale = Math.max(...asteroid.axes);
              geometry.scale(modelScale, modelScale, modelScale);
              geometry.computeBoundingSphere();
              geometry.computeBoundingBox();
              const previous = mesh.geometry;
              mesh.geometry = geometry;
              previous.dispose();
            } catch {
              // The sphere remains a safe fallback if an optional model fails.
            }
          }),
      ).then(() => undefined);
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
        if (scale !== lastScale) {
          path.geometry.dispose();
          path.geometry = new THREE.BufferGeometry().setFromPoints(
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
    },
  };
}
