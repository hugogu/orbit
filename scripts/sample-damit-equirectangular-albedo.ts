import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import sharp from 'sharp/lib/index.js';
import { readDamitShape } from './lib/damit-shape';

type GrayMap = {
  data: Buffer;
  width: number;
  height: number;
};

function usage(): never {
  throw new Error(
    'Usage: node --import tsx scripts/sample-damit-equirectangular-albedo.ts <shape.txt> <map.eps|map.png> <output-albedo.txt>',
  );
}

function readEpsMap(path: string): GrayMap {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const imageOperator = lines.findIndex((line) => line.includes('colorimage'));
  if (imageOperator < 0) throw new Error(`${path} has no colorimage operator`);

  let width = 0;
  let height = 0;
  for (let index = imageOperator - 1; index >= 0; index--) {
    const match = /^(\d+)\s+(\d+)\s+8\s+\[/.exec(lines[index].trim());
    if (match) {
      width = Number(match[1]);
      height = Number(match[2]);
      break;
    }
  }
  if (width <= 0 || height <= 0)
    throw new Error(`${path} has no supported grayscale image dimensions`);

  const chunks: string[] = [];
  for (let index = imageOperator + 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    if (!/^[0-9a-f]+$/i.test(line) || line.length % 2 !== 0) break;
    chunks.push(line);
  }
  const data = Buffer.from(chunks.join(''), 'hex');
  if (data.length !== width * height)
    throw new Error(
      `${path} contains ${data.length} pixels; expected ${width * height}`,
    );
  return { data, width, height };
}

async function readMap(path: string): Promise<GrayMap> {
  if (extname(path).toLowerCase() === '.eps') return readEpsMap(path);
  const result = await sharp(path).greyscale().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

function sampleMap(map: GrayMap, x: number, y: number) {
  const pixel = map.data[y * map.width + x];
  // The paper uses pure white for unobserved terra incognita. Preserve valid
  // high-albedo pixels and only mean-fill the explicit unknown marker.
  return pixel === 255 ? 1 : 1 + ((pixel - 128) / 127) * 0.07;
}

async function main() {
  const [shapePath, mapPath, outputPath] = process.argv.slice(2);
  if (!shapePath || !mapPath || !outputPath) usage();
  const shape = readDamitShape(resolve(shapePath));
  const map = await readMap(resolve(mapPath));
  const values = shape.faces.map((face) => {
    const center = face.reduce(
      (sum, vertexIndex) =>
        sum.map((value, axis) => value + shape.vertices[vertexIndex][axis]),
      [0, 0, 0],
    );
    const length = Math.hypot(...center);
    if (!Number.isFinite(length) || length === 0)
      throw new Error('DAMIT face center has no spatial extent');
    const longitude =
      (Math.atan2(center[1], center[0]) - Math.PI + Math.PI * 2) %
      (Math.PI * 2);
    const latitude = Math.asin(center[2] / length);
    const u = longitude / (Math.PI * 2);
    const v = (latitude + Math.PI / 2) / Math.PI;
    const x = Math.min(
      map.width - 1,
      Math.max(0, Math.round(u * (map.width - 1))),
    );
    const y = Math.min(
      map.height - 1,
      Math.max(0, Math.round((1 - v) * (map.height - 1))),
    );
    return sampleMap(map, x, y).toFixed(6);
  });
  writeFileSync(resolve(outputPath), `${values.join('\n')}\n`);
  console.log(
    `DAMIT sampling: ${shape.faces.length} faces from ${map.width}x${map.height} equirectangular map -> ${resolve(outputPath)}`,
  );
}

await main();
