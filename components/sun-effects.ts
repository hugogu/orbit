import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const noise = `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.17, 0.31, 0.53));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    return 0.57 * noise(p) + 0.28 * noise(p * 2.03) + 0.15 * noise(p * 4.07);
  }
`;

// UVs are measured in solar radii; the emission ends before the quad's edges.
const coronaExtent = 2.6;
function createCorona(radius: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vPoint;
      void main() {
        vPoint = (uv - 0.5) * ${2 * coronaExtent};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPoint;
      uniform float time;
      ${noise}
      void main() {
        float r = length(vPoint);
        if (r > 2.5) discard;
        float h = max(0.0, r - 1.0);
        vec2 direction = vPoint / max(r, 0.001);
        float t = time * 0.035;
        float warp = fbm(vec3(direction * 6.0, h * 1.8 - t));
        float wisps = fbm(vec3(direction * 32.0 + warp * 2.0, h * 3.0 - t));
        float streamers = pow(fbm(vec3(direction * 7.0, t * 0.4)), 2.0);
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

function createProminences(radius: number) {
  const filamentGeometries: THREE.BufferGeometry[] = [];
  const glowGeometries: THREE.BufferGeometry[] = [];
  const regions = [
    [0.28, 0.15, 0.16, 0.24],
    [1.22, -0.22, 0.11, 0.16],
    [2.17, 0.38, 0.22, 0.31],
    [3.05, -0.3, 0.13, 0.18],
    [3.92, 0.15, 0.2, 0.27],
    [4.85, -0.45, 0.12, 0.2],
    [5.67, 0.28, 0.17, 0.23],
  ];
  regions.forEach(([angle, depth, span, height], index) => {
    const normal = new THREE.Vector3(
      Math.cos(angle),
      Math.sin(angle),
      depth,
    ).normalize();
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
    const sideways = new THREE.Vector3().crossVectors(normal, tangent);
    for (let strand = 0; strand < 4; strand++) {
      const filament = strand === 3 ? 1 : strand;
      const phase = index * 1.71 + filament * 0.83;
      const points = Array.from({ length: 49 }, (_, i) => {
        const u = i / 48;
        const arch = Math.sin(Math.PI * u);
        const longitude = (u - 0.5) * span * (1 + filament * 0.035);
        const elevation =
          0.992 + (height - filament * 0.018) * Math.pow(arch, 0.8);
        return normal
          .clone()
          .multiplyScalar(Math.cos(longitude))
          .addScaledVector(tangent, Math.sin(longitude))
          .multiplyScalar(radius * elevation)
          .addScaledVector(sideways, radius * arch * (filament - 1.5) * 0.011)
          .addScaledVector(
            sideways,
            radius * arch * Math.sin(u * 9 + phase) * 0.014,
          );
      });
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(
        curve,
        64,
        radius * (strand === 3 ? 0.028 : 0.0035),
        8,
        false,
      );
      geometry.setAttribute(
        'phase',
        new THREE.Float32BufferAttribute(
          Array(geometry.attributes.position.count).fill(phase),
          1,
        ),
      );
      (strand === 3 ? glowGeometries : filamentGeometries).push(geometry);
    }
  });
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      time: { value: 0 },
      strength: { value: 1 },
      radius: { value: radius },
    },
    vertexShader: `
      uniform float time;
      uniform float radius;
      attribute float phase;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vPhase = phase;
        vec3 p = position + normal * radius * 0.0015 * sin(uv.x * 23.0 - time * 0.6 + phase);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float strength;
      varying vec2 vUv;
      varying float vPhase;
      varying vec3 vNormal;
      varying vec3 vView;
      ${noise}
      void main() {
        float facing = max(0.0, dot(normalize(vNormal), normalize(vView)));
        float flow = fbm(vec3(vUv.x * 18.0 - time * 0.22, vUv.y * 3.0, vPhase));
        float lifetime = 0.65 + 0.35 * sin(time * 0.18 + vPhase);
        float taper = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
        float alpha = pow(facing, 2.0) * (0.08 + flow * flow * 1.6) * lifetime * taper * strength;
        vec3 colour = mix(vec3(1.0, 0.12, 0.02), vec3(1.0, 0.66, 0.18), flow);
        gl_FragColor = vec4(colour, alpha);
      }
    `,
  });
  const group = new THREE.Group();
  group.name = 'sun-prominences';
  for (const [geometries, strength, name] of [
    [glowGeometries, 0.7, 'sun-prominence-glow'],
    [filamentGeometries, 1.15, 'sun-prominence-filaments'],
  ] as const) {
    const merged = mergeGeometries([...geometries]);
    geometries.forEach((geometry) => geometry.dispose());
    const plasma = material.clone();
    plasma.uniforms.strength.value = strength;
    const mesh = new THREE.Mesh(merged, plasma);
    mesh.name = name;
    group.add(mesh);
  }
  material.dispose();
  return group;
}

export function createSunEffects(radius: number) {
  const root = new THREE.Group();
  root.name = 'sun-effects';
  const corona = createCorona(radius);
  const prominences = createProminences(radius);
  root.add(corona, prominences);
  const worldPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const worldScale = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const facing = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 0, 1);

  return {
    root,
    update(
      seconds: number,
      camera: THREE.Camera,
      orientation: THREE.Quaternion,
    ) {
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
      corona.material.uniforms.time.value = seconds;
      prominences.quaternion.copy(orientation);
      for (const child of prominences.children) {
        const material = (
          child as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
        ).material;
        material.uniforms.time.value = seconds;
      }
    },
  };
}
