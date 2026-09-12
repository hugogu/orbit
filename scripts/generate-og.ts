import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp/lib/index.js';
import { languages, translator } from '../lib/i18n';
import { catalogEntries, seoLocales } from '../lib/seo';
import {
  portraitPath,
  squareImagePath,
  wideImagePath,
  portraitCredit,
} from '../lib/profile-images';
import { renderPortrait } from './lib/render-portrait';
import { renderCardLabels, imageAttribution } from './lib/share-card';

function output(path: string) {
  const file = resolve('public', path.replace(/^\//, ''));
  mkdirSync(dirname(file), { recursive: true });
  return file;
}
// Square thumbnails contain only the subject. Wide cards keep it inside the central square crop.
rmSync(resolve('public/og'), { recursive: true, force: true });
const entries = catalogEntries();
for (const entry of entries) {
  const image = await renderPortrait(entry);
  const attribution = imageAttribution(entry, portraitCredit(entry));
  const portrait = await image.png().toBuffer();
  await sharp(portrait)
    .webp({ quality: 88 })
    .withXmp(attribution)
    .toFile(output(portraitPath(entry.data.id)));
  await sharp(portrait)
    .resize(600, 600)
    .jpeg({ quality: 88 })
    .withXmp(attribution)
    .toFile(output(squareImagePath(entry.data.id)));
  const planet = await sharp(portrait).resize(590, 590).png().toBuffer();
  for (const locale of seoLocales) {
    const t = translator(locale);
    const name = t(entry.data.name);
    const labels = await renderCardLabels(
      name,
      languages[locale].name,
      t('太阳系观测台'),
    );
    await sharp({
      create: { width: 1200, height: 630, channels: 3, background: '#070c15' },
    })
      .composite([{ input: planet, left: 305, top: 12 }, ...labels])
      .jpeg({ quality: 90 })
      .withXmp(attribution)
      .toFile(output(wideImagePath(locale, entry.data.id)));
  }
}
console.log(
  `Generated ${entries.length} portraits, ${entries.length} square previews and ${entries.length * seoLocales.length} localized wide cards.`,
);
