import * as THREE from 'three';
import {
  asteroids,
  asteroidPosition,
  asteroidOrbitPoint,
} from '../lib/asteroids';
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
    const geometry = new THREE.SphereGeometry(1, 64, 40);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      const relief =
        asteroid.surface === 'round'
          ? 1
          : asteroid.surface === 'top'
            ? 1 + 0.14 * Math.exp(-Math.abs(y) * 8)
            : 1 +
              0.06 *
                Math.sin(x * 7 + asteroid.number) *
                Math.sin(y * 9 + z * 6);
      positions.setXYZ(
        i,
        x * asteroid.axes[0] * relief,
        y * asteroid.axes[1] * relief,
        z * asteroid.axes[2] * relief,
      );
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: asteroid.color,
        roughness: 0.94,
        metalness: asteroid.id === 'psyche' ? 0.18 : 0,
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
  let lastScale: ScaleMode | undefined;
  const projected = new THREE.Vector3();
  return {
    setTexture(texture: THREE.Texture) {
      for (const { mesh } of entries) {
        mesh.material.map = texture;
        mesh.material.bumpMap = texture;
        mesh.material.needsUpdate = true;
      }
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
        // Rotation phase and pole are illustrative; time always comes from the shared UTC clock.
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
  };
}
