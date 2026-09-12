import sharp from 'sharp/lib/index.js';
import { resolve } from 'node:path';
import type { CatalogEntry } from '../../lib/seo';
import { entryTexturePath } from '../../lib/profile-images';

export type SurfaceMap = { data: Uint8Array; width: number; height: number };

/** Bilinear equirectangular sampling, wrapping the longitude seam. */
export function sampleSurface(map: SurfaceMap, u: number, v: number) {
  const x = (((u % 1) + 1) % 1) * map.width;
  const y = Math.max(0, Math.min(map.height - 1, v * (map.height - 1)));
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const dx = x - x0,
    dy = y - y0;
  return [0, 1, 2].map((channel) => {
    const at = (px: number, py: number) =>
      map.data[(py * map.width + (px % map.width)) * 4 + channel];
    return (
      (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) +
      (at(x0, Math.min(y0 + 1, map.height - 1)) * (1 - dx) +
        at(x0 + 1, Math.min(y0 + 1, map.height - 1)) * dx) *
        dy
    );
  });
}

/** Orthographic, textured sphere/ellipsoid rendering in Node: no browser or GPU at build time. */
export function renderSurface(
  map: SurfaceMap,
  id: string,
  size = 1000,
  ring?: SurfaceMap,
) {
  const pixels = Buffer.alloc(size * size * 4);
  const sun = id === 'sun';
  const comet = ['halley', 'encke', '67p', 'hale-bopp'].includes(id);
  const small =
    comet || ['moon-phobos', 'moon-deimos', 'moon-nereid'].includes(id);
  const radius = size * (ring ? 0.205 : small ? 0.34 : 0.365);
  const tilt = ring ? -0.3 : id === 'uranus' ? 1.4 : -0.13;
  const ct = Math.cos(tilt),
    st = Math.sin(tilt);
  const atmosphere = (
    {
      earth: [66, 139, 255],
      venus: [211, 164, 91],
      'moon-titan': [214, 152, 69],
      uranus: [115, 221, 233],
      neptune: [63, 112, 243],
    } as Record<string, number[]>
  )[id];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const sx = (col + 0.5 - size / 2) / radius;
      const sy = (size / 2 - row - 0.5) / radius;
      const x = sx * ct - sy * st,
        y = sx * st + sy * ct;
      const ax = small ? 1.12 : 1,
        ay = small ? 0.73 : 1;
      const q = (x / ax) ** 2 + (y / ay) ** 2;
      const distance = Math.hypot(sx, sy);
      const bg = [7, 12, 21];
      // Fade before the image boundary so compositing never exposes a rectangular patch.
      const fade = Math.max(0, Math.min(1, (1.34 - distance) / 0.25));
      const ambientGlow =
        Math.exp((-distance * distance) / 2) * (sun ? 14 : 4) * fade;
      let color = bg.map(
        (n, i) =>
          n + ambientGlow * (sun ? [1, 0.45, 0.1][i] : [0.25, 0.5, 1][i]),
      );
      const limbBackground = sun
        ? color.map((n, i) => n + [255, 139, 39][i] * 0.84)
        : color;
      let surfaceZ = -Infinity;
      if (q < 1) {
        const z = Math.sqrt(1 - q);
        surfaceZ = z;
        const longitude = Math.atan2(x / ax, z);
        const u =
          0.5 + longitude / (2 * Math.PI) + (id === 'earth' ? 0.02 : 0.08);
        const v = 0.5 - Math.asin(y / ay) / Math.PI;
        const surface = sampleSurface(map, u, v);
        const norm = Math.hypot(x / (ax * ax), y / (ay * ay), z);
        const light = Math.max(
          0,
          ((x / (ax * ax)) * -0.48 + (y / (ay * ay)) * 0.32 + z * 0.817) / norm,
        );
        const shade = sun
          ? 0.68 + 0.32 * z
          : 0.08 + 0.92 * Math.pow(light, 0.75);
        color = surface.map((n) => n * shade);
        if (atmosphere) {
          const rim = Math.pow(1 - z, 3) * Math.max(0.05, light) * 0.65;
          color = color.map((n, i) => n * (1 - rim) + atmosphere[i] * rim);
        }
        const edge = Math.min(1, (1 - q) * radius);
        color = color.map((n, i) => limbBackground[i] * (1 - edge) + n * edge);
      } else if (sun) {
        const glow =
          Math.exp(-(distance - 1) * 20) * 0.7 +
          Math.exp(-(distance - 1) * 5) * 0.14;
        color = color.map((n, i) => n + [255, 139, 39][i] * glow * fade);
      } else if (atmosphere) {
        const glow = Math.exp(-(distance - 1) * 85) * 0.2;
        color = color.map((n, i) => n + atmosphere[i] * glow);
      }
      if (ring) {
        // Intersect the camera ray with the inclined ring plane and depth-test against the globe.
        const ry = y / 0.39;
        const r = Math.hypot(x, ry);
        const ringZ = -ry * Math.sqrt(1 - 0.39 ** 2);
        if (r > 1.24 && r < 2.28 && ringZ > surfaceZ) {
          const u = (r - 1.24) / (2.28 - 1.24);
          const index =
            Math.min(ring.width - 1, Math.floor(u * ring.width)) * 4;
          const alpha = ring.data[index + 3] / 255;
          // A ring point is in shadow only when its ray toward the light hits the sphere.
          const lightDot = x * -0.48 + y * 0.32 + ringZ * 0.817;
          const shadow =
            lightDot < 0 && lightDot ** 2 > x * x + y * y + ringZ * ringZ - 1
              ? 0.18
              : 0.91;
          color = color.map(
            (n, i) => n * (1 - alpha) + ring.data[index + i] * alpha * shadow,
          );
        }
      }
      const index = (row * size + col) * 4;
      for (let c = 0; c < 3; c++)
        pixels[index + c] = Math.max(0, Math.min(255, color[c]));
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

async function loadMap(path: string): Promise<SurfaceMap> {
  const { data, info } = await sharp(
    resolve('public', path.split('?')[0].replace(/^\//, '')),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
export async function renderPortrait(entry: CatalogEntry, size = 1000) {
  const map = await loadMap(entryTexturePath(entry));
  const ring =
    entry.data.id === 'saturn'
      ? await loadMap('/textures/2k_saturn_ring_alpha.png')
      : undefined;
  const samples = ring ? size * 2 : size;
  return sharp(renderSurface(map, entry.data.id, samples, ring), {
    raw: { width: samples, height: samples, channels: 4 },
  }).resize(size, size);
}
