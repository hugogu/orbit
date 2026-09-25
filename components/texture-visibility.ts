import * as THREE from 'three';

export type TextureVisibilityCandidate = {
  name: string;
  mesh: THREE.Mesh;
};

/** Request standard maps for bodies large enough to show on screen. */
export function visibleTextureNames(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  candidates: readonly TextureVisibilityCandidate[],
) {
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const focalLength =
    viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const sphere = new THREE.Sphere();
  const visible: string[] = [];

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
