import * as THREE from 'three';
import { solarNoise } from './solar-noise';
import { createProminences } from './solar-prominences';
import { attachSunspotMaterial } from './sunspot-material';
import { solarActivityAt } from '../lib/solar-activity';

// UVs are measured in solar radii; the emission ends before the quad's edges.
const coronaExtent = 2.6;
// Surface activity evolves over hours and days. Sampling it hourly avoids
// rebuilding the same procedural regions on every animation frame at real time.
const solarActivityStepDays = 1 / 24;
function createCorona(radius: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      flowOffset: { value: new THREE.Vector3() },
      solarFrame: { value: new THREE.Matrix3() },
    },
    vertexShader: `
      varying vec2 vPoint;
      void main() {
        vPoint = (uv - 0.5) * ${2 * coronaExtent};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPoint;
      uniform vec3 flowOffset;
      uniform mat3 solarFrame;
      ${solarNoise}
      void main() {
        float r = length(vPoint);
        if (r > 2.5) discard;
        float h = max(0.0, r - 1.0);
        vec2 direction = vPoint / max(r, 0.001);
        vec3 radial = solarFrame * vec3(direction, 0.0);
        float warp = fbm(radial * 6.0 + flowOffset * 0.2 + h * 1.8);
        float wisps = fbm(radial * 32.0 + warp * 2.0 + flowOffset + h * 3.0);
        float streamers = pow(fbm(radial * 7.0 + flowOffset * 0.15), 2.0);
        float filaments = pow(wisps, 3.0) * exp(-h * (8.0 - streamers * 4.0));
        float limb = exp(-h * 40.0) * (0.7 + wisps * 0.6);
        float veil = exp(-h * 7.0) * (0.14 + streamers * 0.22);
        float edge = 1.0 - smoothstep(1.8, 2.5, r);
        float intensity = (limb * 0.85 + filaments * 0.9 + veil) * edge;
        intensity *= smoothstep(0.96, 1.005, r);
        vec3 colour = mix(vec3(1.0, 0.72, 0.26), vec3(1.0, 0.24, 0.045),
                          smoothstep(0.0, 0.24, h));
        gl_FragColor = vec4(colour, intensity);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = 'sun-corona';
  mesh.scale.setScalar(radius * coronaExtent * 2);
  return mesh;
}

export function createSunEffects(
  radius: number,
  surface: THREE.MeshBasicMaterial,
) {
  const root = new THREE.Group();
  root.name = 'sun-effects';
  const corona = createCorona(radius);
  const prominences = createProminences(radius);
  root.add(corona, prominences.root);
  const spots = attachSunspotMaterial(surface);
  const worldPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const worldScale = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const facing = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 0, 1);

  const solarRotation = new THREE.Quaternion();
  const frameMatrix = new THREE.Matrix4();
  let previousActivityDays = NaN;
  let previousEnabled = true;
  let regions = solarActivityAt(0);
  return {
    root,
    spots: spots.uniforms,
    update(
      days: number,
      camera: THREE.Camera,
      orientation: THREE.Quaternion,
      enabled = true,
    ) {
      root.visible = enabled;
      const activityDays =
        Math.floor(days / solarActivityStepDays) * solarActivityStepDays;
      const activityChanged = activityDays !== previousActivityDays;
      if (activityChanged) {
        regions = solarActivityAt(activityDays);
        previousActivityDays = activityDays;
      }
      if (activityChanged || enabled !== previousEnabled)
        spots.update(regions, enabled);
      if (!enabled) {
        previousEnabled = enabled;
        return;
      }
      root.updateWorldMatrix(true, false);
      root.getWorldPosition(worldPosition);
      root.getWorldScale(worldScale);
      camera.getWorldPosition(cameraPosition);
      root.getWorldQuaternion(parentRotation).invert();
      const distance = cameraPosition.distanceTo(worldPosition);
      const worldRadius = radius * worldScale.x;
      corona.visible = distance > worldRadius;
      const ratio = Math.min(
        0.999,
        worldRadius / Math.max(distance, worldRadius),
      );
      facing
        .copy(cameraPosition)
        .sub(worldPosition)
        .normalize()
        .applyQuaternion(parentRotation);
      corona.quaternion.setFromUnitVectors(normal, facing);
      // The tangent circle follows the true limb, even when the Sun is off-centre.
      corona.position.copy(facing).multiplyScalar(radius * ratio);
      corona.scale.setScalar(
        radius * coronaExtent * 2 * Math.sqrt(1 - ratio * ratio),
      );
      const angle = (days % 2) * Math.PI * 2;
      corona.material.uniforms.flowOffset.value.set(
        Math.cos(angle * 4),
        Math.sin(angle * 4),
        Math.sin(angle / 2),
      );
      solarRotation.copy(orientation).invert().multiply(corona.quaternion);
      frameMatrix.makeRotationFromQuaternion(solarRotation);
      corona.material.uniforms.solarFrame.value.setFromMatrix4(frameMatrix);
      prominences.root.quaternion.copy(orientation);
      if (activityChanged || !previousEnabled) prominences.update(regions);
      previousEnabled = enabled;
    },
  };
}
