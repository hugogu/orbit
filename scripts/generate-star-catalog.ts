import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constellationNames } from '../lib/constellations';
import {
  DEFAULT_COLOR_INDEX,
  encodeStarCatalog,
  type Constellation,
  type StarCatalog,
} from '../lib/star-catalog';

// Both sources are downloaded once into a working directory that is not
// committed; the manifest written beside the assets records where each came
// from and under which terms.
export const starSources = {
  catalog: {
    file: 'catalog.gz',
    url: 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz',
    title: 'Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren, 1991)',
    license: 'CDS/ADC catalogue V/50, free to redistribute with credit',
  },
  figures: {
    file: 'constellations.lines.json',
    url: 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json',
    title: 'd3-celestial constellation figures (Olaf Frohn)',
    license: 'BSD-3-Clause',
  },
} as const;

type ParsedStar = {
  hr: number;
  ra: number;
  dec: number;
  magnitude: number;
  colorIndex: number;
  properRa: number;
  properDec: number;
};

const arcsecond = Math.PI / (180 * 3600);
const degree = Math.PI / 180;

function field(record: string, from: number, to: number) {
  return record.slice(from - 1, to);
}

function number(record: string, from: number, to: number) {
  const value = Number.parseFloat(field(record, from, to));
  return Number.isFinite(value) ? value : null;
}

/** Fixed-width records as published in the catalogue's own byte description. */
export function parseBrightStars(text: string): ParsedStar[] {
  const stars: ParsedStar[] = [];
  for (const record of text.split('\n')) {
    if (record.length < 90) continue;
    const hours = number(record, 76, 77),
      minutes = number(record, 78, 79),
      seconds = number(record, 80, 83),
      degrees = number(record, 85, 86),
      arcminutes = number(record, 87, 88),
      arcseconds = number(record, 89, 90),
      magnitude = number(record, 103, 107);
    // Fourteen numbered entries are novae or galaxies kept only to preserve
    // the numbering; they carry no position and are not stars to draw.
    if (
      hours === null ||
      minutes === null ||
      seconds === null ||
      degrees === null ||
      arcminutes === null ||
      arcseconds === null ||
      magnitude === null
    )
      continue;
    const sign = field(record, 84, 84) === '-' ? -1 : 1;
    stars.push({
      hr: number(record, 1, 4) ?? 0,
      ra: (hours + minutes / 60 + seconds / 3600) * 15 * degree,
      dec: sign * (degrees + arcminutes / 60 + arcseconds / 3600) * degree,
      magnitude,
      colorIndex: number(record, 110, 114) ?? DEFAULT_COLOR_INDEX,
      // The catalogue publishes the great-circle rate in right ascension, so
      // the declination cosine is already folded in.
      properRa: (number(record, 149, 154) ?? 0) * arcsecond,
      properDec: (number(record, 155, 160) ?? 0) * arcsecond,
    });
  }
  return stars;
}

/** EQJ unit vector and the annual rate at which proper motion moves it. */
export function starVectors(star: ParsedStar) {
  const cosDec = Math.cos(star.dec),
    sinDec = Math.sin(star.dec),
    cosRa = Math.cos(star.ra),
    sinRa = Math.sin(star.ra);
  return {
    position: [cosDec * cosRa, cosDec * sinRa, sinDec] as const,
    motion: [
      -star.properRa * sinRa - star.properDec * sinDec * cosRa,
      star.properRa * cosRa - star.properDec * sinDec * sinRa,
      star.properDec * cosDec,
    ] as const,
  };
}

export function buildCatalog(stars: ParsedStar[]): StarCatalog {
  // Brightest first, so a renderer can honour a magnitude limit by taking a
  // prefix of the table and constellation figures keep stable indices.
  const sorted = [...stars].sort(
    (a, b) => a.magnitude - b.magnitude || a.hr - b.hr,
  );
  const positions = new Float32Array(sorted.length * 3),
    motions = new Float32Array(sorted.length * 3),
    magnitudes = new Float32Array(sorted.length),
    colorIndices = new Float32Array(sorted.length);
  sorted.forEach((star, index) => {
    const { position, motion } = starVectors(star);
    positions.set(position, index * 3);
    motions.set(motion, index * 3);
    magnitudes[index] = star.magnitude;
    colorIndices[index] = star.colorIndex;
  });
  return { positions, motions, magnitudes, colorIndices };
}

type FigureSource = {
  features: {
    id: string;
    geometry: { coordinates: [number, number][][] };
  }[];
};
function directionFromDegrees(longitude: number, latitude: number) {
  const ra = longitude * degree,
    dec = latitude * degree;
  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ] as [number, number, number];
}

/**
 * Figure vertices are published as coordinates rather than star identifiers.
 * Snapping each one to the nearest catalogued star makes every drawn line end
 * on a star the viewer can actually see, and keeps the figures following the
 * same proper motion as the points they join.
 */
export function snapFigures(
  figures: FigureSource,
  catalog: StarCatalog,
  tolerance = 0.6 * degree,
) {
  const count = catalog.magnitudes.length;
  const constellations: Constellation[] = [];
  const unmatched: string[] = [];
  for (const feature of figures.features) {
    if (!Object.hasOwn(constellationNames, feature.id))
      throw new Error(`No name for constellation ${feature.id}`);
    const lines: number[] = [];
    for (const polyline of feature.geometry.coordinates) {
      let previous: number | null = null;
      for (const [longitude, latitude] of polyline) {
        const target = directionFromDegrees(longitude, latitude);
        let nearest = -1,
          best = Math.cos(tolerance);
        for (let index = 0; index < count; index++) {
          const dot =
            target[0] * catalog.positions[index * 3] +
            target[1] * catalog.positions[index * 3 + 1] +
            target[2] * catalog.positions[index * 3 + 2];
          if (dot > best) {
            best = dot;
            nearest = index;
          }
        }
        if (nearest < 0) {
          unmatched.push(
            `${feature.id} ${longitude.toFixed(3)},${latitude.toFixed(3)}`,
          );
          previous = null;
          continue;
        }
        if (previous !== null && previous !== nearest)
          lines.push(previous, nearest);
        previous = nearest;
      }
    }
    if (lines.length === 0) throw new Error(`No figure for ${feature.id}`);
    constellations.push({ id: feature.id, lines });
  }
  return { constellations, unmatched };
}

function readSource(root: string, source: { file: string; url: string }) {
  const path = resolve(root, source.file);
  try {
    return readFileSync(path);
  } catch {
    throw new Error(
      `Missing ${path}. Download it first: curl -o ${path} "${source.url}"`,
    );
  }
}

export function generateStarCatalog(inputRoot: string, outputRoot: string) {
  const catalogBytes = readSource(inputRoot, starSources.catalog);
  const stars = parseBrightStars(gunzipSync(catalogBytes).toString('latin1'));
  if (stars.length < 9000)
    throw new Error(`Only ${stars.length} stars parsed; check the source.`);
  const catalog = buildCatalog(stars);
  const figures = JSON.parse(
    readSource(inputRoot, starSources.figures).toString('utf8'),
  ) as FigureSource;
  const snapped = snapFigures(figures, catalog);
  mkdirSync(outputRoot, { recursive: true });
  const catalogFile = resolve(outputRoot, 'bright-stars.bin');
  writeFileSync(catalogFile, Buffer.from(encodeStarCatalog(catalog)));
  const figuresFile = resolve(outputRoot, 'constellations.json');
  // One figure per line: a committed asset should stay reviewable, and a
  // pretty-printed index array would spread each one over a hundred lines.
  const figureLines = snapped.constellations
    .map(
      (figure) =>
        `  {"id": ${JSON.stringify(figure.id)}, "lines": [${figure.lines.join(',')}]}`,
    )
    .join(',\n');
  writeFileSync(
    figuresFile,
    `{\n "starCount": ${stars.length},\n "constellations": [\n${figureLines}\n ]\n}\n`,
  );
  writeFileSync(
    resolve(outputRoot, 'source-manifest.json'),
    `${JSON.stringify(
      Object.values(starSources).map((source) => ({
        source: source.title,
        url: source.url,
        license: source.license,
      })),
      null,
      2,
    )}\n`,
  );
  return {
    stars: stars.length,
    constellations: snapped.constellations.length,
    segments: snapped.constellations.reduce(
      (total, figure) => total + figure.lines.length / 2,
      0,
    ),
    unmatched: snapped.unmatched,
    bytes: statSync(catalogFile).size + statSync(figuresFile).size,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = generateStarCatalog(
    resolve(process.argv[2] ?? 'work/stars'),
    resolve(process.argv[3] ?? 'public/sky'),
  );
  if (result.unmatched.length > 0)
    console.warn(
      `Unmatched figure vertices: ${result.unmatched.slice(0, 10).join('; ')}`,
    );
  console.log(
    `Sky: ${result.stars} stars, ${result.constellations} constellations, ${result.segments} segments, ${(result.bytes / 1024).toFixed(0)} KiB.`,
  );
}
