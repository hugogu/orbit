import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { fromFile } from 'geotiff';
import sharp from 'sharp/lib/index.js';
import { bodies } from '../lib/solar';
import { lunarTerrain } from '../lib/moon-orbits';
import {
  terrainNormal,
  type HeightField,
  type TerrainParameters,
} from '../lib/planet-terrain';

type ElevationGrid = {
  data: ArrayLike<number>;
  width: number;
  height: number;
  west: number;
  gridline?: boolean;
  nodata?: number;
  elevationScaleKm?: number;
};
const width = 2048,
  height = 1024;
const wrap = (n: number, size: number) => ((n % size) + size) % size;

export function terrainDerivedTag(
  existing: string | undefined,
  assetId: string,
  kind: 'height' | 'normal',
) {
  return (
    existing ??
    `ORBIT-${assetId}-georeferenced-${kind === 'height' ? 'RG16' : 'object-normal'}-v1`
  );
}

/** Box-average cell data; interpolate when the source resolution is lower. */
export function resampleElevation(
  source: ElevationGrid,
  targetWidth: number,
  targetHeight: number,
) {
  const columns = source.width - (source.gridline ? 1 : 0);
  const rows = source.height - (source.gridline ? 1 : 0);
  const sx = columns / targetWidth,
    sy = rows / targetHeight;
  const output = new Float32Array(targetWidth * targetHeight);
  const valid = (n: number) => Number.isFinite(n) && n !== source.nodata;
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const centerX =
        ((x + 0.5) / targetWidth + (-180 - source.west) / 360) * columns;
      const centerY = ((y + 0.5) / targetHeight) * rows;
      let sum = 0,
        weight = 0;
      if (source.gridline || sx < 1 || sy < 1) {
        // Gridline products include a duplicate antimeridian and both poles.
        const samplesX = Math.max(1, Math.ceil(sx)),
          samplesY = Math.max(1, Math.ceil(sy));
        for (let j = 0; j < samplesY; j++)
          for (let i = 0; i < samplesX; i++) {
            const px =
              centerX +
              ((i + 0.5) / samplesX - 0.5) * sx -
              (source.gridline ? 0 : 0.5);
            const py = Math.max(
              0,
              Math.min(
                source.height - 1,
                centerY +
                  ((j + 0.5) / samplesY - 0.5) * sy -
                  (source.gridline ? 0 : 0.5),
              ),
            );
            const ix = Math.floor(px),
              iy = Math.floor(py);
            for (let dy = 0; dy < 2; dy++)
              for (let dx = 0; dx < 2; dx++) {
                const w =
                  (dx ? px - ix : 1 - px + ix) * (dy ? py - iy : 1 - py + iy);
                const value =
                  source.data[
                    Math.min(source.height - 1, iy + dy) * source.width +
                      wrap(ix + dx, columns)
                  ];
                if (valid(value)) {
                  sum += value * w;
                  weight += w;
                }
              }
          }
      } else {
        const left = centerX - sx / 2,
          right = centerX + sx / 2;
        const top = centerY - sy / 2,
          bottom = centerY + sy / 2;
        for (let iy = Math.floor(top); iy < Math.ceil(bottom); iy++) {
          const wy = Math.max(0, Math.min(bottom, iy + 1) - Math.max(top, iy));
          for (let ix = Math.floor(left); ix < Math.ceil(right); ix++) {
            const w =
              wy * Math.max(0, Math.min(right, ix + 1) - Math.max(left, ix));
            const value =
              source.data[
                Math.min(source.height - 1, Math.max(0, iy)) * source.width +
                  wrap(ix, columns)
              ];
            if (valid(value)) {
              sum += value * w;
              weight += w;
            }
          }
        }
      }
      output[y * targetWidth + x] = weight ? sum / weight : 0;
    }
  }
  return output;
}

async function readDem(path: string): Promise<ElevationGrid> {
  const tiff = await fromFile(path);
  try {
    const image = await tiff.getImage();
    const keys = image.getGeoKeys();
    const origin = image.getOrigin(),
      step = image.getResolution();
    const geographic = keys.GTModelTypeGeoKey === 2;
    if (geographic) {
      if (
        Math.abs(step[0] * image.getWidth() - 360) > 1e-5 ||
        step[1] >= 0
      )
        throw new Error('Geographic DEM must cover 360 degrees with north at the top');
      const data = await image.readRasters({ samples: [0], interleave: true });
      return {
        data: data as ArrayLike<number>,
        width: image.getWidth(),
        height: image.getHeight(),
        west: Math.round(origin[0]),
        nodata: image.getGDALNoData() ?? undefined,
        // LOLA's GeoTIFF metadata reports the range in km, while raster
        // samples are stored in metres.
        elevationScaleKm: 0.001,
      };
    }
    if (
      keys.ProjCoordTransGeoKey !== 17 ||
      keys.ProjCenterLatGeoKey !== 0 ||
      keys.ProjStdParallel1GeoKey !== 0
    )
      throw new Error('Expected a global equatorial equirectangular DEM');
    const radius = keys.GeogSemiMajorAxisGeoKey!;
    const west =
      keys.ProjCenterLongGeoKey! + ((origin[0] / radius) * 180) / Math.PI;
    if (
      Math.abs((step[0] * image.getWidth()) / radius - 2 * Math.PI) > 1e-5 ||
      step[1] >= 0
    )
      throw new Error('DEM must cover 360 degrees with north at the top');
    const data = await image.readRasters({ samples: [0], interleave: true });
    return {
      data: data as ArrayLike<number>,
      width: image.getWidth(),
      height: image.getHeight(),
      west: Math.round(west),
      nodata: image.getGDALNoData() ?? undefined,
    };
  } finally {
    await tiff.close();
  }
}

function signedBigEndian(bytes: Buffer) {
  const values = new Int16Array(bytes.length / 2);
  for (let i = 0; i < values.length; i++) values[i] = bytes.readInt16BE(i * 2);
  return values;
}

async function main() {
  const sourceRoot = process.argv[2];
  if (!sourceRoot)
    throw new Error(
      'Usage: node --import tsx scripts/generate-planet-terrain.ts <source-directory> [body ...]',
    );
  const manifestPath = resolve('public/textures/source-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    filename: string;
    bytes: number;
    url: string;
    derived?: string;
    license?: string;
  }[];
  const requestedBodies = new Set(process.argv.slice(3));
  const terrainBodies = [
    ...bodies.filter((body) => body.heightTexture),
    lunarTerrain,
  ].filter((body) => {
    const assetId = body.id === 'moon-moon' ? 'moon' : body.id;
    return requestedBodies.size === 0 || requestedBodies.has(assetId);
  });
  for (const body of terrainBodies) {
    let source: ElevationGrid;
    if (body.id === 'mercury' || body.id === 'venus' || body.id === 'moon-moon')
      source = await readDem(
        resolve(
          sourceRoot,
          body.id === 'mercury'
            ? 'Mercury_Messenger_USGS_DEM_Global_665m_v2.tif'
            : body.id === 'venus'
              ? 'Venus_Magellan_Topography_Global_4641m_v02.tif'
              : 'LDEM64_PA_pixel_202405.tif',
        ),
      );
    else if (body.id === 'mars')
      source = {
        data: signedBigEndian(
          readFileSync(resolve(sourceRoot, 'megt90n000cb.img')),
        ),
        width: 1440,
        height: 720,
        west: 0,
      };
    else
      source = {
        data: signedBigEndian(
          execFileSync(
            'unzip',
            [
              '-p',
              resolve(sourceRoot, 'ETOPO2v2g_i2_MSB.zip'),
              'ETOPO2v2g_i2_MSB.bin',
            ],
            { maxBuffer: 130 * 1024 * 1024 },
          ),
        ),
        width: 10801,
        height: 5401,
        west: -180,
        gridline: true,
      };
    const elevations = resampleElevation(source, width, height);
    const assetId = body.id === 'moon-moon' ? 'moon' : body.id;
    const params: TerrainParameters = {
      id: body.id,
      radius: body.radius,
      terrainMinKm: body.terrainMinKm!,
      terrainMaxKm: body.terrainMaxKm!,
    };
    const packed = Buffer.alloc(width * height * 3);
    for (let i = 0; i < elevations.length; i++) {
      const value = Math.round(
        Math.max(
          0,
          Math.min(
            1,
            (elevations[i] * (source.elevationScaleKm ?? 0.001) -
              params.terrainMinKm) /
              (params.terrainMaxKm - params.terrainMinKm),
          ),
        ) * 65535,
      );
      packed[i * 3] = value >> 8;
      packed[i * 3 + 1] = value & 255;
    }
    const field: HeightField = { data: packed, width, height, channels: 3 };
    const normals = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const n = terrainNormal(
          field,
          params,
          (x + 0.5) / width,
          1 - (y + 0.5) / height,
        );
        normals[(y * width + x) * 3] = Math.round((n.x + 1) * 127.5);
        normals[(y * width + x) * 3 + 1] = Math.round((n.y + 1) * 127.5);
        normals[(y * width + x) * 3 + 2] = Math.round((n.z + 1) * 127.5);
      }
    const heightEntry = manifest.find(
      (m) => m.filename === `planets/2k_${assetId}-height.png`,
    )!;
    for (const [kind, pixels] of [
      ['height', packed],
      ['normal', normals],
    ] as const) {
      const filename = `planets/2k_${assetId}-${kind}.png`;
      const output = resolve('public/textures', filename);
      await sharp(pixels, { raw: { width, height, channels: 3 } })
        .png({ compressionLevel: 9 })
        .toFile(output);
      const entry = manifest.find((m) => m.filename === filename)!;
      entry.bytes = statSync(output).size;
      entry.url = heightEntry.url;
      entry.license = heightEntry.license;
      entry.derived = terrainDerivedTag(entry.derived, assetId, kind);
    }
    console.log(
      `${body.id}: ${source.width}x${source.height}, western longitude ${source.west} -> georeferenced height + object-space normals`,
    );
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
