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
export function entryTexturePath(entry: CatalogEntry): string | null {
  const texture =
    entry.kind === 'body'
      ? (entry.data.texture ?? entry.data.id)
      : entry.kind === 'moon' || entry.kind === 'asteroid'
        ? entry.data.texture
        : 'comet_nucleus';
  return texture ? texturePath(texture, false, 2048) : null;
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
  if (entry.kind === 'asteroid') {
    const credits: Record<string, PortraitCredit> = {
      ceres: {
        name: 'NASA Dawn / USGS; CelestiaContent',
        url: 'https://sbn.psi.edu/pds/resource/dawn/dwncfcshape.html',
        license: 'https://pds.nasa.gov/',
      },
      pallas: {
        name: 'Vernazza et al. (2021), VLT/SPHERE',
        url: 'https://doi.org/10.1051/0004-6361/202141781',
        license: 'https://creativecommons.org/licenses/by/4.0/',
      },
      juno: {
        name: 'Vernazza et al. (2021), VLT/SPHERE',
        url: 'https://doi.org/10.1051/0004-6361/202141781',
        license: 'https://creativecommons.org/licenses/by/4.0/',
      },
      vesta: {
        name: 'NASA Dawn / USGS; CelestiaContent',
        url: 'https://sbn.psi.edu/pds/resource/dawn/dwnvfcshape.html',
        license: 'https://pds.nasa.gov/',
      },
      psyche: {
        name: 'Shepard et al. (2021)',
        url: 'https://doi.org/10.3847/PSJ/abfdba',
        license: 'https://creativecommons.org/licenses/by/4.0/',
      },
      eros: {
        name: 'NEAR / Phil Stooke / NASA PDS',
        url: 'https://sbn.psi.edu/pds/resource/erosshape.html',
        license: 'https://creativecommons.org/licenses/by/3.0/',
      },
      itokawa: {
        name: 'Hayabusa / Phil Stooke / NASA PDS',
        url: 'https://sbn.psi.edu/pds/resource/itokawashape.html',
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
      bennu: {
        name: 'OSIRIS-REx Altimetry Working Group / USGS',
        url: 'https://arcnav.psi.edu/urn:nasa:pds:orex.altimetry:data_derived_altimetry_global_models',
        license: 'https://creativecommons.org/licenses/by/3.0/',
      },
      ryugu: {
        name: 'Hayabusa2 / ISAS-JAXA',
        url: 'https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/Watanabe_2019/README.html',
        license: 'https://creativecommons.org/licenses/by/4.0/',
      },
    };
    const credit = credits[entry.data.id];
    if (!credit)
      throw new Error(`Missing asteroid portrait credit for ${entry.data.id}`);
    return credit;
  }
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
