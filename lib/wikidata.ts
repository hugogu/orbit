/**
 * Wikidata names each catalogue entry for search engines. schema.org has no
 * type for a celestial body, so a profile describes its body as a `Place`
 * whose `additionalType` is the Wikidata class and whose `sameAs` is the
 * Wikidata item: that pair, not the page's own wording, is what tells a
 * crawler which body the page is about.
 *
 * Each item was resolved from the body's English Wikipedia article, then
 * checked against its Wikidata label and parent body (P397), on 2026-09-24.
 * Resolve an article rather than a bare name: "Nereid" alone lands on the sea
 * nymphs, not on Neptune's moon.
 */
export const wikidataClasses = {
  star: 'Q523',
  planet: 'Q634',
  dwarfPlanet: 'Q2199',
  moon: 'Q2537',
  asteroid: 'Q3863',
  comet: 'Q3559',
} as const;

export type WikidataClass = keyof typeof wikidataClasses;

/** The planetary system every catalogue entry belongs to. */
export const solarSystemItem = 'Q544';

export const wikidataEntities: Record<
  string,
  { item: string; class: WikidataClass }
> = {
  sun: { item: 'Q525', class: 'star' },
  mercury: { item: 'Q308', class: 'planet' },
  venus: { item: 'Q313', class: 'planet' },
  earth: { item: 'Q2', class: 'planet' },
  mars: { item: 'Q111', class: 'planet' },
  jupiter: { item: 'Q319', class: 'planet' },
  saturn: { item: 'Q193', class: 'planet' },
  uranus: { item: 'Q324', class: 'planet' },
  neptune: { item: 'Q332', class: 'planet' },
  pluto: { item: 'Q339', class: 'dwarfPlanet' },
  'moon-moon': { item: 'Q405', class: 'moon' },
  'moon-phobos': { item: 'Q7547', class: 'moon' },
  'moon-deimos': { item: 'Q7548', class: 'moon' },
  'moon-io': { item: 'Q3123', class: 'moon' },
  'moon-europa': { item: 'Q3143', class: 'moon' },
  'moon-ganymede': { item: 'Q3169', class: 'moon' },
  'moon-callisto': { item: 'Q3134', class: 'moon' },
  'moon-titan': { item: 'Q2565', class: 'moon' },
  'moon-enceladus': { item: 'Q3303', class: 'moon' },
  'moon-mimas': { item: 'Q15034', class: 'moon' },
  'moon-iapetus': { item: 'Q17958', class: 'moon' },
  'moon-miranda': { item: 'Q3352', class: 'moon' },
  'moon-ariel': { item: 'Q3343', class: 'moon' },
  'moon-umbriel': { item: 'Q3338', class: 'moon' },
  'moon-titania': { item: 'Q3322', class: 'moon' },
  'moon-oberon': { item: 'Q3332', class: 'moon' },
  'moon-triton': { item: 'Q3359', class: 'moon' },
  'moon-nereid': { item: 'Q16076', class: 'moon' },
  'moon-charon': { item: 'Q6604', class: 'moon' },
  halley: { item: 'Q23054', class: 'comet' },
  encke: { item: 'Q166940', class: 'comet' },
  '67p': { item: 'Q844672', class: 'comet' },
  'hale-bopp': { item: 'Q69854', class: 'comet' },
  ceres: { item: 'Q596', class: 'dwarfPlanet' },
  pallas: { item: 'Q3002', class: 'asteroid' },
  juno: { item: 'Q3009', class: 'asteroid' },
  vesta: { item: 'Q3030', class: 'asteroid' },
  psyche: { item: 'Q107517', class: 'asteroid' },
  eros: { item: 'Q16711', class: 'asteroid' },
  itokawa: { item: 'Q149374', class: 'asteroid' },
  bennu: { item: 'Q11558', class: 'asteroid' },
  ryugu: { item: 'Q1385178', class: 'asteroid' },
};

/** A new catalogue entry must be identified here before its profile builds. */
export function wikidataEntity(id: string) {
  const entity = wikidataEntities[id];
  if (!entity)
    throw new Error(`No Wikidata item is recorded for catalogue entry ${id}.`);
  return entity;
}

export function wikidataUrl(id: string) {
  return `https://www.wikidata.org/wiki/${id}`;
}
