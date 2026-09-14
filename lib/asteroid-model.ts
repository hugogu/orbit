const MODEL_MAGIC = 0x4942524f;
const MODEL_VERSION = 1;
const MODEL_HEADER_BYTES = 16;

export type AsteroidModelData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

function modelError(message: string): Error {
  return new Error(`Invalid asteroid model: ${message}`);
}

export function parseAsteroidModel(buffer: ArrayBuffer): AsteroidModelData {
  if (buffer.byteLength < MODEL_HEADER_BYTES)
    throw modelError('header is truncated');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MODEL_MAGIC)
    throw modelError('unexpected magic');
  if (view.getUint16(4, true) !== MODEL_VERSION)
    throw modelError('unsupported version');
  const vertexCount = view.getUint32(8, true);
  const indexCount = view.getUint32(12, true);
  const expectedBytes =
    MODEL_HEADER_BYTES +
    vertexCount * (3 + 3 + 2) * Float32Array.BYTES_PER_ELEMENT +
    indexCount * Uint32Array.BYTES_PER_ELEMENT;
  if (
    vertexCount === 0 ||
    indexCount === 0 ||
    indexCount % 3 !== 0 ||
    expectedBytes !== buffer.byteLength
  )
    throw modelError('invalid vertex or index data length');

  let offset = MODEL_HEADER_BYTES;
  const positions = new Float32Array(buffer, offset, vertexCount * 3);
  offset += positions.byteLength;
  const normals = new Float32Array(buffer, offset, vertexCount * 3);
  offset += normals.byteLength;
  const uvs = new Float32Array(buffer, offset, vertexCount * 2);
  offset += uvs.byteLength;
  const indices = new Uint32Array(buffer, offset, indexCount);
  for (const index of indices) {
    if (index >= vertexCount) throw modelError('index is out of range');
  }
  return { positions, normals, uvs, indices };
}

export function encodeAsteroidModel(model: AsteroidModelData): Uint8Array {
  const vertexCount = model.positions.length / 3;
  const indexCount = model.indices.length;
  if (
    !Number.isInteger(vertexCount) ||
    model.normals.length !== vertexCount * 3 ||
    model.uvs.length !== vertexCount * 2 ||
    indexCount === 0 ||
    indexCount % 3 !== 0
  )
    throw modelError('cannot encode inconsistent geometry');
  const buffer = new ArrayBuffer(
    MODEL_HEADER_BYTES +
      model.positions.byteLength +
      model.normals.byteLength +
      model.uvs.byteLength +
      model.indices.byteLength,
  );
  const view = new DataView(buffer);
  view.setUint32(0, MODEL_MAGIC, true);
  view.setUint16(4, MODEL_VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, vertexCount, true);
  view.setUint32(12, indexCount, true);
  let offset = MODEL_HEADER_BYTES;
  new Uint8Array(buffer, offset, model.positions.byteLength).set(
    new Uint8Array(model.positions.buffer, model.positions.byteOffset, model.positions.byteLength),
  );
  offset += model.positions.byteLength;
  new Uint8Array(buffer, offset, model.normals.byteLength).set(
    new Uint8Array(model.normals.buffer, model.normals.byteOffset, model.normals.byteLength),
  );
  offset += model.normals.byteLength;
  new Uint8Array(buffer, offset, model.uvs.byteLength).set(
    new Uint8Array(model.uvs.buffer, model.uvs.byteOffset, model.uvs.byteLength),
  );
  offset += model.uvs.byteLength;
  new Uint8Array(buffer, offset, model.indices.byteLength).set(
    new Uint8Array(model.indices.buffer, model.indices.byteOffset, model.indices.byteLength),
  );
  return new Uint8Array(buffer);
}
