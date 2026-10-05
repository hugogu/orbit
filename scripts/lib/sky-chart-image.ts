import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp/lib/index.js';

const fontfile = fileURLToPath(
  new URL('../assets/orbit-share.otf', import.meta.url),
);
const supportedCharacters = new Set(
  readFileSync(
    new URL('../assets/profile-font-characters.txt', import.meta.url),
    'utf8',
  ),
);
const decodeXml = (value: string) =>
  value.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, entity: string) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]!,
  );

/** Rasterize labels explicitly with the bundled font, including on fontless build hosts. */
export async function renderSkyChartImage(svg: string) {
  const labels = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)];
  const overlays = await Promise.all(
    labels.map(async ([, attributes, escaped]) => {
      const attrs = new Map(
        [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(
          ([, key, value]) => [key, value],
        ),
      );
      const text = decodeXml(escaped);
      for (const character of text)
        if (!supportedCharacters.has(character))
          throw new Error(
            `Sky-chart font lacks '${character}'; update scripts/assets following its README.`,
          );
      const size = Number(attrs.get('font-size'));
      const { data, info } = await sharp({
        text: {
          text: `<span foreground="${attrs.get('fill')}">${escaped}</span>`,
          font: `Orbit Share ${size}`,
          fontfile,
          rgba: true,
          dpi: 72,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true });
      const maxWidth = 1360;
      let finalData = data;
      let finalWidth = info.width;
      if (finalWidth > maxWidth) {
        finalData = await sharp(data)
          .resize({ width: maxWidth })
          .png()
          .toBuffer();
        finalWidth = maxWidth;
      }
      const anchor = attrs.get('text-anchor');
      const left =
        Number(attrs.get('x')) -
        (anchor === 'end'
          ? finalWidth
          : anchor === 'middle'
            ? finalWidth / 2
            : 0);
      const clampLeft = Math.max(
        0,
        Math.min(1400 - finalWidth, Math.round(left)),
      );
      const clampTop = Math.max(
        0,
        Math.min(820 - info.height, Math.round(Number(attrs.get('y')) - size)),
      );
      return {
        input: finalData,
        left: clampLeft,
        top: clampTop,
      };
    }),
  );
  return sharp(Buffer.from(svg.replace(/<text\b[^>]*>[^<]*<\/text>/g, '')))
    .composite(overlays)
    .webp({ quality: 92 })
    .toBuffer();
}
