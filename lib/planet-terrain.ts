import { SphereGeometry, Vector3 } from 'three';

export const TERRAIN_EXAGGERATION = 6;
export const TERRAIN_SEGMENTS = [256, 128] as const;

/** North-up, east-positive, -180..180 longitude; height is packed into R/G. */
export type HeightField = {
  data: ArrayLike<number>;
  width: number;
  height: number;
  channels: number;
};
export type TerrainParameters = {
  id: string;
  radius: number;
  terrainMinKm: number;
  terrainMaxKm: number;
};

const wrap = (x: number, size: number) => ((x % size) + size) % size;

/** Bilinear sampling at pixel centers, with a single height at each pole. */
export function sampleTerrainHeight(field: HeightField, u: number, v: number) {
  const { data, width, height, channels } = field;
  const at = (x: number, y: number) => {
    const i = (y * width + wrap(x, width)) * channels;
    return (data[i] * 256 + data[i + 1]) / 65535;
  };
  if (v <= 0 || v >= 1) {
    const row = v >= 1 ? 0 : height - 1;
    let total = 0;
    for (let x = 0; x < width; x++) total += at(x, row);
    return total / width;
  }
  const x = wrap(u, 1) * width - 0.5;
  const y = Math.max(0, Math.min(height - 1, (1 - v) * height - 0.5));
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const dx = x - x0,
    dy = y - y0;
  const y1 = Math.min(y0 + 1, height - 1);
  return (
    (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) +
    (at(x0, y1) * (1 - dx) + at(x0 + 1, y1) * dx) * dy
  );
}

export function terrainElevationKm(sample: number, body: TerrainParameters) {
  const elevation =
    body.terrainMinKm + sample * (body.terrainMaxKm - body.terrainMinKm);
  // The visible Earth map includes oceans: do not turn water into exposed seabed.
  return body.id === 'earth' ? Math.max(0, elevation) : elevation;
}

export function terrainPoint(
  field: HeightField,
  body: TerrainParameters,
  u: number,
  v: number,
  target = new Vector3(),
) {
  const longitude = (u - 0.5) * Math.PI * 2;
  const latitude = (v - 0.5) * Math.PI;
  const radius =
    1 +
    (terrainElevationKm(sampleTerrainHeight(field, u, v), body) *
      TERRAIN_EXAGGERATION) /
      body.radius;
  return target
    .set(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      -Math.cos(latitude) * Math.sin(longitude),
    )
    .multiplyScalar(radius);
}

/** Object-space normal: replaces coarse normals instead of adding relief twice. */
export function terrainNormal(
  field: HeightField,
  body: TerrainParameters,
  u: number,
  v: number,
) {
  if (v <= 0 || v >= 1) return new Vector3(0, v >= 1 ? 1 : -1, 0);
  const du = 1 / field.width,
    dv = 1 / field.height;
  const east = terrainPoint(field, body, u + du, v).sub(
    terrainPoint(field, body, u - du, v),
  );
  const north = terrainPoint(field, body, u, Math.min(1, v + dv)).sub(
    terrainPoint(field, body, u, Math.max(0, v - dv)),
  );
  return east.cross(north).normalize();
}

export function createTerrainGeometry(
  field: HeightField,
  body: TerrainParameters,
  displayRadius: number,
) {
  const [columns, rows] = TERRAIN_SEGMENTS;
  const geometry = new SphereGeometry(displayRadius, columns, rows);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    terrainPoint(field, body, uv.getX(i), uv.getY(i), point).multiplyScalar(
      displayRadius,
    );
    position.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  // UV seam/pole duplicates must share their lighting as well as positions.
  for (let row = 1; row < rows; row++) {
    const a = row * (columns + 1),
      b = a + columns;
    point
      .fromBufferAttribute(normals, a)
      .add(new Vector3().fromBufferAttribute(normals, b))
      .normalize();
    normals.setXYZ(a, point.x, point.y, point.z);
    normals.setXYZ(b, point.x, point.y, point.z);
  }
  for (const row of [0, rows]) {
    point.set(0, 0, 0);
    for (let col = 0; col <= columns; col++)
      point.add(
        new Vector3().fromBufferAttribute(normals, row * (columns + 1) + col),
      );
    point.normalize();
    for (let col = 0; col <= columns; col++)
      normals.setXYZ(row * (columns + 1) + col, point.x, point.y, point.z);
  }
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

/** Preserve the catalog's volumetric mean radius while applying flattening. */
export function oblateScale(flattening = 0) {
  const equator = Math.cbrt(1 / (1 - flattening));
  return new Vector3(equator, equator * (1 - flattening), equator);
}
