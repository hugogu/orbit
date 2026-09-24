import { textureFileRevisions } from './texture-revisions';

export type TextureQuality = 'auto' | 'standard' | 'ultra';
export const textureQualityLabels: Record<TextureQuality, string> = {
  auto: '自动 · 按设备选择',
  standard: '标准 · 2K',
  ultra: '超清 · 最高 8K',
};
export function isTextureQuality(value: unknown): value is TextureQuality {
  return value === 'auto' || value === 'standard' || value === 'ultra';
}
// Only published higher-resolution maps are listed; no artificial upscaling.
export const highResolutionTextures: Record<
  string,
  { file: string; width: number; standardFile?: string; revision?: string }
> = {
  sun: { file: '8k_sun.jpg', width: 4096 },
  mercury: { file: '8k_mercury.jpg', width: 8192 },
  venus_atmosphere: { file: '4k_venus_atmosphere.jpg', width: 4096 },
  earth_daymap: { file: '8k_earth_daymap.jpg', width: 8192 },
  earth_nightmap: { file: '8k_earth_nightmap.jpg', width: 8192 },
  mars: { file: '8k_mars.jpg', width: 8192 },
  jupiter: { file: '8k_jupiter.jpg', width: 4096 },
  saturn: { file: '8k_saturn.jpg', width: 4096 },
  moon: { file: '8k_moon.jpg', width: 8192 },
  saturn_ring_alpha: { file: '8k_saturn_ring_alpha.png', width: 8192 },
  stars_milky_way: { file: '8k_stars_milky_way.jpg', width: 8192 },
  // Solar System Scope publishes this map under CC BY 4.0. It is a
  // representative atmospheric rendering, not a live weather map.
  uranus: {
    file: '2k_uranus.jpg',
    width: 2048,
    standardFile: '2k_uranus.jpg',
  },
  // No separately licensed global maps are bundled for Pluto or Charon.
  // Reuse the CC BY 4.0 illustrative small-body surface and label it as such.
  pluto: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  // CelestiaContent surface maps. Most originals are 4K; Uranian moon maps
  // are published at 2K and intentionally keep that native resolution. The
  // Voyager maps for Ariel, Miranda, Umbriel, Titania, Oberon and Triton have
  // unmapped regions. Their local files use a mirrored, low-frequency fill so
  // the teaching globe remains continuous instead of showing a flat half.
  // Europa, Callisto, Enceladus, Mimas, Iapetus, and Charon use the CC BY 4.0
  // asteroid surface as an explicitly illustrative fallback because the
  // former bundled sources did not provide clear commercial redistribution
  // terms. The same fallback is used for Pluto below. Io and Titan are
  // published as RGBA PNGs whose alpha is Celestia's specular mask, not
  // opacity; their local JPEGs keep only the colour.
  phobos: {
    file: 'satellites/4k_phobos.jpg',
    width: 4096,
    standardFile: 'satellites/2k_phobos.jpg',
  },
  deimos: {
    file: 'satellites/4k_deimos.jpg',
    width: 4096,
    standardFile: 'satellites/2k_deimos.jpg',
  },
  io: {
    file: 'satellites/4k_io.jpg',
    width: 4096,
    standardFile: 'satellites/2k_io.jpg',
  },
  europa: {
    file: 'satellites/4k_europa.jpg',
    width: 4096,
    standardFile: 'satellites/2k_europa.jpg',
  },
  ganymede: {
    file: 'satellites/4k_ganymede.jpg',
    width: 4096,
    standardFile: 'satellites/2k_ganymede.jpg',
  },
  callisto: {
    file: 'satellites/4k_callisto.jpg',
    width: 4096,
    standardFile: 'satellites/2k_callisto.jpg',
  },
  titan: {
    file: 'satellites/4k_titan.jpg',
    width: 4096,
    standardFile: 'satellites/2k_titan.jpg',
  },
  enceladus: {
    file: 'satellites/4k_enceladus.jpg',
    width: 4096,
    standardFile: 'satellites/2k_enceladus.jpg',
  },
  mimas: {
    file: 'satellites/4k_mimas.jpg',
    width: 4096,
    standardFile: 'satellites/2k_mimas.jpg',
  },
  iapetus: {
    file: 'satellites/4k_iapetus.jpg',
    width: 4096,
    standardFile: 'satellites/2k_iapetus.jpg',
  },
  miranda: {
    file: 'satellites/4k_miranda.jpg',
    width: 4096,
    standardFile: 'satellites/2k_miranda.jpg',
    revision: 'filled-v1',
  },
  ariel: {
    file: 'satellites/4k_ariel.jpg',
    width: 4096,
    standardFile: 'satellites/2k_ariel.jpg',
    revision: 'filled-v1',
  },
  umbriel: {
    file: 'satellites/2k_umbriel.jpg',
    width: 2048,
    standardFile: 'satellites/2k_umbriel.jpg',
    revision: 'filled-v1',
  },
  titania: {
    file: 'satellites/2k_titania.jpg',
    width: 2048,
    standardFile: 'satellites/2k_titania.jpg',
    revision: 'filled-v1',
  },
  oberon: {
    file: 'satellites/2k_oberon.jpg',
    width: 2048,
    standardFile: 'satellites/2k_oberon.jpg',
    revision: 'filled-v1',
  },
  triton: {
    file: 'satellites/4k_triton.jpg',
    width: 4096,
    standardFile: 'satellites/2k_triton.jpg',
    revision: 'filled-v1',
  },
  // Asteroid maps are body-specific Dawn, NEAR, Hayabusa, OSIRIS-REx, and
  // DAMIT products. They are kept separate so a selected asteroid never
  // inherits another body's surface.
  asteroid_ceres: {
    file: 'asteroids/4k_ceres.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_ceres.jpg',
  },
  asteroid_ceres_normal: {
    file: 'asteroids/4k_ceres-normal.png',
    width: 4096,
    standardFile: 'asteroids/2k_ceres-normal.png',
  },
  asteroid_vesta: {
    file: 'asteroids/4k_vesta.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_vesta.jpg',
  },
  asteroid_eros: {
    file: 'asteroids/4k_eros.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_eros.jpg',
  },
  asteroid_itokawa: {
    file: 'asteroids/4k_itokawa.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_itokawa.jpg',
  },
  asteroid_bennu: {
    file: 'asteroids/4k_bennu.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_bennu.jpg',
  },
  asteroid_ryugu: {
    file: 'asteroids/4k_ryugu.jpg',
    width: 4096,
    standardFile: 'asteroids/2k_ryugu.jpg',
  },
  // DAMIT model 1806 stores one relative albedo value for every triangle.
  // The native atlas is intentionally small because it is a data lookup, not
  // a fabricated high-resolution surface image.
  asteroid_psyche: {
    file: 'asteroids/psyche-albedo.png',
    width: 256,
    standardFile: 'asteroids/psyche-albedo.png',
  },
  // Carry et al. (2009) published a partial K-band relative-albedo map for
  // Pallas; the atlas is sampled onto the matching DAMIT model 102 faces.
  asteroid_pallas: {
    file: 'asteroids/pallas-k-albedo.png',
    width: 256,
    standardFile: 'asteroids/pallas-k-albedo.png',
  },
  charon: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  // No complete albedo map is available for Nereid. This openly licensed,
  // pitted small-body surface is clearly labeled as a teaching illustration.
  nereid: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  // Kept for compatibility with old saved asset references; the comet scene
  // now uses neutral per-body materials beside its body-specific meshes.
  comet_nucleus: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  asteroid_surface: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  // These 2K object-space normal maps share the georeferenced height fields.
  // They are opt-in and loaded only for the focused terrestrial
  // planet, so the default scene pays no additional GPU cost.
  surface_mercury_normal: {
    file: 'planets/2k_mercury-normal.png',
    width: 2048,
    standardFile: 'planets/2k_mercury-normal.png',
    revision: 'terrain-v2',
  },
  surface_venus_normal: {
    file: 'planets/2k_venus-normal.png',
    width: 2048,
    standardFile: 'planets/2k_venus-normal.png',
    revision: 'terrain-v2',
  },
  surface_earth_normal: {
    file: 'planets/2k_earth-normal.png',
    width: 2048,
    standardFile: 'planets/2k_earth-normal.png',
    revision: 'terrain-v2',
  },
  surface_mars_normal: {
    file: 'planets/2k_mars-normal.png',
    width: 2048,
    standardFile: 'planets/2k_mars-normal.png',
    revision: 'terrain-v2',
  },
  surface_moon_normal: {
    file: 'planets/2k_moon-normal.png',
    width: 2048,
    standardFile: 'planets/2k_moon-normal.png',
    revision: 'terrain-v1',
  },
  // Packed RG16 heights are decoded once into CPU geometry for the focused
  // terrestrial planet. NoColorSpace preserves data rather than color values.
  terrain_mercury: {
    file: 'planets/2k_mercury-height.png',
    width: 2048,
    standardFile: 'planets/2k_mercury-height.png',
    revision: 'terrain-v2',
  },
  terrain_venus: {
    file: 'planets/2k_venus-height.png',
    width: 2048,
    standardFile: 'planets/2k_venus-height.png',
    revision: 'terrain-v2',
  },
  terrain_earth: {
    file: 'planets/2k_earth-height.png',
    width: 2048,
    standardFile: 'planets/2k_earth-height.png',
    revision: 'terrain-v2',
  },
  terrain_mars: {
    file: 'planets/2k_mars-height.png',
    width: 2048,
    standardFile: 'planets/2k_mars-height.png',
    revision: 'terrain-v2',
  },
  terrain_moon: {
    file: 'planets/2k_moon-height.png',
    width: 2048,
    standardFile: 'planets/2k_moon-height.png',
    revision: 'terrain-v1',
  },
};
export function texturePath(name: string, high: boolean, maxSize: number) {
  const map = highResolutionTextures[name];
  const file =
    high && map && map.width <= maxSize
      ? map.file
      : (map?.standardFile ??
        `2k_${name}.${name === 'saturn_ring_alpha' ? 'png' : 'jpg'}`);
  const revision = [textureFileRevisions[file], map?.revision]
    .filter(Boolean)
    .join('-');
  return `/textures/${file}${revision ? `?v=${revision}` : ''}`;
}
export function shouldLoadHighResolution(
  quality: TextureQuality,
  compact: boolean,
  saveData: boolean,
) {
  return quality === 'ultra' || (quality === 'auto' && !compact && !saveData);
}

const eagerTextureNames = new Set(['earth_daymap', 'sun', 'stars_milky_way']);
const idleTextureNames = new Set(['moon', 'mars']);

/** Keep the startup scene small and load other body maps as they become useful. */
export function textureLoadingOptions(name: string) {
  if (eagerTextureNames.has(name))
    return { lazy: false, preload: false } as const;
  return { lazy: true, preload: idleTextureNames.has(name) } as const;
}
