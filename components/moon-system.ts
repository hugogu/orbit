import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';
import * as THREE from 'three';
import { orbitingMoons } from '../lib/moon-orbits';
import { displayRadius, moonDisplayOffset } from '../lib/display-scale';
import { bodyOrientation } from '../lib/ephemeris';
import type { ScaleMode } from '../lib/solar';
import {
  createOrbitLine,
  ORBIT_PATH_SEGMENTS,
  setOrbitLinePoints,
  setOrbitLineWidth,
} from './orbit-line';
import { DEFAULT_ORBIT_LINE_WIDTH } from '../lib/orbit-line-width';
import { registerTerrainGeometry } from './planet-surface';
import type { createTextureManager } from './texture-manager';

export function createMoonSystem(
  scene: THREE.Scene,
  roots: Map<string, THREE.Group>,
  meshes: Map<string, THREE.Mesh>,
  layer: HTMLElement,
  onSelect: (id: string) => void,
  moonTexture: THREE.Texture | null,
  textures: ReturnType<typeof createTextureManager>,
) {
  const terrainSurfaces: ReturnType<typeof registerTerrainGeometry>[] = [];
  const entries = orbitingMoons.map((moon) => {
    const root = new THREE.Group();
    root.name = moon.id;
    scene.add(root);
    roots.set(moon.id, root);
    const irregular = ['Phobos', 'Deimos', 'Nereid'].includes(moon.en);
    const mesh = new THREE.Mesh(
      irregular
        ? new THREE.IcosahedronGeometry(moon.size, 1)
        : new THREE.SphereGeometry(moon.size, 64, 48),
      new THREE.MeshStandardMaterial({
        color: moon.color,
        roughness: 1,
        map: moon.en === 'Moon' ? moonTexture : null,
      }),
    );
    if (irregular) mesh.scale.set(1.2, 0.8, 1);
    mesh.userData.id = moon.id;
    root.add(mesh);
    meshes.set(moon.id, mesh);
    if (moon.surfaceTexture)
      textures.register(
        moon.surfaceTexture,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          mesh.material.normalMap = texture;
          mesh.material.normalMapType = THREE.ObjectSpaceNormalMap;
          mesh.material.needsUpdate = true;
        },
        {
          lazy: true,
          preload: false,
          colorSpace: THREE.NoColorSpace,
          clear: () => {
            mesh.material.normalMap = null;
            mesh.material.needsUpdate = true;
          },
        },
      );
    if (
      moon.heightTexture &&
      moon.terrainMinKm !== undefined &&
      moon.terrainMaxKm !== undefined &&
      moon.radius !== undefined
    )
      terrainSurfaces.push(
        registerTerrainGeometry(
          {
            id: moon.id,
            heightTexture: moon.heightTexture,
            terrainMinKm: moon.terrainMinKm,
            terrainMaxKm: moon.terrainMaxKm,
            radius: moon.radius,
            size: moon.size,
          },
          mesh,
          textures,
        ),
      );
    const path = createOrbitLine(moon.color, 0.3);
    path.name = `${moon.id}-orbit`;
    scene.add(path);
    const label = document.createElement('button');
    label.className = 'planet-label moon-label';
    label.textContent = moon.name;
    label.setAttribute('aria-label', `跟随${moon.name}`);
    label.onclick = () => onSelect(moon.id);
    layer.appendChild(label);
    return {
      moon,
      root,
      mesh,
      path,
      label,
      projectLabel: createSceneLabel(label, -130),
    };
  });
  let lastScale = '',
    lastRealSizes = false,
    lastPathDay = NaN;
  const projected = new THREE.Vector3();
  return {
    localize(t: Translate) {
      for (const { moon, label } of entries) {
        label.textContent = t(moon.name);
        label.setAttribute(
          'aria-label',
          t('跟随{{name}}', { name: t(moon.name) }),
        );
      }
    },
    update(
      days: number,
      scale: ScaleMode,
      selected: string | null,
      orbits: boolean,
      realSizes = false,
      orbitLineWidth = DEFAULT_ORBIT_LINE_WIDTH,
    ) {
      const parentId =
        orbitingMoons.find((m) => m.id === selected)?.parentId ?? selected;
      for (const { moon, root, mesh, path } of entries) {
        const parent = roots.get(moon.parentId)!;
        root.position
          .copy(parent.position)
          .add(moonDisplayOffset(moon, days, scale, realSizes));
        root.scale.setScalar(
          displayRadius(moon.id, scale, realSizes) / moon.size,
        );
        if (moon.en === 'Moon')
          mesh.quaternion.copy(bodyOrientation(moon.id, days));
        else mesh.lookAt(parent.position); // Synchronous orientation is schematic for these surfaces.
        path.position.copy(parent.position);
        path.visible = orbits && parentId === moon.parentId;
        setOrbitLineWidth(path, orbitLineWidth);
        if (
          lastScale !== scale ||
          lastRealSizes !== realSizes ||
          !Number.isFinite(lastPathDay) ||
          Math.abs(days - lastPathDay) > 30
        ) {
          const points = Array.from({ length: ORBIT_PATH_SEGMENTS + 1 }, (_, i) =>
            moonDisplayOffset(
              moon,
              days + (i / ORBIT_PATH_SEGMENTS) * moon.period,
              scale,
              realSizes,
            ),
          );
          setOrbitLinePoints(path, points);
        }
      }
      lastScale = scale;
      lastRealSizes = realSizes;
      if (!Number.isFinite(lastPathDay) || Math.abs(days - lastPathDay) > 30)
        lastPathDay = days;
    },
    project(
      camera: THREE.Camera,
      width: number,
      height: number,
      selected: string | null,
      labels: boolean,
      isOccluded?: (id: string, center: THREE.Vector3) => boolean,
    ) {
      const parentId =
        orbitingMoons.find((m) => m.id === selected)?.parentId ?? selected;
      for (const { moon, root, projectLabel } of entries) {
        projected.copy(root.position);
        projected.y += moon.size * root.scale.x * 1.1;
        projected.project(camera);
        projectLabel(
          projected,
          width,
          height,
          labels && parentId === moon.parentId,
          selected === moon.id,
          isOccluded?.(moon.id, root.position) ?? false,
        );
      }
    },
    dispose() {
      terrainSurfaces.forEach((surface) => surface.dispose());
    },
  };
}
