import * as THREE from 'three';

const COUNT = 1800;
const VARIANTS = 6;
const INNER_RADIUS = 35;
const OUTER_RADIUS = 40;

function rockGeometry(variant: number, detail: number) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    // Deform by direction, not vertex index, so duplicated face/seam vertices
    // stay joined and both detail levels describe the same underlying rock.
    const radius =
      1 +
      0.16 * Math.sin(point.x * 3.7 + point.y * 2.3 + variant * 1.7) +
      0.12 * Math.cos(point.z * 4.1 - point.y * 3.2 + variant * 0.9);
    point.multiplyScalar(radius);
    positions.setXYZ(
      i,
      point.x * (1 + variant * 0.09),
      point.y * (0.72 + (variant % 3) * 0.12),
      point.z * (0.82 + (variant % 2) * 0.13),
    );
  }
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Decorative population in illustrated scene units, not measured bodies. */
export function createAsteroidBelt(positionRandom: () => number) {
  const root = new THREE.Group();
  root.name = 'asteroid-belt';
  const material = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const shapes = Array.from({ length: VARIANTS }, (_, variant) => ({
    far: rockGeometry(variant, 0),
    near: rockGeometry(variant, 1),
  }));
  const meshes = shapes.map(({ far }, variant) => {
    const mesh = new THREE.InstancedMesh(far, material, COUNT / VARIANTS);
    mesh.name = `belt-rock-${variant}`;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    return mesh;
  });
  // Appearance has its own seed to preserve the outer populations' positions.
  let seed = 913;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const angle = positionRandom() * Math.PI * 2;
    const radius =
      INNER_RADIUS + positionRandom() * (OUTER_RADIUS - INNER_RADIUS);
    const y = (positionRandom() - 0.5) * 2;
    const planarRadius = Math.sqrt(radius * radius - y * y);
    transform.position.set(
      Math.cos(angle) * planarRadius,
      y,
      Math.sin(angle) * planarRadius,
    );
    // Many small fragments, a few larger silhouettes; all remain schematic.
    const size = 0.035 + 0.18 * random() ** 3;
    transform.scale.set(
      size * (0.8 + random() * 0.4),
      size * (0.8 + random() * 0.4),
      size * (0.8 + random() * 0.4),
    );
    transform.rotation.set(
      random() * Math.PI * 2,
      random() * Math.PI * 2,
      random() * Math.PI * 2,
    );
    transform.updateMatrix();
    const mesh = meshes[i % VARIANTS];
    const index = Math.floor(i / VARIANTS);
    mesh.setMatrixAt(index, transform.matrix);
    const shade = 0.12 + random() * 0.2;
    const warmth = random();
    color.setRGB(
      shade * (1 + warmth * 0.16),
      shade,
      shade * (1 - warmth * 0.18),
    );
    mesh.setColorAt(index, color);
  }
  for (const [i, mesh] of meshes.entries()) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    // Include both LODs in the once-only bounds calculation.
    mesh.computeBoundingSphere();
    const bounds = mesh.boundingSphere!.clone();
    mesh.geometry = shapes[i].near;
    mesh.computeBoundingSphere();
    mesh.boundingSphere!.union(bounds);
    mesh.geometry = shapes[i].far;
  }
  let near = false;
  return {
    root,
    update(cameraPosition: THREE.Vector3) {
      if (!root.visible) return;
      const radial = Math.hypot(cameraPosition.x, cameraPosition.z);
      const radialGap = Math.max(
        INNER_RADIUS - radial,
        radial - OUTER_RADIUS,
        0,
      );
      const distance = Math.hypot(
        radialGap,
        Math.max(Math.abs(cameraPosition.y) - 1, 0),
      );
      // Hysteresis prevents rapid geometry swaps at the distance threshold.
      const nextNear = distance < (near ? 24 : 18);
      if (near === nextNear) return;
      near = nextNear;
      for (let i = 0; i < meshes.length; i++)
        meshes[i].geometry = near ? shapes[i].near : shapes[i].far;
    },
    dispose() {
      root.removeFromParent();
      meshes.forEach((mesh) => mesh.dispose());
      shapes.forEach(({ near, far }) => {
        near.dispose();
        far.dispose();
      });
      material.dispose();
      root.clear();
    },
  };
}
