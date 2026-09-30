import * as THREE from 'three';
import { SUN_RADIUS_KM, type ShadowBody } from '../lib/eclipse-shadows';

export const MAX_CASTERS = 6;
export const eclipseFragment = /* glsl */ `
uniform vec3 eclipseSun;
uniform float eclipseSunRadius;
uniform vec4 eclipseCasters[6];
uniform int eclipseCount;
uniform int eclipseEarthIndex;
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
vec3 eclipseTransmission() {
  vec3 p=normalize(eclipseSurface);
  vec3 s=eclipseSun-p;
  float sd=length(s), cover=0.0;
  vec3 refracted=vec3(0.0);
  float a=asin(clamp(eclipseSunRadius/sd,0.0,1.0));
  for(int i=0;i<6;i++) {
    if(i>=eclipseCount) break;
    vec3 o=eclipseCasters[i].xyz-p;
    float od=length(o), r=eclipseCasters[i].w;
    if(od<=r || od>=sd || dot(s,o)<=0.0) continue;
    float angle=atan(length(cross(s/sd,o/od)),dot(s/sd,o/od));
    float b=asin(clamp(r/od,0.0,1.0));
    float covered=eclipseCover(a,b,angle);
    cover=max(cover,covered);
    if(i==eclipseEarthIndex) {
      // Distance inside the umbra in solar angular diameters. This remains
      // tied to the physical shadow, even when the displayed Moon is enlarged.
      float depth=clamp((b-a-angle)/(2.0*a),0.0,1.0);
      // Schematic clear-atmosphere refraction: copper at the edge, darker red
      // inside. Clouds/aerosols make the real brightness unpredictable.
      vec3 copper=mix(vec3(0.16,0.045,0.012),vec3(0.045,0.006,0.002),depth);
      refracted=copper*smoothstep(0.9,1.0,covered);
    }
  }
  if(eclipseEarthIndex>=0) return vec3(1.0-cover)+refracted;
  return vec3(mix(0.035,1.0,1.0-cover));
}
`;

export function attachEclipseMaterial(
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial,
  night = false,
) {
  const uniforms = {
    earthNightMap: { value: null as THREE.Texture | null },
    earthNightReady: { value: 0 },
    eclipseSun: { value: new THREE.Vector3(1e5, 0, 0) },
    eclipseSunRadius: { value: 1 },
    eclipseCasters: {
      value: Array.from({ length: MAX_CASTERS }, () => new THREE.Vector4()),
    },
    eclipseCount: { value: 0 },
    eclipseEarthIndex: { value: -1 },
  };
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      (night ? 'varying vec2 earthNightUv;\n' : '') +
      'varying vec3 eclipseSurface;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\neclipseSurface=position;' +
          (night ? '\nearthNightUv=uv;' : ''),
      );
    shader.fragmentShader =
      (night
        ? 'uniform sampler2D earthNightMap; uniform float earthNightReady; varying vec2 earthNightUv;\n'
        : '') +
      eclipseFragment +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
      outgoingLight *= eclipseTransmission();
      ${
        night
          ? `
      float solarAltitude=dot(normalize(eclipseSurface),normalize(eclipseSun-normalize(eclipseSurface)));
      float nightBlend=1.0-smoothstep(-0.12,0.08,solarAltitude);
      outgoingLight += texture2D(earthNightMap,earthNightUv).rgb * nightBlend * earthNightReady * 1.5;
      `
          : ''
      }
      #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey}-orbit-finite-sun-shadows-v3-${night}`;
  material.needsUpdate = true;
  return {
    uniforms,
    update(
      receiver: ShadowBody,
      sun: THREE.Vector3,
      casters: ShadowBody[],
      inverseRotation: THREE.Quaternion,
      enabled: boolean,
      sunRadius = SUN_RADIUS_KM,
    ) {
      uniforms.eclipseSun.value
        .copy(sun)
        .sub(receiver.position)
        .applyQuaternion(inverseRotation)
        .divideScalar(receiver.radius);
      uniforms.eclipseSunRadius.value = sunRadius / receiver.radius;
      uniforms.eclipseCount.value = enabled
        ? Math.min(casters.length, MAX_CASTERS)
        : 0;
      uniforms.eclipseEarthIndex.value =
        enabled && receiver.id === 'moon-moon'
          ? casters
              .slice(0, MAX_CASTERS)
              .findIndex((caster) => caster.id === 'earth')
          : -1;
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
