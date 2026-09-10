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
  { file: string; width: number; standardFile?: string }
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
  // CelestiaContent surface maps. Most originals are 4K; Uranian moon maps
  // are published at 2K and intentionally keep that native resolution.
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
    file: 'satellites/4k_io.png',
    width: 4096,
    standardFile: 'satellites/2k_io.png',
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
    file: 'satellites/4k_titan.png',
    width: 4096,
    standardFile: 'satellites/2k_titan.png',
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
  },
  ariel: {
    file: 'satellites/4k_ariel.jpg',
    width: 4096,
    standardFile: 'satellites/2k_ariel.jpg',
  },
  umbriel: {
    file: 'satellites/2k_umbriel.jpg',
    width: 2048,
    standardFile: 'satellites/2k_umbriel.jpg',
  },
  titania: {
    file: 'satellites/2k_titania.jpg',
    width: 2048,
    standardFile: 'satellites/2k_titania.jpg',
  },
  oberon: {
    file: 'satellites/2k_oberon.jpg',
    width: 2048,
    standardFile: 'satellites/2k_oberon.jpg',
  },
  triton: {
    file: 'satellites/4k_triton.jpg',
    width: 4096,
    standardFile: 'satellites/2k_triton.jpg',
  },
  charon: {
    file: 'satellites/4k_charon.jpg',
    width: 4096,
    standardFile: 'satellites/2k_charon.jpg',
  },
  // No complete albedo map is available for Nereid or comet nuclei. This
  // openly licensed, pitted small-body surface is clearly labeled as a
  // teaching illustration in the UI and metadata.
  nereid: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
  comet_nucleus: {
    file: 'satellites/4k_asteroid.jpg',
    width: 4096,
    standardFile: 'satellites/2k_asteroid.jpg',
  },
};
export function texturePath(name: string, high: boolean, maxSize: number) {
  const map = highResolutionTextures[name];
  const file =
    high && map && map.width <= maxSize
      ? map.file
      : (map?.standardFile ??
        `2k_${name}.${name === 'saturn_ring_alpha' ? 'png' : 'jpg'}`);
  return `/textures/${file}`;
}
export function shouldLoadHighResolution(
  quality: TextureQuality,
  compact: boolean,
  saveData: boolean,
) {
  return quality === 'ultra' || (quality === 'auto' && !compact && !saveData);
}
