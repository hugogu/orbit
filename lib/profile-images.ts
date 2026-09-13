import { localePath, type Locale } from './i18n';
import type { CatalogEntry } from './seo';
import { texturePath } from './texture-quality';

// Versioned paths let crawlers distinguish redesigned images from cached cards.
export const profileImageVersion = 'v2';
export function portraitPath(id: string) {
  return `/media/${profileImageVersion}/bodies/${encodeURIComponent(id)}.webp`;
}
export function squareImagePath(id: string) {
  return `/media/${profileImageVersion}/bodies/${encodeURIComponent(id)}.jpg`;
}
export function wideImagePath(locale: Locale, id: string) {
  return `/og/${profileImageVersion}/${localePath(locale)}/bodies/${encodeURIComponent(id)}.jpg`;
}
export function entryTexturePath(entry: CatalogEntry) {
  const texture =
    entry.kind === 'body'
      ? (entry.data.texture ?? entry.data.id)
      : entry.kind === 'moon' || entry.kind === 'asteroid'
        ? entry.data.texture
        : 'comet_nucleus';
  return texturePath(texture, false, 2048);
}

const illustrativeIds = new Set([
  'pluto',
  'moon-europa',
  'moon-callisto',
  'moon-enceladus',
  'moon-mimas',
  'moon-iapetus',
  'moon-charon',
  'moon-nereid',
]);
export function isIllustrativePortrait(entry: CatalogEntry) {
  return (
    entry.kind === 'comet' ||
    entry.kind === 'asteroid' ||
    illustrativeIds.has(entry.data.id)
  );
}
export type PortraitCredit = {
  name: string;
  url: string;
  license: string;
};
export function portraitCredit(entry: CatalogEntry): PortraitCredit {
  if (
    (entry.kind === 'body' && entry.data.id !== 'pluto') ||
    entry.data.id === 'moon-moon'
  ) {
    return {
      name: 'Solar System Scope',
      url: 'https://www.solarsystemscope.com/textures/',
      license: 'https://creativecommons.org/licenses/by/4.0/',
    };
  }
  const contributors: Record<string, string> = {
    'moon-phobos': 'Askaniy Anpilogov; Phil Stooke / NASA PDS',
    'moon-deimos': 'Phil Stooke / NASA PDS',
    'moon-io':
      'ItzImcool; NASA/JPL-Caltech/ASI/USGS; NASA/JPL/SwRI/MSSS; AstroChara',
    'moon-ganymede':
      'Askaniy Anpilogov; NASA/JPL-Caltech/ASI/USGS; Björn Jónsson; Brian Swift',
    'moon-titan':
      'Askaniy Anpilogov; Pedro Garcia; AstroChara; Martonchik & Orton; Karkoschka et al.; Seignovert et al.; NASA/JPL-Caltech/ASI/USGS; Caltech-JPL/University of Arizona/LPG-University of Nantes-CNRS',
    'moon-triton': 'Askaniy Anpilogov; NASA/JPL-Caltech/ASI/USGS',
  };
  const license = [
    'moon-miranda',
    'moon-ariel',
    'moon-umbriel',
    'moon-titania',
    'moon-oberon',
  ].includes(entry.data.id)
    ? 'https://creativecommons.org/licenses/by-sa/4.0/'
    : entry.data.id === 'moon-deimos'
      ? 'https://creativecommons.org/publicdomain/zero/1.0/'
      : ['moon-phobos', 'moon-ganymede', 'moon-titan', 'moon-triton'].includes(
            entry.data.id,
          )
        ? 'https://creativecommons.org/licenses/by/3.0/'
        : 'https://creativecommons.org/licenses/by/4.0/';
  const name = isIllustrativePortrait(entry)
    ? 'cubicApocalypse / CelestiaContent'
    : (contributors[entry.data.id] ??
      `ItzImcool; Paul Schenk; NASA/JPL/Ted Stryk${entry.data.id === 'moon-umbriel' ? '; Phil Stooke' : ''}`);
  return { name, url: '/textures/satellites/CREDITS.md', license };
}
