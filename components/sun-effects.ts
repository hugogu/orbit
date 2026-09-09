import * as THREE from 'three';

type SunEffects = {
  root: THREE.Group;
  update: (seconds: number, camera: THREE.Camera) => void;
};

const radialPoint = (angle: number, radius: number) =>
  new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);

function createCorona(radius: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        vec2 point = (vUv - 0.5) * 2.0;
        float distanceFromCore = length(point);
        float angle = atan(point.y, point.x);
        float streams = 0.52
          + 0.24 * sin(angle * 7.0 + time * 0.22)
          + 0.16 * sin(angle * 15.0 - time * 0.13);
        float corona = smoothstep(0.74, 1.02, distanceFromCore)
          * (1.0 - smoothstep(1.12, 1.40, distanceFromCore));
        float flare = pow(max(0.0, streams), 5.0)
          * smoothstep(0.92, 1.12, distanceFromCore)
          * (1.0 - smoothstep(1.17, 1.42, distanceFromCore));
        float alpha = corona * 0.15 + flare * 0.36;
        vec3 colour = mix(
          vec3(1.0, 0.22, 0.025),
          vec3(1.0, 0.86, 0.36),
          smoothstep(0.9, 1.4, distanceFromCore)
        );
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(colour, alpha);
      }
    `,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  corona.name = 'sun-corona';
  corona.scale.setScalar(radius * 4.1);
  corona.renderOrder = -3;
  return { corona, material };
}

function createRays(radius: number) {
  const rays = new THREE.Group();
  rays.name = 'sun-rays';
  const rayPhases = [
    0.06, 0.47, 0.89, 1.31, 1.88, 2.22, 2.74, 3.11, 3.49, 3.96, 4.31, 4.78,
    5.17, 5.61, 5.93,
  ];
  const rayMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, phase: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      uniform float phase;
      void main() {
        float width = 1.0 - smoothstep(0.08, 0.5, abs(vUv.x - 0.5));
        float lengthwise = smoothstep(0.0, 0.18, vUv.y)
          * (1.0 - smoothstep(0.42, 1.0, vUv.y));
        float pulse = 0.58 + 0.42 * sin(time * 0.72 + phase);
        gl_FragColor = vec4(1.0, 0.58, 0.12, width * lengthwise * pulse * 0.3);
      }
    `,
  });
  rayPhases.forEach((phase, index) => {
    const length = radius * (0.68 + (index % 5) * 0.13);
    const geometry = new THREE.PlaneGeometry(
      radius * (0.07 + (index % 3) * 0.02),
      length,
    );
    geometry.translate(0, radius * 1.02 + length * 0.5, 0);
    const ray = new THREE.Mesh(geometry, rayMaterial.clone());
    (ray.material as THREE.ShaderMaterial).uniforms.phase.value = phase;
    ray.rotation.z = phase;
    ray.renderOrder = -2;
    rays.add(ray);
  });
  return rays;
}

function createProminences(radius: number) {
  const prominences = new THREE.Group();
  prominences.name = 'sun-prominences';
  const configurations = [
    [0.18, 0.35, 0.25],
    [0.92, 0.23, 0.18],
    [1.71, 0.42, 0.32],
    [2.66, 0.28, 0.2],
    [3.47, 0.38, 0.28],
    [4.21, 0.22, 0.18],
    [5.22, 0.34, 0.26],
    [5.75, 0.19, 0.16],
  ];
  configurations.forEach(([angle, span, height], index) => {
    const curve = new THREE.QuadraticBezierCurve3(
      radialPoint(angle - span / 2, radius * 0.96),
      radialPoint(angle, radius * (1 + height)),
      radialPoint(angle + span / 2, radius * 0.96),
    );
    const prominence = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, radius * 0.024, 6, false),
      new THREE.MeshBasicMaterial({
        color: index % 2 ? 0xff4a13 : 0xff8a25,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    prominence.name = `sun-prominence-${index + 1}`;
    prominence.renderOrder = 2;
    prominence.userData.phase = angle * 1.7;
    prominences.add(prominence);
  });
  return prominences;
}

export function createSunEffects(radius: number): SunEffects {
  const root = new THREE.Group();
  root.name = 'sun-effects';
  const { corona, material: coronaMaterial } = createCorona(radius);
  const rays = createRays(radius);
  const prominences = createProminences(radius);
  root.add(corona, rays, prominences);

  return {
    root,
    update(seconds, camera) {
      root.quaternion.copy(camera.quaternion);
      coronaMaterial.uniforms.time.value = seconds;
      rays.rotation.z = seconds * 0.025;
      rays.children.forEach((ray, index) => {
        const material = (ray as THREE.Mesh).material as THREE.ShaderMaterial;
        material.uniforms.time.value = seconds;
        ray.scale.y = 0.9 + 0.16 * Math.sin(seconds * 0.65 + index * 1.7);
      });
      prominences.children.forEach((prominence) => {
        const material = (prominence as THREE.Mesh)
          .material as THREE.MeshBasicMaterial;
        material.opacity =
          0.58 + 0.2 * Math.sin(seconds * 0.52 + prominence.userData.phase);
      });
    },
  };
}
