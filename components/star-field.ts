import * as THREE from 'three';
import type { Translate } from '@/lib/i18n';
import { sceneDirection } from '@/lib/ephemeris';
import { constellationNames } from '@/lib/constellations';
import {
  figureAnchor,
  panoramaOrientation,
  parseConstellationFigures,
  parseStarCatalog,
  starBrightness,
  starColor,
  starPointSize,
  type Constellation,
  type StarCatalog,
} from '@/lib/star-catalog';
import { createSceneLabel } from './scene-label';
import {
  projectSkyPoint,
  STEREOGRAPHIC_SKY_PROJECTION,
} from './sky-projection';

/**
 * The sky is drawn on a sphere re-centred on the camera at draw time, so every
 * star sits at infinity no matter where in the solar system the view travels:
 * turning the camera turns the sky, moving it does not. The radius only has to
 * stay well inside the far plane; a wide one keeps any residual offset far
 * below a pixel. Nothing here writes depth: the panorama, then the stars and
 * their figures, are painted before the rest of the scene and covered by
 * whatever the solar system draws in front of them.
 */
const SKY_RADIUS = 4000;
/** Screen-up while the view orbits, which is the scene's own up axis. */
const SKY_UP = new THREE.Vector3(0, 1, 0);
const PANORAMA_INTENSITY = 0.35;
const PANORAMA_ORDER = -2;
const STAR_ORDER = -1;
export const starDataPath = '/sky/bright-stars.bin';
export const constellationDataPath = '/sky/constellations.json';
export const starLoadFailureNotice = '真实星空数据加载失败，可刷新重试。';

const properMotionVertexChunk = /* glsl */ `
attribute vec3 motion;
uniform float years;
uniform float radius;
vec4 skyPosition() {
  return modelViewMatrix *
    vec4(normalize(position + motion * years) * radius, 1.0);
}
`;

const starVertexShader = /* glsl */ `
${properMotionVertexChunk}
${STEREOGRAPHIC_SKY_PROJECTION}
attribute float size;
attribute float brightness;
attribute vec3 tint;
uniform float pixelRatio;
varying vec3 starTint;
varying float starBrightness;
void main() {
  gl_Position = skyClipPosition(skyPosition());
  gl_PointSize = size * pixelRatio;
  starTint = tint;
  starBrightness = brightness;
}
`;

const starFragmentShader = /* glsl */ `
uniform float opacity;
varying vec3 starTint;
varying float starBrightness;
void main() {
  // A soft disc keeps a bright star from reading as a square of pixels.
  // GLSL leaves smoothstep undefined unless its first edge is the lower
  // one, so the ramp is built the right way round and inverted.
  float falloff =
    1.0 - smoothstep(0.08, 0.5, length(gl_PointCoord - vec2(0.5)));
  if (falloff <= 0.0) discard;
  // Premultiplied: the disc and the opacity are folded into the colour, so
  // the result never depends on whether the blend factor reads alpha.
  gl_FragColor = vec4(starTint * starBrightness * opacity * falloff, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const figureVertexShader = /* glsl */ `
${properMotionVertexChunk}
${STEREOGRAPHIC_SKY_PROJECTION}
void main() {
  gl_Position = skyClipPosition(skyPosition());
}
`;

const figureFragmentShader = /* glsl */ `
uniform vec3 tint;
uniform float opacity;
void main() {
  // Premultiplied, as for the stars: writing the opacity into alpha as well
  // applied it twice, because the additive blend factor is the source alpha.
  gl_FragColor = vec4(tint * opacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type SkyOptions = {
  stars: boolean;
  figures: boolean;
  galaxy: boolean;
  /** Years since J2000, so proper motion matches the simulated date. */
  years: number;
};

type Figure = {
  id: string;
  anchor: THREE.Vector3;
  label: HTMLSpanElement;
  place: ReturnType<typeof createSceneLabel>;
};

/**
 * Pin an object to the camera the way the renderer pins its own background.
 * Doing it here rather than in the frame loop keeps the sky exactly centred
 * however late the camera moves — orbit damping updates it after everything
 * else, and a lagging centre swings the whole sky as the view is dragged.
 */
function followCamera(
  object: THREE.Object3D,
  onBeforeDraw?: (camera: THREE.Camera) => void,
) {
  object.onBeforeRender = (_renderer, _scene, camera) => {
    object.matrixWorld.copyPosition(camera.matrixWorld);
    onBeforeDraw?.(camera);
  };
}

/** Stars and figures arrive in EQJ and are rotated once into scene axes. */
function toSceneAxes(source: Float32Array) {
  const values = new Float32Array(source.length);
  for (let index = 0; index < source.length; index += 3) {
    const [x, y, z] = sceneDirection(
      source[index],
      source[index + 1],
      source[index + 2],
    );
    values[index] = x;
    values[index + 1] = y;
    values[index + 2] = z;
  }
  return values;
}

function starAttributes(catalog: StarCatalog) {
  const count = catalog.magnitudes.length;
  const sizes = new Float32Array(count),
    brightness = new Float32Array(count),
    tints = new Float32Array(count * 3),
    color = new THREE.Color();
  for (let index = 0; index < count; index++) {
    sizes[index] = starPointSize(catalog.magnitudes[index]);
    brightness[index] = starBrightness(catalog.magnitudes[index]);
    color.setRGB(
      ...starColor(catalog.colorIndices[index]),
      THREE.SRGBColorSpace,
    );
    tints[index * 3] = color.r;
    tints[index * 3 + 1] = color.g;
    tints[index * 3 + 2] = color.b;
  }
  return { sizes, brightness, tints };
}

export function createStarField(
  scene: THREE.Scene,
  labelLayer: HTMLElement,
  onStatus: (message: string) => void,
) {
  const group = new THREE.Group();
  scene.add(group);
  const panoramaMaterial = new THREE.MeshBasicMaterial({
    // Matches the intensity the renderer's own background path applied, and
    // like that path leaves an already-graded photograph untone-mapped.
    color: new THREE.Color().setScalar(PANORAMA_INTENSITY),
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const panoramaProjection = { value: 0 };
  panoramaMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.skyStereographic = panoramaProjection;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${STEREOGRAPHIC_SKY_PROJECTION}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\ngl_Position = skyClipPosition(mvPosition);',
    );
  };
  panoramaMaterial.customProgramCacheKey = () =>
    'panorama-stereographic-ground-sky';
  const panorama = new THREE.Mesh(
    // Dense enough that interpolating the sphere's own equirectangular
    // coordinates stays well inside one pixel of the 8K map.
    new THREE.SphereGeometry(SKY_RADIUS, 192, 96),
    panoramaMaterial,
  );
  panorama.quaternion.copy(panoramaOrientation());
  panorama.renderOrder = PANORAMA_ORDER;
  panorama.frustumCulled = false;
  followCamera(panorama, (camera) => {
    panoramaProjection.value =
      camera.userData.skyProjection === 'stereographic' ? 1 : 0;
  });
  panorama.visible = false;
  group.add(panorama);

  let stars: THREE.Points | null = null,
    figureLines: THREE.LineSegments | null = null,
    starMaterial: THREE.ShaderMaterial | null = null,
    figureMaterial: THREE.ShaderMaterial | null = null;
  const figures: Figure[] = [];
  // The figures are built after a fetch, so they miss the locale pass that
  // renames everything else. Keep the current translator and name them as
  // they are created, rather than leaving keys on screen until the reader
  // happens to switch language.
  let translate: Translate = (key) => key;
  let loading: Promise<void> | null = null,
    failed = false,
    disposed = false;
  const projected = new THREE.Vector3(),
    viewpoint = new THREE.Vector3();

  async function load() {
    const [catalogResponse, figureResponse] = await Promise.all([
      fetch(starDataPath),
      fetch(constellationDataPath),
    ]);
    if (!catalogResponse.ok || !figureResponse.ok)
      throw new Error('sky data unavailable');
    const catalog = parseStarCatalog(await catalogResponse.arrayBuffer());
    const { constellations } = parseConstellationFigures(
      await figureResponse.json(),
      catalog.magnitudes.length,
    );
    if (disposed) return;
    build(catalog, constellations);
  }

  function build(catalog: StarCatalog, constellations: Constellation[]) {
    const positions = toSceneAxes(catalog.positions),
      motions = toSceneAxes(catalog.motions),
      { sizes, brightness, tints } = starAttributes(catalog);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('motion', new THREE.BufferAttribute(motions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      'brightness',
      new THREE.BufferAttribute(brightness, 1),
    );
    geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
    starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        years: { value: 0 },
        radius: { value: SKY_RADIUS },
        skyStereographic: { value: 0 },
        pixelRatio: { value: 1 },
        opacity: { value: 1 },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      blending: THREE.AdditiveBlending,
      // Additive blending still applies to an opaque material, which keeps
      // the sky in the opaque pass where its render order is honoured.
      transparent: false,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    stars = new THREE.Points(geometry, starMaterial);
    stars.renderOrder = STAR_ORDER;
    stars.frustumCulled = false;
    followCamera(stars, (camera) => {
      starMaterial!.uniforms.skyStereographic.value =
        camera.userData.skyProjection === 'stereographic' ? 1 : 0;
    });
    stars.visible = false;
    group.add(stars);

    const indices: number[] = [];
    for (const constellation of constellations) {
      indices.push(...constellation.lines);
      const label = document.createElement('span');
      label.className = 'constellation-label';
      label.textContent = translate(constellationNames[constellation.id]);
      label.style.display = 'none';
      labelLayer.appendChild(label);
      figures.push({
        id: constellation.id,
        anchor: figureAnchor(positions, constellation.lines, SKY_UP),
        label,
        place: createSceneLabel(label, -50),
      });
    }
    const figureGeometry = new THREE.BufferGeometry();
    figureGeometry.setAttribute('position', geometry.getAttribute('position'));
    figureGeometry.setAttribute('motion', geometry.getAttribute('motion'));
    figureGeometry.setIndex(indices);
    figureMaterial = new THREE.ShaderMaterial({
      uniforms: {
        years: { value: 0 },
        radius: { value: SKY_RADIUS },
        skyStereographic: { value: 0 },
        // Clear enough to read as a figure, and still lighter than the
        // orbit guides, which are wider and carry their own colour.
        tint: { value: new THREE.Color(0x6a89bd) },
        opacity: { value: 0.5 },
      },
      vertexShader: figureVertexShader,
      fragmentShader: figureFragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    figureLines = new THREE.LineSegments(figureGeometry, figureMaterial);
    figureLines.renderOrder = STAR_ORDER;
    figureLines.frustumCulled = false;
    followCamera(figureLines, (camera) => {
      figureMaterial!.uniforms.skyStereographic.value =
        camera.userData.skyProjection === 'stereographic' ? 1 : 0;
    });
    figureLines.visible = false;
    group.add(figureLines);
  }

  return {
    /** The panorama keeps its own toggle and its own texture slot. */
    setPanorama(texture: THREE.Texture | null) {
      panoramaMaterial.map = texture;
      panoramaMaterial.needsUpdate = true;
    },
    localize(next: Translate) {
      translate = next;
      for (const figure of figures)
        figure.label.textContent = translate(constellationNames[figure.id]);
    },
    update(pixelRatio: number, options: SkyOptions) {
      const wanted = options.stars || options.figures;
      if (wanted && !loading && !failed) {
        loading = load().catch(() => {
          failed = true;
          onStatus(starLoadFailureNotice);
        });
      }
      panorama.visible = options.galaxy && !!panoramaMaterial.map;
      if (stars && starMaterial) {
        stars.visible = options.stars;
        starMaterial.uniforms.years.value = options.years;
        starMaterial.uniforms.pixelRatio.value = pixelRatio;
      }
      if (figureLines && figureMaterial) {
        figureLines.visible = options.figures;
        figureMaterial.uniforms.years.value = options.years;
      }
    },
    project(
      camera: THREE.Camera,
      width: number,
      height: number,
      enabled: boolean,
      horizonUp?: THREE.Vector3,
    ) {
      if (figures.length === 0) return;
      camera.getWorldPosition(viewpoint);
      for (const figure of figures) {
        projected.copy(figure.anchor).multiplyScalar(SKY_RADIUS).add(viewpoint);
        projectSkyPoint(projected, camera);
        figure.place(
          projected,
          width,
          height,
          enabled && (!horizonUp || figure.anchor.dot(horizonUp) > 0),
        );
      }
    },
    dispose() {
      disposed = true;
      for (const figure of figures) figure.label.remove();
      figures.length = 0;
      stars?.geometry.dispose();
      figureLines?.geometry.dispose();
      panorama.geometry.dispose();
      starMaterial?.dispose();
      figureMaterial?.dispose();
      panoramaMaterial.dispose();
      group.removeFromParent();
    },
  };
}
