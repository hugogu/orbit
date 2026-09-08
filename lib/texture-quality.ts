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
  { file: string; width: number }
> = {
  sun: { file: '8k_sun.jpg', width: 4096 },
  mercury: { file: '8k_mercury.jpg', width: 8192 },
  venus_atmosphere: { file: '4k_venus_atmosphere.jpg', width: 4096 },
  earth_daymap: { file: '8k_earth_daymap.jpg', width: 8192 },
  mars: { file: '8k_mars.jpg', width: 8192 },
  jupiter: { file: '8k_jupiter.jpg', width: 4096 },
  saturn: { file: '8k_saturn.jpg', width: 4096 },
  moon: { file: '8k_moon.jpg', width: 8192 },
  saturn_ring_alpha: { file: '8k_saturn_ring_alpha.png', width: 8192 },
  stars_milky_way: { file: '8k_stars_milky_way.jpg', width: 8192 },
};
export function texturePath(name: string, high: boolean, maxSize: number) {
  const map = highResolutionTextures[name];
  const file =
    high && map && map.width <= maxSize
      ? map.file
      : `2k_${name}.${name === 'saturn_ring_alpha' ? 'png' : 'jpg'}`;
  return `/textures/${file}`;
}
export function shouldLoadHighResolution(
  quality: TextureQuality,
  compact: boolean,
  saveData: boolean,
) {
  return quality === 'ultra' || (quality === 'auto' && !compact && !saveData);
}
