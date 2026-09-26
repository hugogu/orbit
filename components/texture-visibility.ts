import * as THREE from 'three';

export type TextureVisibilityCandidate = {
  name: string;
  mesh: THREE.Mesh;
};

const frustum = new THREE.Frustum();
const projection = new THREE.Matrix4();
const sphere = new THREE.Sphere();

/** Collect map names for bodies large enough to show on screen. */
export function visibleTextureNames(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  candidates: readonly TextureVisibilityCandidate[],
  visible: string[] = [],
) {
  visible.length = 0;
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(
    projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const focalLength =
    viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  for (const { name, mesh } of candidates) {
    if (!mesh.visible) continue;
    let hidden = false;
    for (let parent = mesh.parent; parent; parent = parent.parent)
      if (!parent.visible) {
        hidden = true;
        break;
      }
    if (hidden) continue;
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
    if (!frustum.intersectsSphere(sphere)) continue;
    const distance = Math.max(
      camera.near,
      camera.position.distanceTo(sphere.center) - sphere.radius,
    );
    if ((2 * sphere.radius * focalLength) / distance < 2) continue;
    visible.push(name);
  }
  return visible;
}
