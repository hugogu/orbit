import * as THREE from 'three';
import { cometActivity } from '../lib/comets';

// Gaussian splats approximate optically thin gas/dust, without a solid shell or
// a per-frame particle simulation. The local +Y axis is antisolar, +X trailing.
// Morphology: https://science.nasa.gov/solar-system/comets/facts/
const tailVertex = `
  attribute float progress;
  uniform float tailLength, tailWidth, bend, phase;
  varying vec2 cloudUv;
  varying float age, visibility;
  void main() {
    float t = progress;
    float width = .17 + tailWidth * pow(t, .8) * (.95 + .05 * sin(t * 31. - phase));
    vec3 center = vec3(bend * t * t, tailLength * t, 0.);
    vec3 tangent = normalize(vec3(2. * bend * t, tailLength, 0.));
    vec3 viewTangent = mat3(modelViewMatrix) * tangent;
    float projectedLength = length(viewTangent.xy);
    vec2 along = projectedLength > .001 ? viewTangent.xy / projectedLength : vec2(1., 0.);
    vec2 across = vec2(-along.y, along.x);
    float axialRadius = mix(width, max(width * .85, tailLength * .05), projectedLength);
    vec4 viewCenter = modelViewMatrix * vec4(center, 1.);
    viewCenter.xy += along * position.x * axialRadius + across * position.y * width;
    gl_Position = projectionMatrix * viewCenter;
    cloudUv = position.xy;
    age = t + position.x * axialRadius / tailLength;
    // Avoid an opaque knot when many splats overlap in an end-on view.
    visibility = .25 + .75 * projectedLength;
  }
`;

const tailFragment = `
  uniform float phase, activity, dust;
  varying vec2 cloudUv;
  varying float age, visibility;
  void main() {
    float r2 = dot(cloudUv, cloudUv);
    float cloud = exp(-4.5 * r2) * (1. - smoothstep(.55, 1., r2));
    float envelope = (1. - smoothstep(.35, 1., age)) * exp(-1.4 * max(age, 0.));
    float flow = age * 26. - phase;
    float filaments = mix(.86 + .09 * sin(cloudUv.y * 19. + sin(flow) * .8)
      + .05 * sin(cloudUv.y * 37. - flow * .7),
      .94 + .06 * sin(cloudUv.y * 7. + flow * .3), dust);
    vec3 color = mix(vec3(.25, .53, 1.), vec3(.9, .83, .7), dust);
    color = mix(color, vec3(.78, .92, 1.), .25 * exp(-age * 8.));
    float alpha = cloud * envelope * filaments * activity * visibility * mix(.23, .27, dust);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createTail(name: string, dust: boolean) {
  const count = dust ? 48 : 56;
  const quad = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.attributes.position = quad.attributes.position;
  geometry.instanceCount = count;
  geometry.setAttribute(
    'progress',
    new THREE.InstancedBufferAttribute(
      Float32Array.from({ length: count }, (_, i) => i / (count - 1)),
      1,
    ),
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tailLength: { value: dust ? 7.5 : 11 },
      tailWidth: { value: dust ? 1.55 : 0.5 },
      bend: { value: dust ? 3.8 : 0 },
      phase: { value: 0 },
      activity: { value: 0 },
      dust: { value: dust ? 1 : 0 },
    },
    vertexShader: tailVertex,
    fragmentShader: tailFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  // The vertices are displaced in the shader, beyond the source quad's bounds.
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}

export function createCometAtmosphere() {
  const group = new THREE.Group();
  group.name = 'comet-atmosphere';
  const ion = createTail('ion-tail', false);
  const dust = createTail('dust-tail', true);
  const tails = [ion, dust];
  const coma = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { activity: { value: 0 } },
      vertexShader: `
        varying vec2 cloudUv;
        void main() {
          vec4 center = modelViewMatrix * vec4(0., 0., 0., 1.);
          center.xy += position.xy * 1.3;
          gl_Position = projectionMatrix * center;
          cloudUv = position.xy;
        }
      `,
      fragmentShader: `
        uniform float activity;
        varying vec2 cloudUv;
        void main() {
          float r2 = dot(cloudUv, cloudUv);
          float halo = exp(-5. * r2) * (1. - smoothstep(.4, 1., r2));
          gl_FragColor = vec4(.48, .83, .76, halo * activity * .34);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  coma.name = 'comet-coma';
  coma.frustumCulled = false;
  coma.raycast = () => {};
  group.add(ion, dust, coma);
  const away = new THREE.Vector3();
  const trailing = new THREE.Vector3();
  const frame = new THREE.Matrix4();
  return {
    group,
    update(
      position: THREE.Vector3,
      orbitNormal: THREE.Vector3,
      days: number,
      enabled: boolean,
    ) {
      const activity = enabled ? cometActivity(position.length() / 3.1) : 0;
      group.visible = activity > 0;
      if (!group.visible) return;
      group.position.copy(position);
      away.copy(position).normalize();
      trailing.crossVectors(away, orbitNormal).normalize();
      group.quaternion.setFromRotationMatrix(
        frame.makeBasis(trailing, away, orbitNormal),
      );
      const strength = activity * activity;
      for (const tail of tails) {
        const u = tail.material.uniforms;
        u.activity.value = strength;
        u.tailLength.value =
          (tail === ion ? 11 : 7.5) * (0.15 + 0.85 * activity);
        u.tailWidth.value = (tail === ion ? 0.5 : 1.55) * activity;
        u.bend.value = tail === dust ? 3.8 * activity : 0;
        // Hours-to-days evolution, tied to the UTC clock (including pause/seek).
        // Periodic phases keep GPU floats small throughout the supported dates.
        u.phase.value = ((days % 100) / 10) * Math.PI * 2;
      }
      coma.material.uniforms.activity.value = strength;
    },
  };
}
