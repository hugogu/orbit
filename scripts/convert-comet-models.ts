import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  encodeAsteroidModel,
  type AsteroidModelData,
} from '../lib/asteroid-model';
import { normalizeModel, readCmod } from './convert-asteroid-models';

function orientOutward(positions: number[], indices: number[]) {
  let volume6 = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3;
    volume6 +=
      positions[a] *
        (positions[b + 1] * positions[c + 2] -
          positions[b + 2] * positions[c + 1]) +
      positions[a + 1] *
        (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) +
      positions[a + 2] *
        (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (volume6 < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
}

function readObj(path: string): AsteroidModelData {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') {
      if (fields.length < 4) throw new Error(`Invalid OBJ vertex: ${line}`);
      positions.push(Number(fields[1]), Number(fields[2]), Number(fields[3]));
    } else if (fields[0] === 'f') {
      const face = fields.slice(1).map((token) => {
        const index = Number.parseInt(token.split('/')[0], 10);
        if (!Number.isInteger(index) || index === 0)
          throw new Error(`Invalid OBJ face: ${line}`);
        return index < 0 ? positions.length / 3 + index : index - 1;
      });
      for (let i = 1; i + 1 < face.length; i++)
        indices.push(face[0], face[i], face[i + 1]);
    }
  }
  const vertexCount = positions.length / 3;
  if (
    !vertexCount ||
    !indices.length ||
    indices.some((i) => i < 0 || i >= vertexCount)
  )
    throw new Error(`Invalid OBJ geometry in ${path}`);
  orientOutward(positions, indices);
  return normalizeModel(
    positions,
    Array(vertexCount * 3).fill(0),
    Array(vertexCount * 2).fill(NaN),
    indices,
  );
}

function constrainedModel(kind: 'encke' | 'hale-bopp') {
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const position = geometry.getAttribute('position');
  const positions: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i).normalize();
    const roughness =
      kind === 'encke'
        ? 1 +
          0.035 * Math.sin(p.x * 17.3 + p.y * 9.1 + p.z * 4.7) +
          0.02 * Math.sin(p.x * 41.7 - p.z * 12.4)
        : 1 +
          0.045 * Math.sin(p.x * 13.1 + p.y * 7.6) +
          0.025 * Math.sin(p.y * 29.9 - p.z * 8.3);
    if (kind === 'encke') {
      const neck = 0.76 + 0.27 * Math.abs(p.x);
      positions.push(
        p.x * 1.42 * roughness,
        p.y * 0.9 * neck * roughness,
        p.z * 0.82 * neck * roughness,
      );
    } else {
      const asymmetric = 0.08 * (1 - p.x * p.x);
      positions.push(
        (p.x * 1.55 + asymmetric) * roughness,
        p.y * 0.96 * (1 + 0.06 * p.x) * roughness,
        p.z * 0.88 * roughness,
      );
    }
  }
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, i) => i);
  geometry.dispose();
  orientOutward(positions, indices);
  return normalizeModel(
    positions,
    Array(position.count * 3).fill(0),
    Array(position.count * 2).fill(NaN),
    indices,
  );
}

function main() {
  const inputRoot = resolve(process.argv[2] ?? '.');
  const outputRoot = resolve(process.argv[3] ?? 'public/models/comets');
  mkdirSync(outputRoot, { recursive: true });
  const models: Record<string, AsteroidModelData> = {
    halley: readCmod(
      new Uint8Array(readFileSync(resolve(inputRoot, 'models/halley.cmod'))),
    ),
    '67p': readObj(resolve(inputRoot, '67p-lores.obj')),
    encke: constrainedModel('encke'),
    'hale-bopp': constrainedModel('hale-bopp'),
  };
  for (const [name, model] of Object.entries(models)) {
    const target = resolve(outputRoot, `${name}.bin`);
    writeFileSync(target, encodeAsteroidModel(model));
    console.log(
      `${name}: ${model.positions.length / 3} vertices, ${model.indices.length / 3} triangles -> ${target}`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
