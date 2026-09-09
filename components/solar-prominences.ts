import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SOLAR_ACTIVITY_SLOTS,
  solarSurfacePoint,
  type solarActivityAt,
} from '../lib/solar-activity';
import { solarNoise } from './solar-noise';

export function createProminences(radius: number) {
  const root = new THREE.Group();
  root.name = 'sun-prominences';
  const activity = new THREE.InstancedBufferAttribute(
    new Float32Array(SOLAR_ACTIVITY_SLOTS * 4),
    4,
  );
  activity.setUsage(THREE.DynamicDrawUsage);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { strength: { value: 1 }, radius: { value: radius } },
    vertexShader: `
      uniform float radius;
      attribute float phase;
      attribute vec4 activity;
      varying vec2 vUv;
      varying float vPhase;
      varying float vHours;
      varying float vLife;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv=uv; vPhase=phase+activity.w; vHours=activity.z; vLife=activity.x;
        float r=length(position);
        vec3 p=normalize(position)*(radius+(r-radius)*activity.y);
        p+=normal*radius*0.0015*sin(uv.x*23.0-vHours*2.0+vPhase)*vLife;
        vec4 view=modelViewMatrix*instanceMatrix*vec4(p,1.0);
        vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
        vView=-view.xyz;
        gl_Position=projectionMatrix*view;
      }
    `,
    fragmentShader: `
      uniform float strength;
      varying vec2 vUv;
      varying float vPhase;
      varying float vHours;
      varying float vLife;
      varying vec3 vNormal;
      varying vec3 vView;
      ${solarNoise}
      void main() {
        if(vLife < 0.001) discard;
        float facing=max(0.0,dot(normalize(vNormal),normalize(vView)));
        float flow=fbm(vec3(vUv.x*18.0-vHours*6.0,vUv.y*3.0,vPhase));
        float taper=smoothstep(0.0,0.06,vUv.x)*(1.0-smoothstep(0.94,1.0,vUv.x));
        float alpha=pow(facing,2.0)*(0.08+flow*flow*1.6)*vLife*taper*strength;
        vec3 colour=mix(vec3(1.0,0.12,0.02),vec3(1.0,0.66,0.18),flow);
        gl_FragColor=vec4(colour,alpha);
      }
    `,
  });
  const meshes: THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >[] = [];
  for (const glow of [true, false]) {
    const geometries = (glow ? [1] : [0, 1, 2]).map((strand) => {
      const phase = strand * 0.83;
      const points = Array.from({ length: 49 }, (_, i) => {
        const u = i / 48,
          arch = Math.sin(Math.PI * u);
        const longitude = (u - 0.5) * 0.28 * (1 + strand * 0.035);
        const elevation = 0.992 + (0.22 - strand * 0.012) * Math.pow(arch, 0.8);
        return new THREE.Vector3(
          Math.sin(longitude) * elevation,
          arch * ((strand - 1.5) * 0.011 + Math.sin(u * 9 + phase) * 0.014),
          Math.cos(longitude) * elevation,
        ).multiplyScalar(radius);
      });
      const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        64,
        radius * (glow ? 0.028 : 0.0035),
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
      return geometry;
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    geometry.setAttribute('activity', activity);
    const plasma = material.clone();
    plasma.uniforms.strength.value = glow ? 0.7 : 1.15;
    const mesh = new THREE.InstancedMesh(
      geometry,
      plasma,
      SOLAR_ACTIVITY_SLOTS,
    );
    mesh.name = glow ? 'sun-prominence-glow' : 'sun-prominence-filaments';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The shader changes arch height; a static geometry bound cannot enclose it reliably.
    mesh.frustumCulled = false;
    root.add(mesh);
    meshes.push(mesh);
  }
  material.dispose();
  const matrix = new THREE.Matrix4(),
    normal = new THREE.Vector3(),
    east = new THREE.Vector3(),
    north = new THREE.Vector3();
  const tangent = new THREE.Vector3(),
    sideways = new THREE.Vector3();
  let lastAge = NaN;
  return {
    root,
    update(regions: ReturnType<typeof solarActivityAt>) {
      if (regions[0].born + regions[0].age === lastAge) return;
      lastAge = regions[0].born + regions[0].age;
      regions.forEach((region, i) => {
        normal.set(...solarSurfacePoint(region.latitude, region.longitude));
        east.set(-Math.sin(region.longitude), 0, -Math.cos(region.longitude));
        north.crossVectors(normal, east).normalize();
        tangent
          .copy(east)
          .multiplyScalar(Math.cos(region.tilt))
          .addScaledVector(north, Math.sin(region.tilt));
        sideways.crossVectors(normal, tangent).normalize();
        matrix.makeBasis(tangent, sideways, normal);
        meshes.forEach((mesh) => mesh.setMatrixAt(i, matrix));
        activity.setXYZW(
          i,
          region.prominence,
          (region.height / 0.22) * Math.sqrt(region.prominence),
          region.age * 24,
          region.phase,
        );
      });
      activity.needsUpdate = true;
      meshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
  };
}
