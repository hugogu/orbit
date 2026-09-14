import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeAsteroidModel,
  type AsteroidModelData,
} from '../lib/asteroid-model';

const HEADER_BYTES = 16;
const CmodToken = {
  material: 1001,
  endMaterial: 1002,
  diffuse: 1003,
  specular: 1004,
  specularPower: 1005,
  opacity: 1006,
  texture: 1007,
  mesh: 1009,
  endMesh: 1010,
  vertexDesc: 1011,
  endVertexDesc: 1012,
  vertices: 1013,
  emissive: 1014,
  blend: 1015,
} as const;
const CmodType = {
  float1: 1,
  float2: 2,
  float3: 3,
  float4: 4,
  string: 5,
  color: 7,
} as const;
const Semantic = {
  position: 0,
  normal: 3,
  texture0: 5,
} as const;
const Format = {
  float1: 0,
  float2: 1,
  float3: 2,
  float4: 3,
  ubyte4: 4,
} as const;

class Reader {
  private offset = HEADER_BYTES;
  constructor(private readonly bytes: Uint8Array) {}

  get done() {
    return this.offset >= this.bytes.byteLength;
  }

  int16() {
    this.ensure(2);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      2,
    ).getInt16(0, true);
    this.offset += 2;
    return value;
  }

  uint16() {
    this.ensure(2);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      2,
    ).getUint16(0, true);
    this.offset += 2;
    return value;
  }

  uint32() {
    this.ensure(4);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      4,
    ).getUint32(0, true);
    this.offset += 4;
    return value;
  }

  float32() {
    this.ensure(4);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      4,
    ).getFloat32(0, true);
    this.offset += 4;
    return value;
  }

  bytesFor(length: number) {
    this.ensure(length);
    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private ensure(length: number) {
    if (length < 0 || this.offset + length > this.bytes.byteLength)
      throw new Error('CMOD file is truncated');
  }
}

function readTypedValue(reader: Reader) {
  const type = reader.int16();
  switch (type) {
    case CmodType.float1:
      return [reader.float32()];
    case CmodType.float2:
      return [reader.float32(), reader.float32()];
    case CmodType.float3:
      return [reader.float32(), reader.float32(), reader.float32()];
    case CmodType.float4:
      return [reader.float32(), reader.float32(), reader.float32(), reader.float32()];
    case CmodType.color:
      return [reader.float32(), reader.float32(), reader.float32()];
    case CmodType.string: {
      const length = reader.uint16();
      reader.bytesFor(length);
      return [];
    }
    default:
      throw new Error(`Unsupported CMOD value type ${type}`);
  }
}

function readMaterial(reader: Reader) {
  for (;;) {
    const token = reader.int16();
    if (token === CmodToken.endMaterial) return;
    if (token === CmodToken.texture) {
      reader.int16();
      const type = reader.int16();
      if (type !== CmodType.string)
        throw new Error('CMOD texture filename is not a string');
      reader.bytesFor(reader.uint16());
    } else if (token === CmodToken.blend) {
      reader.int16();
    } else if (
      token === CmodToken.diffuse ||
      token === CmodToken.specular ||
      token === CmodToken.emissive ||
      token === CmodToken.specularPower ||
      token === CmodToken.opacity
    ) {
      readTypedValue(reader);
    } else {
      throw new Error(`Unsupported CMOD material token ${token}`);
    }
  }
}

function formatLength(format: number) {
  switch (format) {
    case Format.float1:
    case Format.ubyte4:
      return 1;
    case Format.float2:
      return 2;
    case Format.float3:
      return 3;
    case Format.float4:
      return 4;
    default:
      throw new Error(`Unsupported CMOD vertex format ${format}`);
  }
}

function readAttribute(reader: Reader, format: number) {
  if (format === Format.ubyte4) {
    reader.uint32();
    return [0, 0, 0, 0];
  }
  return Array.from({ length: formatLength(format) }, () => reader.float32());
}

function triangulate(
  primitive: number,
  indices: number[],
  output: number[],
  vertexOffset: number,
) {
  const add = (a: number, b: number, c: number) =>
    output.push(a + vertexOffset, b + vertexOffset, c + vertexOffset);
  if (primitive === 0) {
    for (let i = 0; i + 2 < indices.length; i += 3)
      add(indices[i], indices[i + 1], indices[i + 2]);
  } else if (primitive === 1) {
    for (let i = 0; i + 2 < indices.length; i++)
      if (i % 2 === 0) add(indices[i], indices[i + 1], indices[i + 2]);
      else add(indices[i + 1], indices[i], indices[i + 2]);
  } else if (primitive === 2 && indices.length >= 3) {
    for (let i = 1; i + 1 < indices.length; i++)
      add(indices[0], indices[i], indices[i + 1]);
  }
}

export function normalizeModel(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
): AsteroidModelData {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxX = Math.max(maxX, positions[i]);
    maxY = Math.max(maxY, positions[i + 1]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const center = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= center[0];
    positions[i + 1] -= center[1];
    positions[i + 2] -= center[2];
    radius = Math.max(
      radius,
      Math.hypot(positions[i], positions[i + 1], positions[i + 2]),
    );
  }
  if (!Number.isFinite(radius) || radius === 0)
    throw new Error('CMOD model has no spatial extent');
  for (let i = 0; i < positions.length; i++) positions[i] /= radius;

  let hasNormals = false;
  for (let i = 0; i < normals.length; i++) {
    if (Math.abs(normals[i]) > 1e-6) hasNormals = true;
    normals[i] = Number.isFinite(normals[i]) ? normals[i] : 0;
  }
  if (!hasNormals) normals.fill(0);
  if (!hasNormals) {
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i] * 3,
        ib = indices[i + 1] * 3,
        ic = indices[i + 2] * 3;
      const ax = positions[ib] - positions[ia],
        ay = positions[ib + 1] - positions[ia + 1],
        az = positions[ib + 2] - positions[ia + 2];
      const bx = positions[ic] - positions[ia],
        by = positions[ic + 1] - positions[ia + 1],
        bz = positions[ic + 2] - positions[ia + 2];
      const nx = ay * bz - az * by,
        ny = az * bx - ax * bz,
        nz = ax * by - ay * bx;
      normals[ia] += nx;
      normals[ia + 1] += ny;
      normals[ia + 2] += nz;
      normals[ib] += nx;
      normals[ib + 1] += ny;
      normals[ib + 2] += nz;
      normals[ic] += nx;
      normals[ic + 1] += ny;
      normals[ic + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }
  for (let i = 0; i < uvs.length; i += 2) {
    if (!Number.isFinite(uvs[i]) || !Number.isFinite(uvs[i + 1])) {
      const p = i / 2;
      const x = positions[p * 3];
      const y = positions[p * 3 + 1];
      const z = positions[p * 3 + 2];
      uvs[i] = 0.5 + Math.atan2(x, z) / (Math.PI * 2);
      uvs[i + 1] = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
    }
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
  };
}

function readCmod(bytes: Uint8Array): AsteroidModelData {
  const header = new TextDecoder().decode(bytes.subarray(0, HEADER_BYTES));
  if (header !== '#celmodel_binary') throw new Error('Expected binary CMOD');
  const reader = new Reader(bytes);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (;;) {
    if (reader.done) break;
    const token = reader.int16();
    if (token === CmodToken.material) {
      readMaterial(reader);
      continue;
    }
    if (token !== CmodToken.mesh) throw new Error(`Unsupported CMOD token ${token}`);
    if (reader.int16() !== CmodToken.vertexDesc)
      throw new Error('CMOD vertex description is missing');
    const attributes: { semantic: number; format: number }[] = [];
    for (;;) {
      const semantic = reader.int16();
      if (semantic === CmodToken.endVertexDesc) break;
      attributes.push({ semantic, format: reader.int16() });
    }
    if (reader.int16() !== CmodToken.vertices)
      throw new Error('CMOD vertex data is missing');
    const vertexCount = reader.uint32();
    const vertexOffset = positions.length / 3;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      let position = [0, 0, 0],
        normal = [0, 0, 0],
        uv = [NaN, NaN];
      for (const attribute of attributes) {
        const value = readAttribute(reader, attribute.format);
        if (attribute.semantic === Semantic.position) position = value;
        if (attribute.semantic === Semantic.normal) normal = value;
        if (attribute.semantic === Semantic.texture0) uv = value;
      }
      positions.push(position[0], position[1], position[2]);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(uv[0], uv[1]);
    }
    for (;;) {
      const primitive = reader.int16();
      if (primitive === CmodToken.endMesh) break;
      reader.uint32();
      const count = reader.uint32();
      const group = Array.from({ length: count }, () => reader.uint32());
      triangulate(primitive, group, indices, vertexOffset);
    }
  }
  return normalizeModel(positions, normals, uvs, indices);
}

function main() {
  const inputRoot = resolve(process.argv[2] ?? '.');
  const outputRoot = resolve(process.argv[3] ?? 'public/models/asteroids');
  const names = [
    'bennu',
    'eros',
    'itokawa',
    'juno',
    'pallas',
    'psyche',
    'ryugu',
    'vesta',
  ];
  mkdirSync(outputRoot, { recursive: true });
  for (const name of names) {
    const model = readCmod(
      new Uint8Array(readFileSync(resolve(inputRoot, 'models', `${name}.cmod`))),
    );
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
