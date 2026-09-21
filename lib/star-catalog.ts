import { Matrix4, Quaternion, Vector3 } from 'three';
import { constellationNames } from './constellations';
import { sceneDirection } from './ephemeris';

const CATALOG_MAGIC = 0x52415453; // "STAR"
const CATALOG_VERSION = 1;
const CATALOG_HEADER_BYTES = 16;
const STAR_RECORD_BYTES = 22;
// Proper motion is a whole number of 10 nrad/yr: 0.002"/yr resolution keeps a
// five-century run below one arcsecond, and the fastest bright star in the
// catalogue (Groombridge 1830, 7.06"/yr) stays well inside the signed range.
const MOTION_SCALE = 1e-8;
const MAGNITUDE_SCALE = 100;
const COLOR_INDEX_SCALE = 1000;
/** Stars without a published B-V keep a neutral colour instead of a guess. */
export const DEFAULT_COLOR_INDEX = 0.45;

export type StarCatalog = {
  /** J2000 equatorial (EQJ) unit vectors, three components per star. */
  positions: Float32Array;
  /** Annual proper motion of those same vectors, in radians per year. */
  motions: Float32Array;
  magnitudes: Float32Array;
  /** Johnson B-V colour index. */
  colorIndices: Float32Array;
};

export type Constellation = {
  /** IAU three-letter abbreviation; `lib/constellations.ts` names it. */
  id: string;
  /** Star index pairs, two entries per drawn segment. */
  lines: number[];
};

export type ConstellationFigures = {
  starCount: number;
  constellations: Constellation[];
};

function catalogError(message: string): Error {
  return new Error(`Invalid star catalog: ${message}`);
}

export function starCount(catalog: StarCatalog) {
  return catalog.magnitudes.length;
}

export function encodeStarCatalog(catalog: StarCatalog): ArrayBuffer {
  const count = starCount(catalog);
  if (
    catalog.positions.length !== count * 3 ||
    catalog.motions.length !== count * 3 ||
    catalog.colorIndices.length !== count
  )
    throw catalogError('column lengths disagree');
  const buffer = new ArrayBuffer(
    CATALOG_HEADER_BYTES + count * STAR_RECORD_BYTES,
  );
  const view = new DataView(buffer);
  view.setUint32(0, CATALOG_MAGIC, true);
  view.setUint16(4, CATALOG_VERSION, true);
  view.setUint16(6, STAR_RECORD_BYTES, true);
  view.setUint32(8, count, true);
  for (let index = 0; index < count; index++) {
    let offset = CATALOG_HEADER_BYTES + index * STAR_RECORD_BYTES;
    for (let axis = 0; axis < 3; axis++, offset += 4)
      view.setFloat32(offset, catalog.positions[index * 3 + axis], true);
    for (let axis = 0; axis < 3; axis++, offset += 2)
      view.setInt16(
        offset,
        Math.round(catalog.motions[index * 3 + axis] / MOTION_SCALE),
        true,
      );
    view.setInt16(
      offset,
      Math.round(catalog.magnitudes[index] * MAGNITUDE_SCALE),
      true,
    );
    view.setInt16(
      offset + 2,
      Math.round(catalog.colorIndices[index] * COLOR_INDEX_SCALE),
      true,
    );
  }
  return buffer;
}

export function parseStarCatalog(buffer: ArrayBuffer): StarCatalog {
  if (buffer.byteLength < CATALOG_HEADER_BYTES)
    throw catalogError('header is truncated');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== CATALOG_MAGIC)
    throw catalogError('unexpected magic');
  if (view.getUint16(4, true) !== CATALOG_VERSION)
    throw catalogError('unsupported version');
  if (view.getUint16(6, true) !== STAR_RECORD_BYTES)
    throw catalogError('unsupported record size');
  const count = view.getUint32(8, true);
  if (
    count === 0 ||
    buffer.byteLength !== CATALOG_HEADER_BYTES + count * STAR_RECORD_BYTES
  )
    throw catalogError('record block is truncated');
  const positions = new Float32Array(count * 3),
    motions = new Float32Array(count * 3),
    magnitudes = new Float32Array(count),
    colorIndices = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    let offset = CATALOG_HEADER_BYTES + index * STAR_RECORD_BYTES;
    for (let axis = 0; axis < 3; axis++, offset += 4)
      positions[index * 3 + axis] = view.getFloat32(offset, true);
    for (let axis = 0; axis < 3; axis++, offset += 2)
      motions[index * 3 + axis] = view.getInt16(offset, true) * MOTION_SCALE;
    magnitudes[index] = view.getInt16(offset, true) / MAGNITUDE_SCALE;
    colorIndices[index] = view.getInt16(offset + 2, true) / COLOR_INDEX_SCALE;
  }
  return { positions, motions, magnitudes, colorIndices };
}

export function parseConstellationFigures(
  value: unknown,
  stars: number,
): ConstellationFigures {
  if (!value || typeof value !== 'object')
    throw catalogError('figures are not an object');
  const source = value as Record<string, unknown>;
  if (source.starCount !== stars)
    throw catalogError('figures were built for a different catalog');
  if (!Array.isArray(source.constellations))
    throw catalogError('figures list is missing');
  const constellations = source.constellations.map((entry): Constellation => {
    const figure = entry as Record<string, unknown>;
    const { id, lines } = figure;
    if (typeof id !== 'string' || !Object.hasOwn(constellationNames, id))
      throw catalogError(`figure ${String(id)} is not a constellation`);
    if (
      !Array.isArray(lines) ||
      lines.length === 0 ||
      lines.length % 2 !== 0 ||
      lines.some(
        (index) =>
          typeof index !== 'number' ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= stars,
      )
    )
      throw catalogError(`figure ${id} points outside the catalog`);
    return { id, lines: lines as number[] };
  });
  return { starCount: stars, constellations };
}

/**
 * Ballesteros (2012) inverts the black-body colour of a main-sequence star, so
 * a catalogued B-V becomes a temperature without a spectral-type lookup.
 */
export function starTemperature(colorIndex: number) {
  const bv = Math.min(Math.max(colorIndex, -0.4), 2.2);
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/**
 * A compact fit of the Planckian locus in sRGB. Stars are drawn additively on
 * a dark sky, so the fit is normalised to keep its brightest channel at one
 * and let the magnitude alone decide how bright a star is.
 */
export function starColor(colorIndex: number): [number, number, number] {
  const kelvin = Math.min(Math.max(starTemperature(colorIndex), 1000), 40000);
  const t = kelvin / 100;
  const channel = (value: number) => Math.min(Math.max(value, 0), 1);
  const red =
    t <= 66 ? 1 : channel((329.698727446 * (t - 60) ** -0.1332047592) / 255);
  const green =
    t <= 66
      ? channel((99.4708025861 * Math.log(t) - 161.1195681661) / 255)
      : channel((288.1221695283 * (t - 60) ** -0.0755148492) / 255);
  const blue =
    t >= 66
      ? 1
      : t <= 19
        ? 0
        : channel((138.5177312231 * Math.log(t - 10) - 305.0447927307) / 255);
  // Cool stars would otherwise be drawn as deeply saturated red points; real
  // naked-eye stars keep a pale tint because the eye desaturates them.
  const pale = 0.35;
  return [red, green, blue].map((value) => value * (1 - pale) + pale) as [
    number,
    number,
    number,
  ];
}

/** Naked-eye limit of the Bright Star Catalogue, used as the faint anchor. */
export const NAKED_EYE_MAGNITUDE = 6.5;

/** How far towards the top of its own figure a constellation's name sits. */
const ANCHOR_LIFT = 0.35;
const ANCHOR_LIFT_LIMIT = (5 * Math.PI) / 180;

/**
 * Where a figure's name belongs: among the stars it names, a little above
 * their middle. A name written outside the figure leaves a reader guessing
 * which stars it refers to, and a chart's own label point is chosen for a
 * flat map rather than for a sky the viewer can turn.
 *
 * `up` is the scene's own up axis, which is where screen-up stays while the
 * view orbits; a figure sitting on that axis has no meaningful up of its own
 * and simply keeps its middle.
 */
export function figureAnchor(
  positions: Float32Array,
  magnitudes: Float32Array,
  lines: number[],
  up: Vector3,
) {
  const stars = new Set(lines);
  const middle = new Vector3();
  for (const index of stars)
    middle.addScaledVector(
      new Vector3(
        positions[index * 3],
        positions[index * 3 + 1],
        positions[index * 3 + 2],
      ),
      // Weighted towards the stars a reader actually picks out, so the name
      // lands on the shape they recognise rather than between its faint
      // outlying limbs.
      Math.max(NAKED_EYE_MAGNITUDE - magnitudes[index], 0.5),
    );
  middle.normalize();
  const north = up.clone().projectOnPlane(middle);
  if (north.lengthSq() < 1e-8) return middle;
  north.normalize();
  // Step towards the figure's own topmost star rather than towards the up
  // axis itself: a fraction of the way to a star the figure really has is
  // inside it by construction, however wide or flat the shape is.
  let top: Vector3 | null = null,
    reach = 0;
  for (const index of stars) {
    const star = new Vector3(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    );
    if (star.dot(north) > reach) {
      reach = star.dot(north);
      top = star;
    }
  }
  if (!top) return middle;
  const lift = Math.min(middle.angleTo(top) * ANCHOR_LIFT, ANCHOR_LIFT_LIMIT);
  const toTop = top.clone().projectOnPlane(middle);
  if (toTop.lengthSq() < 1e-8) return middle;
  return middle
    .multiplyScalar(Math.cos(lift))
    .addScaledVector(toTop.normalize(), Math.sin(lift))
    .normalize();
}

/** Drawn diameter in CSS pixels before the device pixel ratio is applied. */
export function starPointSize(magnitude: number) {
  const steps = NAKED_EYE_MAGNITUDE - Math.min(magnitude, NAKED_EYE_MAGNITUDE);
  return Math.min(1.5 + steps ** 1.35 * 0.52, 9);
}

/** How strongly a star is drawn, so faint ones fade instead of disappearing. */
export function starBrightness(magnitude: number) {
  const steps = NAKED_EYE_MAGNITUDE - magnitude;
  return Math.min(Math.max(0.16 + steps * 0.14, 0.05), 1);
}

// The IAU galactic frame as realised in the ICRS: the north galactic pole and
// the direction of galactic longitude zero, both in J2000 equatorial degrees.
const galacticPole = { ra: 192.85948, dec: 27.12825 };
const galacticCenter = { ra: 266.405, dec: -28.936167 };

function equatorialDirection(ra: number, dec: number) {
  const a = (ra * Math.PI) / 180,
    d = (dec * Math.PI) / 180;
  return new Vector3(
    Math.cos(d) * Math.cos(a),
    Math.cos(d) * Math.sin(a),
    Math.sin(d),
  );
}

/** Columns are the galactic axes in EQJ, so the matrix maps galactic to EQJ. */
export function galacticBasis() {
  const third = equatorialDirection(galacticPole.ra, galacticPole.dec);
  const first = equatorialDirection(galacticCenter.ra, galacticCenter.dec)
    .projectOnPlane(third)
    .normalize();
  const second = third.clone().cross(first).normalize();
  return new Matrix4().makeBasis(first, second, third);
}

/** Columns are the EQJ axes in scene coordinates. */
export function sceneBasis() {
  return new Matrix4().makeBasis(
    new Vector3(...sceneDirection(1, 0, 0)),
    new Vector3(...sceneDirection(0, 1, 0)),
    new Vector3(...sceneDirection(0, 0, 1)),
  );
}

/**
 * How to turn a sky sphere so the bundled Milky Way panorama agrees with the
 * catalogued stars drawn over it, rather than sitting at a rotation chosen
 * by eye.
 *
 * The map is drawn in galactic coordinates the way an all-sky chart is drawn
 * for someone standing under it: the galactic centre in the middle, longitude
 * running left, and the south galactic pole in the first row. An
 * equirectangular sphere carries image column `u` to a turn of `2*PI*u` about
 * its own +Y axis and row `v` down from that pole, which places galactic
 * longitude zero on -X and the north galactic pole on +Z — a quarter turn
 * about X away from the galactic frame itself. Undoing that turn and then
 * mapping galactic to equatorial to scene axes leaves the panorama aligned.
 */
export function panoramaOrientation() {
  return new Quaternion().setFromRotationMatrix(
    sceneBasis()
      .multiply(galacticBasis())
      .multiply(new Matrix4().makeRotationX(-Math.PI / 2)),
  );
}

/**
 * Where a galactic direction falls on the panorama, as a fraction of its
 * width and height measured from the image's top-left corner.
 */
export function panoramaPixel(
  longitude: number,
  latitude: number,
): [number, number] {
  const wrapped = (((0.5 - longitude / (2 * Math.PI)) % 1) + 1) % 1;
  return [wrapped, latitude / Math.PI + 0.5];
}
