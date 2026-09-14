import sharp from 'sharp/lib/index.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { Matrix3, Matrix4, Euler, Vector3 } from 'three';
import {
  parseAsteroidModel,
  type AsteroidModelData,
} from '../../lib/asteroid-model';
import type { CatalogEntry } from '../../lib/seo';
import { entryTexturePath } from '../../lib/profile-images';
import { asteroids } from '../../lib/asteroids';

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
  const asteroid = asteroids.find((item) => item.id === id);
  const tint = asteroid
    ? [1, 3, 5].map(
        (at) => parseInt(asteroid.color.slice(at, at + 2), 16) / 255,
      )
    : [1, 1, 1];
  const small =
    comet || ['moon-phobos', 'moon-deimos', 'moon-nereid'].includes(id);
  const radius =
    size *
    (ring
      ? 0.205
      : asteroid
        ? 0.365 / Math.max(...asteroid.axes)
        : small
          ? 0.34
          : 0.365);
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
      const ridge =
        asteroid?.surface === 'top' ? 1 + 0.14 * Math.exp(-Math.abs(y) * 8) : 1;
      const ax = asteroid ? asteroid.axes[0] * ridge : small ? 1.12 : 1,
        ay = asteroid ? asteroid.axes[1] : small ? 0.73 : 1;
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
        color = surface.map((n, channel) => n * shade * tint[channel]);
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
function bodyColorMap(id: string): SurfaceMap {
  const asteroid = asteroids.find((item) => item.id === id);
  const color = asteroid?.color ?? '#ffffff';
  return {
    width: 1,
    height: 1,
    data: new Uint8Array([
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
      255,
    ]),
  };
}

/** Rasterize the same observed model and UVs used in the interactive scene. */
export function renderAsteroidModel(
  map: SurfaceMap,
  model: AsteroidModelData,
  size: number,
  facetAlbedo = false,
) {
  const pixels = Buffer.alloc(size * size * 4);
  const depth = new Float32Array(size * size).fill(-Infinity);
  const rotation = new Matrix3().setFromMatrix4(
    new Matrix4().makeRotationFromEuler(new Euler(0.2, 0.55, -0.13)),
  );
  const positions: Vector3[] = [],
    normals: Vector3[] = [];
  let radius = 0;
  for (let i = 0; i < model.positions.length; i += 3) {
    const p = new Vector3()
      .fromArray(model.positions, i)
      .applyMatrix3(rotation);
    radius = Math.max(radius, p.length());
    positions.push(p);
    normals.push(
      new Vector3().fromArray(model.normals, i).applyMatrix3(rotation),
    );
  }
  const scale = (size * 0.4) / radius;
  for (const p of positions) {
    p.x = size / 2 + p.x * scale;
    p.y = size / 2 - p.y * scale;
  }
  for (let i = 0; i < pixels.length; i += 4) pixels.set([7, 12, 21, 255], i);
  for (let triangle = 0; triangle < model.indices.length; triangle += 3) {
    const ia = model.indices[triangle],
      ib = model.indices[triangle + 1],
      ic = model.indices[triangle + 2];
    const a = positions[ia],
      b = positions[ib],
      c = positions[ic];
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) < 1e-10) continue;
    const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const right = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const bottom = Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const wa =
          ((b.y - c.y) * (x + 0.5 - c.x) + (c.x - b.x) * (y + 0.5 - c.y)) /
          denominator;
        const wb =
          ((c.y - a.y) * (x + 0.5 - c.x) + (a.x - c.x) * (y + 0.5 - c.y)) /
          denominator;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const z = wa * a.z + wb * b.z + wc * c.z,
          index = y * size + x;
        if (z <= depth[index]) continue;
        depth[index] = z;
        const u =
          wa * model.uvs[ia * 2] +
          wb * model.uvs[ib * 2] +
          wc * model.uvs[ic * 2];
        const v =
          wa * model.uvs[ia * 2 + 1] +
          wb * model.uvs[ib * 2 + 1] +
          wc * model.uvs[ic * 2 + 1];
        const n = normals[ia]
          .clone()
          .multiplyScalar(wa)
          .addScaledVector(normals[ib], wb)
          .addScaledVector(normals[ic], wc)
          .normalize();
        const light = Math.max(0, n.x * -0.48 + n.y * 0.32 + n.z * 0.817);
        const shade = 0.08 + 0.92 * Math.pow(light, 0.75);
        // Facet UVs address a single atlas texel, not a continuous surface map.
        const texel =
          (Math.max(
            0,
            Math.min(map.height - 1, Math.floor((1 - v) * map.height)),
          ) *
            map.width +
            Math.max(0, Math.min(map.width - 1, Math.floor(u * map.width)))) *
          4;
        const color = facetAlbedo
          ? [map.data[texel], map.data[texel + 1], map.data[texel + 2]]
          : sampleSurface(
              map,
              u - 0.5 / map.width,
              map.height > 1
                ? ((1 - v) * map.height - 0.5) / (map.height - 1)
                : 0,
            );
        for (let channel = 0; channel < 3; channel++)
          pixels[index * 4 + channel] = Math.round(color[channel] * shade);
      }
  }
  return pixels;
}

export async function renderPortrait(entry: CatalogEntry, size = 1000) {
  const texture = entryTexturePath(entry);
  const map = texture ? await loadMap(texture) : bodyColorMap(entry.data.id);
  if (entry.kind === 'asteroid' && entry.data.shapeModel) {
    const bytes = readFileSync(
      resolve('public/models/asteroids', `${entry.data.shapeModel}.bin`),
    );
    const model = parseAsteroidModel(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    return sharp(
      renderAsteroidModel(
        map,
        model,
        size,
        ['pallas', 'psyche'].includes(entry.data.id),
      ),
      {
        raw: { width: size, height: size, channels: 4 },
      },
    );
  }
  const ring =
    entry.data.id === 'saturn'
      ? await loadMap('/textures/2k_saturn_ring_alpha.png')
      : undefined;
  const samples = ring ? size * 2 : size;
  return sharp(renderSurface(map, entry.data.id, samples, ring), {
    raw: { width: samples, height: samples, channels: 4 },
  }).resize(size, size);
}
