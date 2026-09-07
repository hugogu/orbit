import * as THREE from 'three';
import { orbitingMoons, moonOffset } from '../lib/moon-orbits';
import type { ScaleMode } from '../lib/solar';

export function createMoonSystem(
  scene: THREE.Scene,
  roots: Map<string, THREE.Group>,
  meshes: Map<string, THREE.Mesh>,
  layer: HTMLElement,
  onSelect: (id: string) => void,
  moonTexture: THREE.Texture,
) {
  const entries = orbitingMoons.map((moon) => {
    const root = new THREE.Group();
    root.name = moon.id;
    scene.add(root);
    roots.set(moon.id, root);
    const irregular = ['Phobos', 'Deimos', 'Nereid'].includes(moon.en);
    const mesh = new THREE.Mesh(
      irregular
        ? new THREE.IcosahedronGeometry(moon.size, 1)
        : new THREE.SphereGeometry(moon.size, 24, 16),
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
    const path = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: moon.color,
        transparent: true,
        opacity: 0.3,
      }),
    );
    path.name = `${moon.id}-orbit`;
    scene.add(path);
    const label = document.createElement('button');
    label.className = 'planet-label moon-label';
    label.textContent = moon.name;
    label.setAttribute('aria-label', `跟随${moon.name}`);
    label.onclick = () => onSelect(moon.id);
    layer.appendChild(label);
    return { moon, root, mesh, path, label };
  });
  let lastScale = '';
  const projected = new THREE.Vector3();
  return {
    update(
      days: number,
      scale: ScaleMode,
      selected: string | null,
      orbits: boolean,
    ) {
      const parentId =
        orbitingMoons.find((m) => m.id === selected)?.parentId ?? selected;
      for (const { moon, root, mesh, path } of entries) {
        const parent = roots.get(moon.parentId)!;
        root.position
          .copy(parent.position)
          .add(new THREE.Vector3(...moonOffset(moon, days, scale)));
        root.scale.setScalar(scale === 'distance' ? 0.32 : 1);
        mesh.rotation.y = (days / moon.period) * Math.PI * 2;
        path.position.copy(parent.position);
        path.visible = orbits && parentId === moon.parentId;
        if (lastScale !== scale) {
          const points = Array.from(
            { length: 257 },
            (_, i) =>
              new THREE.Vector3(
                ...moonOffset(
                  moon,
                  (i / 256 - moon.phase / (2 * Math.PI)) * moon.period,
                  scale,
                ),
              ),
          );
          path.geometry.dispose();
          path.geometry = new THREE.BufferGeometry().setFromPoints(points);
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
    ) {
      const parentId =
        orbitingMoons.find((m) => m.id === selected)?.parentId ?? selected;
      for (const { moon, root, label } of entries) {
        projected.copy(root.position).project(camera);
        label.style.display =
          labels &&
          parentId === moon.parentId &&
          Math.abs(projected.z) < 1 &&
          Math.abs(projected.x) < 0.97 &&
          Math.abs(projected.y) < 0.94
            ? 'block'
            : 'none';
        label.style.transform = `translate(-50%,-130%) translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px)`;
        label.classList.toggle('selected', selected === moon.id);
      }
    },
  };
}
