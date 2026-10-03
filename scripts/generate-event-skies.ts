import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderSkyChartImage } from './lib/sky-chart-image';
import {
  eventOccurrences,
  occurrenceImagePath,
} from '../lib/event-occurrences';
import { renderOccurrenceSkyChart } from '../lib/occurrence-sky-chart';
import { seoLocales } from '../lib/seo';
import {
  parseStarCatalog,
  parseConstellationFigures,
  starCount,
} from '../lib/star-catalog';

const bytes = readFileSync('public/sky/bright-stars.bin');
const stars = parseStarCatalog(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const figures = parseConstellationFigures(
  JSON.parse(readFileSync('public/sky/constellations.json', 'utf8')),
  starCount(stars),
);
for (const event of eventOccurrences) {
  for (const locale of seoLocales) {
    const svg = renderOccurrenceSkyChart(event, locale, stars, figures);
    const path = resolve('public', occurrenceImagePath(event, locale).slice(1));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path.replace(/\.webp$/, '.svg'), svg);
    writeFileSync(path, await renderSkyChartImage(svg));
  }
}
console.log(
  `Generated ${eventOccurrences.length * seoLocales.length} localized event sky charts from the shipped star catalog and ephemeris.`,
);
