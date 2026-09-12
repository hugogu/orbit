import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp/lib/index.js';
import type { CatalogEntry } from '../../lib/seo';
import { absoluteSiteUrl } from '../../lib/seo';
import type { portraitCredit } from '../../lib/profile-images';

const fontfile = fileURLToPath(
  new URL('../assets/orbit-share.otf', import.meta.url),
);
const supportedCharacters = new Set(
  readFileSync(
    new URL('../assets/profile-font-characters.txt', import.meta.url),
    'utf8',
  ),
);
function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
}

export async function renderCardLabels(
  name: string,
  language: string,
  subtitle: string,
) {
  const labels = [
    { text: 'ORBIT', size: 23, top: 37, left: 48, color: '#dac69f' },
    { text: language, size: 17, top: 39, right: 48, color: '#8b9aaf' },
    { text: name, size: 40, top: 527, left: 48, color: '#f0e9dc' },
    { text: subtitle, size: 17, top: 583, left: 48, color: '#99a8bd' },
    {
      text: 'orbits.observer',
      size: 16,
      top: 583,
      right: 48,
      color: '#99a8bd',
    },
  ];
  return Promise.all(
    labels.map(async (label) => {
      for (const character of label.text) {
        if (!supportedCharacters.has(character))
          throw new Error(
            `Share-card font lacks '${character}'; update scripts/assets following its README.`,
          );
      }
      const { data, info } = await sharp({
        text: {
          text: `<span foreground="${label.color}">${escapeXml(label.text)}</span>`,
          font: `Orbit Share ${label.size}`,
          fontfile,
          rgba: true,
          dpi: 72,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true });
      const width = Math.min(info.width, 750);
      const input =
        info.width > width
          ? await sharp(data).resize({ width }).png().toBuffer()
          : data;
      return {
        input,
        top: label.top,
        left: label.left ?? 1200 - label.right! - width,
      };
    }),
  );
}

export function imageAttribution(
  entry: CatalogEntry,
  credit: ReturnType<typeof portraitCredit>,
) {
  const source = credit.url.startsWith('/')
    ? absoluteSiteUrl(credit.url)
    : credit.url;
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">
    <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(entry.data.en)} — ORBIT illustrative render</rdf:li></rdf:Alt></dc:title>
    <dc:creator><rdf:Seq><rdf:li>${escapeXml(credit.name)}; rendering by ORBIT</rdf:li></rdf:Seq></dc:creator>
    <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Adapted texture, lighting and projection. ${escapeXml(credit.license)}</rdf:li></rdf:Alt></dc:rights>
    <dc:source>${escapeXml(source)}</dc:source>
    <xmpRights:WebStatement>${escapeXml(credit.license)}</xmpRights:WebStatement>
  </rdf:Description></rdf:RDF></x:xmpmeta>`;
}
