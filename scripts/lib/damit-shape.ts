import { readFileSync } from 'node:fs';

export type DamitFace = [number, number, number];

export type DamitShape = {
  vertices: number[][];
  faces: DamitFace[];
};

function parseNumbers(path: string) {
  const values = readFileSync(path, 'utf8').trim().split(/\s+/).map(Number);
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error(`${path} contains a non-numeric value`);
  return values;
}

export function readDamitShape(path: string): DamitShape {
  const values = parseNumbers(path);
  const vertexCount = values[0];
  const faceCount = values[1];
  if (
    !Number.isInteger(vertexCount) ||
    !Number.isInteger(faceCount) ||
    vertexCount <= 0 ||
    faceCount <= 0
  )
    throw new Error(`${path} has invalid vertex or face counts`);
  const expected = 2 + vertexCount * 3 + faceCount * 3;
  if (values.length !== expected)
    throw new Error(
      `${path} has ${values.length} values; expected ${expected}`,
    );

  const vertices = Array.from({ length: vertexCount }, (_, index) => [
    values[2 + index * 3],
    values[3 + index * 3],
    values[4 + index * 3],
  ]);
  let offset = 2 + vertexCount * 3;
  const faces = Array.from({ length: faceCount }, () => {
    const face = values.slice(offset, offset + 3);
    offset += 3;
    if (
      face.some(
        (index) => !Number.isInteger(index) || index < 1 || index > vertexCount,
      )
    )
      throw new Error(`${path} contains an invalid one-based face index`);
    return face.map((index) => index - 1) as DamitFace;
  });
  return { vertices, faces };
}

export function normalizeDamitVertices(vertices: number[][]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const vertex of vertices)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  const center = min.map((value, axis) => (value + max[axis]) / 2);
  let radius = 0;
  const normalized = vertices.map((vertex) => {
    const value = vertex.map((coordinate, axis) => coordinate - center[axis]);
    radius = Math.max(radius, Math.hypot(...value));
    return value;
  });
  if (!Number.isFinite(radius) || radius === 0)
    throw new Error('DAMIT model has no spatial extent');
  return normalized.map((vertex) =>
    vertex.map((coordinate) => coordinate / radius),
  );
}

export function outwardDamitFace(
  vertices: number[][],
  sourceFace: DamitFace,
): { face: DamitFace; normal: [number, number, number] } {
  let face: DamitFace = [...sourceFace];
  let normal = calculateNormal(vertices, face);
  const center = face.reduce(
    (sum, vertexIndex) =>
      sum.map((value, axis) => value + vertices[vertexIndex][axis]),
    [0, 0, 0],
  );
  if (
    normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2] <
    0
  ) {
    face = [face[0], face[2], face[1]];
    normal = calculateNormal(vertices, face);
  }
  return { face, normal };
}

function calculateNormal(
  vertices: number[][],
  face: DamitFace,
): [number, number, number] {
  const a = vertices[face[0]],
    b = vertices[face[1]],
    c = vertices[face[2]];
  const ab = b.map((value, axis) => value - a[axis]);
  const ac = c.map((value, axis) => value - a[axis]);
  const normal: [number, number, number] = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(...normal);
  if (!Number.isFinite(length) || length === 0)
    throw new Error('DAMIT model contains a degenerate face');
  return normal.map((value) => value / length) as [number, number, number];
}
