import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp/lib/index.js';
import {
  encodeAsteroidModel,
  type AsteroidModelData,
} from '../lib/asteroid-model';
import {
  normalizeDamitVertices,
  outwardDamitFace,
  readDamitShape,
} from './lib/damit-shape';

const atlasColumns = 64;
const atlasCellSize = 4;

function usage(): never {
  throw new Error(
    'Usage: node --import tsx scripts/convert-damit-albedo-model.ts <shape.txt> <albedo> <model.bin> <albedo.png> [base-color]',
  );
}

function parseNumbers(path: string) {
  const values = readFileSync(path, 'utf8').trim().split(/\s+/).map(Number);
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error(`${path} contains a non-numeric value`);
  return values;
}

function parseHexColor(value: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`Invalid base color: ${value}`);
  return [0, 2, 4].map(
    (offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255,
  );
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function buildModel(
  sourceVertices: number[][],
  sourceFaces: number[][],
  albedo: number[],
  baseColor: number[],
) {
  if (sourceFaces.length !== albedo.length)
    throw new Error(
      `Shape has ${sourceFaces.length} faces but albedo has ${albedo.length} values`,
    );
  // DAMIT is Z-north; ORBIT and the CMOD exports are Y-north. This proper
  // rotation preserves winding and the face/albedo correspondence.
  const vertices = normalizeDamitVertices(sourceVertices).map(([x, y, z]) => [
    x,
    z,
    -y,
  ]);
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const albedoMean =
    albedo.reduce((sum, value) => sum + value, 0) / albedo.length;
  if (!Number.isFinite(albedoMean) || albedoMean <= 0)
    throw new Error('DAMIT albedo values have no positive mean');

  const atlasRows = Math.ceil(sourceFaces.length / atlasColumns);
  const atlasWidth = atlasColumns * atlasCellSize;
  const atlasHeight = atlasRows * atlasCellSize;
  const pixels = Buffer.alloc(atlasWidth * atlasHeight * 3);
  const baseLinear = baseColor.map(srgbToLinear);

  for (let faceIndex = 0; faceIndex < sourceFaces.length; faceIndex++) {
    const { face, normal } = outwardDamitFace(
      vertices,
      sourceFaces[faceIndex] as [number, number, number],
    );

    const vertexOffset = positions.length / 3;
    for (const vertexIndex of face) {
      positions.push(...vertices[vertexIndex]);
      normals.push(...normal);
    }
    indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);

    const relative = albedo[faceIndex] / albedoMean;
    const color = baseLinear.map((value) =>
      Math.round(linearToSrgb(value * relative) * 255),
    );
    const cellX = (faceIndex % atlasColumns) * atlasCellSize;
    const cellY = Math.floor(faceIndex / atlasColumns) * atlasCellSize;
    for (let y = cellY; y < cellY + atlasCellSize; y++)
      for (let x = cellX; x < cellX + atlasCellSize; x++) {
        const pixel = (y * atlasWidth + x) * 3;
        pixels[pixel] = color[0];
        pixels[pixel + 1] = color[1];
        pixels[pixel + 2] = color[2];
      }
    const u = (cellX + atlasCellSize / 2) / atlasWidth;
    const v = 1 - (cellY + atlasCellSize / 2) / atlasHeight;
    uvs.push(u, v, u, v, u, v);
  }
  const model: AsteroidModelData = {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
  };
  return { model, pixels, atlasWidth, atlasHeight };
}

async function main() {
  const [shapePath, albedoPath, modelPath, texturePath, color = '#a89b86'] =
    process.argv.slice(2);
  if (!shapePath || !albedoPath || !modelPath || !texturePath) usage();
  const shape = readDamitShape(resolve(shapePath));
  const albedo = parseNumbers(resolve(albedoPath));
  const result = buildModel(
    shape.vertices,
    shape.faces,
    albedo,
    parseHexColor(color),
  );
  mkdirSync(resolve(modelPath, '..'), { recursive: true });
  mkdirSync(resolve(texturePath, '..'), { recursive: true });
  writeFileSync(resolve(modelPath), encodeAsteroidModel(result.model));
  await sharp(result.pixels, {
    raw: { width: result.atlasWidth, height: result.atlasHeight, channels: 3 },
  })
    .png()
    .toFile(resolve(texturePath));
  console.log(
    `DAMIT export: ${shape.vertices.length} source vertices, ${shape.faces.length} faces -> ${resolve(modelPath)} + ${result.atlasWidth}x${result.atlasHeight} ${resolve(texturePath)}`,
  );
}

await main();
