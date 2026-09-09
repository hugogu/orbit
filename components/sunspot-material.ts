import * as THREE from 'three';
import {
  SOLAR_ACTIVITY_SLOTS,
  solarSurfacePoint,
  type solarActivityAt,
} from '../lib/solar-activity';

export function attachSunspotMaterial(material: THREE.MeshBasicMaterial) {
  const uniforms = {
    solarSpotCount: { value: 0 },
    solarSpots: {
      value: Array.from(
        { length: SOLAR_ACTIVITY_SLOTS * 2 },
        () => new THREE.Vector4(),
      ),
    },
  };
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'varying vec3 solarSurface;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nsolarSurface=normalize(position);',
      );
    shader.fragmentShader =
      `
      varying vec3 solarSurface;
      uniform vec4 solarSpots[${SOLAR_ACTIVITY_SLOTS * 2}];
      uniform int solarSpotCount;
      float solarSpotTransmission() {
        vec3 p = normalize(solarSurface);
        float transmission = 1.0;
        for (int i=0; i<${SOLAR_ACTIVITY_SLOTS * 2}; i++) {
          if (i >= solarSpotCount) break;
          vec4 spot = solarSpots[i];
          if (spot.w <= 0.0001 || dot(p,spot.xyz) < 0.98) continue;
          vec3 east = normalize(cross(vec3(0,1,0), spot.xyz));
          vec3 north = cross(spot.xyz,east);
          vec2 spotOffset = vec2(dot(p-spot.xyz,east),dot(p-spot.xyz,north));
          float angle = atan(spotOffset.y, spotOffset.x);
          float irregular = 1.0 + 0.08*sin(angle*9.0+float(i)) + 0.05*sin(angle*17.0);
          float r = length(spotOffset * vec2(0.85,1.0)) / (spot.w * irregular);
          float fibrils = 0.055*sin(angle*43.0+r*9.0);
          float inner = mix(0.075,0.38+fibrils,smoothstep(0.36,0.58,r));
          transmission = min(transmission,mix(inner,1.0,smoothstep(0.76,1.06,r)));
        }
        return transmission;
      }
    ` +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight *= solarSpotTransmission();\n#include <opaque_fragment>',
      );
  };
  material.customProgramCacheKey = () => `${previousKey}:solar-spots-v1`;
  material.needsUpdate = true;
  return {
    uniforms,
    update(regions: ReturnType<typeof solarActivityAt>, enabled: boolean) {
      let count = 0;
      if (enabled)
        for (const region of regions) {
          if (region.spotRadius < 0.0001) continue;
          for (const leading of [true, false]) {
            const offset = leading ? 0 : region.spotRadius * 2.8;
            const p = solarSurfacePoint(
              region.latitude + offset * 0.25,
              region.longitude + offset,
            );
            uniforms.solarSpots.value[count++].set(
              ...p,
              region.spotRadius * (leading ? 1 : 0.58),
            );
          }
        }
      uniforms.solarSpotCount.value = count;
    },
  };
}
