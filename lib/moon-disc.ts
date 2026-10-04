/** Orthographic near-side projection of the existing equirectangular Moon map.
 * North stays up; libration and the observer's parallactic rotation are omitted.
 */
export function projectMoonTexture(
  texture: { width: number; height: number; data: Uint8ClampedArray },
  size: number,
) {
  const albedo = new Float32Array(size * size * 3);
  const normals = new Float32Array(size * size * 3);
  const coverage = new Float32Array(size * size);
  const radius = size / 2;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = (col + 0.5 - radius) / radius;
      const y = (radius - row - 0.5) / radius;
      const distance = Math.hypot(x, y);
      const pixel = row * size + col;
      coverage[pixel] = Math.max(0, Math.min(1, (1 - distance) * radius + 0.5));
      if (!coverage[pixel]) continue;
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      normals.set([x, y, z], pixel * 3);
      const u = 0.5 + Math.atan2(x, z) / (2 * Math.PI);
      const v = Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI;
      const tx = Math.min(texture.width - 1, Math.floor(u * texture.width));
      const ty = Math.min(texture.height - 1, Math.floor(v * texture.height));
      for (let channel = 0; channel < 3; channel++) {
        const srgb =
          texture.data[(ty * texture.width + tx) * 4 + channel] / 255;
        albedo[pixel * 3 + channel] =
          srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      }
    }
  }
  return { size, albedo, normals, coverage };
}

/** Sun–Moon–Earth angle: 0 at full Moon, 180 at new Moon. */
export function moonLightDirection(phaseAngle: number, waxing: boolean) {
  const angle = (phaseAngle * Math.PI) / 180;
  return [Math.sin(angle) * (waxing ? 1 : -1), 0, Math.cos(angle)];
}

export function shadeMoonDisc(
  projection: ReturnType<typeof projectMoonTexture>,
  phaseAngle: number,
  waxing: boolean,
) {
  const { size, albedo, normals, coverage } = projection;
  const [sx, , sz] = moonLightDirection(phaseAngle, waxing);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < coverage.length; pixel++) {
    if (!coverage[pixel]) continue;
    const sunlight = Math.max(
      0,
      normals[pixel * 3] * sx + normals[pixel * 3 + 2] * sz,
    );
    // A small illustrative earthshine floor keeps the unlit limb legible.
    const light = 0.006 + 0.994 * sunlight;
    for (let channel = 0; channel < 3; channel++) {
      const linear = albedo[pixel * 3 + channel] * light;
      const srgb =
        linear <= 0.0031308
          ? linear * 12.92
          : 1.055 * linear ** (1 / 2.4) - 0.055;
      pixels[pixel * 4 + channel] = srgb * 255;
    }
    pixels[pixel * 4 + 3] = coverage[pixel] * 255;
  }
  return pixels;
}
