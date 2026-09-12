import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type sharpModule from 'sharp/lib/index.js';
import { languages, localePath, translator } from '../lib/i18n';
import { catalogEntries, seoLocales } from '../lib/seo';

// Sharp is a CommonJS export; load it with Node while retaining its bundled declarations.
const require = createRequire(import.meta.url);
const sharp = require('sharp') as typeof sharpModule;

const publicDir = resolve('public');
const outputDir = resolve(publicDir, 'og');

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

function wrapText(value: string, length: number) {
  if (/\s/.test(value)) {
    const lines: string[] = [];
    let current = '';
    for (const word of value.trim().split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > length) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }
  const characters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
    ({ segment }) => segment,
  );
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += length) {
    lines.push(characters.slice(index, index + length).join(''));
  }
  return lines.slice(0, 3);
}

function renderImage({
  name,
  description,
  color,
  observatoryName,
  languageName,
}: {
  name: string;
  description: string;
  color: string;
  observatoryName: string;
  languageName: string;
}) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#d9c49a';
  const descriptionLines = wrapText(description, 44);
  const descriptionSvg = descriptionLines
    .map(
      (line, index) =>
        `<text x="92" y="${390 + index * 34}" fill="#b7c1d0" font-size="24">${escapeXml(line)}</text>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="78%" cy="20%" r="70%">
      <stop offset="0" stop-color="${safeColor}" stop-opacity=".38" />
      <stop offset="1" stop-color="#05080e" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0" stop-color="${safeColor}" stop-opacity=".9" />
      <stop offset="1" stop-color="#ffffff" stop-opacity=".05" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#05080e" />
  <rect width="1200" height="630" fill="url(#glow)" />
  <circle cx="980" cy="146" r="112" fill="${safeColor}" fill-opacity=".12" />
  <circle cx="980" cy="146" r="76" fill="${safeColor}" fill-opacity=".2" />
  <circle cx="980" cy="146" r="42" fill="${safeColor}" fill-opacity=".78" />
  <text x="92" y="112" fill="#e0c99c" font-size="22" letter-spacing="6">ORBIT</text>
  <text x="92" y="245" fill="#f1e8d7" font-size="66" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(name)}</text>
  <rect x="92" y="286" width="620" height="2" fill="url(#line)" />
  ${descriptionSvg}
  <text x="92" y="552" fill="#77859a" font-size="18">${escapeXml(observatoryName)} · ${escapeXml(languageName)}</text>
</svg>
`;
}

rmSync(outputDir, { recursive: true, force: true });

for (const locale of seoLocales) {
  const t = translator(locale);
  for (const entry of catalogEntries()) {
    const name = t(entry.data.name);
    const description = t(entry.data.description);
    const color = entry.data.color;
    const outputPath = resolve(
      outputDir,
      localePath(locale),
      'bodies',
      `${entry.data.id}.png`,
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    await sharp(Buffer.from(renderImage({
      name,
      description,
      color,
      observatoryName: t('太阳系观测台'),
      languageName: languages[locale].name,
    })))
      .png()
      .toFile(outputPath);
  }
}
