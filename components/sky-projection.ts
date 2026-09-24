import * as THREE from 'three';

export const STEREOGRAPHIC_SKY_PROJECTION = /* glsl */ `
uniform float skyStereographic;
vec4 skyClipPosition(vec4 viewPosition) {
  vec4 clipPosition = projectionMatrix * viewPosition;
  if (skyStereographic > 0.5) {
    // Stereographic projection is conformal, so small sky discs stay round.
    float forward = -viewPosition.z;
    float divisor = max(length(viewPosition.xyz) + forward, 1e-6);
    vec2 ndc = vec2(
      projectionMatrix[0][0] * viewPosition.x,
      projectionMatrix[1][1] * viewPosition.y
    ) * (2.0 / divisor);
    clipPosition.xy = ndc * clipPosition.w;
  }
  return clipPosition;
}
`;

export function updateGroundSkyProjection(camera: THREE.PerspectiveCamera) {
  camera.userData.skyProjection = 'stereographic';
  camera.updateProjectionMatrix();
  // Keep the camera's nominal vertical field of view at the screen edge.
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const quarterFov = THREE.MathUtils.degToRad(camera.fov / 4);
  const calibration = Math.tan(halfFov) / (2 * Math.tan(quarterFov));
  camera.projectionMatrix.elements[0] *= calibration;
  camera.projectionMatrix.elements[5] *= calibration;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function projectSkyPoint(point: THREE.Vector3, camera: THREE.Camera) {
  if (camera.userData.skyProjection !== 'stereographic')
    return point.project(camera);

  const viewPosition = point.applyMatrix4(camera.matrixWorldInverse);
  const forward = -viewPosition.z;
  const divisor = viewPosition.length() + forward;
  const elements = camera.projectionMatrix.elements;
  if (divisor <= 1e-12 || Math.abs(forward) <= 1e-12)
    return point.set(Infinity, Infinity, Infinity);

  return point.set(
    (2 * elements[0] * viewPosition.x) / divisor,
    (2 * elements[5] * viewPosition.y) / divisor,
    (elements[10] * viewPosition.z + elements[14]) / forward,
  );
}
