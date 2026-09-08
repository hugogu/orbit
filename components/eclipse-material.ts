import * as THREE from 'three';
import { SUN_RADIUS_KM, type ShadowBody } from '../lib/eclipse-shadows';

export const MAX_CASTERS = 6;
export const eclipseFragment = /* glsl */ `
uniform vec3 eclipseSun;
uniform float eclipseSunRadius;
uniform vec4 eclipseCasters[6];
uniform int eclipseCount;
varying vec3 eclipseSurface;
float eclipseCover(float a, float b, float angle) {
  if (angle >= a+b) return 0.0;
  if (angle <= abs(a-b)) return min(1.0, b*b/(a*a));
  float r=b/a, d=angle/a;
  float x=acos(clamp((d*d+1.0-r*r)/(2.0*d), -1.0, 1.0));
  float y=acos(clamp((d*d+r*r-1.0)/(2.0*d*r), -1.0, 1.0));
  float lens=sqrt(max(0.0,(-d+1.0+r)*(d+1.0-r)*(d-1.0+r)*(d+1.0+r)));
  return clamp((x+r*r*y-0.5*lens)/3.14159265359, 0.0, 1.0);
}
float eclipseVisibility() {
  vec3 p=normalize(eclipseSurface);
  vec3 s=eclipseSun-p;
  float sd=length(s), cover=0.0;
  float a=asin(clamp(eclipseSunRadius/sd,0.0,1.0));
  for(int i=0;i<6;i++) {
    if(i>=eclipseCount) break;
    vec3 o=eclipseCasters[i].xyz-p;
    float od=length(o), r=eclipseCasters[i].w;
    if(od<=r || od>=sd || dot(s,o)<=0.0) continue;
    float angle=atan(length(cross(s/sd,o/od)),dot(s/sd,o/od));
    float b=asin(clamp(r/od,0.0,1.0));
    cover=max(cover,eclipseCover(a,b,angle));
  }
  return 1.0-cover;
}
`;

export function attachEclipseMaterial(material: THREE.MeshStandardMaterial) {
  const uniforms = {
    eclipseSun: { value: new THREE.Vector3(1e5, 0, 0) },
    eclipseSunRadius: { value: 1 },
    eclipseCasters: {
      value: Array.from({ length: MAX_CASTERS }, () => new THREE.Vector4()),
    },
    eclipseCount: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'varying vec3 eclipseSurface;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\neclipseSurface=position;',
      );
    shader.fragmentShader =
      eclipseFragment +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
      float visibility=eclipseVisibility();
      // Retain a small neutral floor for readability; atmospheric refraction is omitted.
      outgoingLight *= mix(0.035,1.0,visibility);
      #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'orbit-finite-sun-shadows-v1';
  material.needsUpdate = true;
  return {
    uniforms,
    update(
      receiver: ShadowBody,
      sun: THREE.Vector3,
      casters: ShadowBody[],
      inverseRotation: THREE.Quaternion,
      enabled: boolean,
    ) {
      uniforms.eclipseSun.value
        .copy(sun)
        .sub(receiver.position)
        .applyQuaternion(inverseRotation)
        .divideScalar(receiver.radius);
      uniforms.eclipseSunRadius.value = SUN_RADIUS_KM / receiver.radius;
      uniforms.eclipseCount.value = enabled
        ? Math.min(casters.length, MAX_CASTERS)
        : 0;
      for (let i = 0; i < uniforms.eclipseCount.value; i++) {
        const caster = casters[i];
        const local = caster.position
          .clone()
          .sub(receiver.position)
          .applyQuaternion(inverseRotation)
          .divideScalar(receiver.radius);
        uniforms.eclipseCasters.value[i].set(
          local.x,
          local.y,
          local.z,
          caster.radius / receiver.radius,
        );
      }
    },
  };
}
