import { encode } from 'uqr';

/** Longest edge of a shared screenshot; keeps the file small enough to attach. */
const maxShareEdge = 1600;

const shareFont = "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** Clear margin a scanner needs around the symbol, in modules. */
const qrQuietModules = 4;

export type ShareImageSize = { width: number; height: number };
export type ShareImage = ShareImageSize & { blob: Blob };

export type QrBadgeLayout = {
  /** Side of one module, in whole pixels so the symbol stays crisp. */
  unit: number;
  /** Side of the symbol itself. */
  symbol: number;
  /** Quiet zone between the symbol and the card edge. */
  quiet: number;
  /** Side of the card carrying the symbol. */
  card: number;
};

/** Scale a captured frame down to the share limit while keeping its framing. */
export function shareImageSize(
  width: number,
  height: number,
  maxEdge = maxShareEdge,
): ShareImageSize {
  if (!Number.isFinite(width) || !Number.isFinite(height))
    return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Size the scannable badge from the frame it sits on. Modules are whole pixels
 * so neighbouring ones cannot blur together, which is what a camera pointed at
 * a screen trips over first.
 */
export function qrBadgeLayout(
  width: number,
  height: number,
  modules: number,
): QrBadgeLayout | null {
  if (!Number.isInteger(modules) || modules <= 0) return null;
  const shortest = Math.min(width, height);
  if (!Number.isFinite(shortest) || shortest <= 0) return null;
  const target = Math.min(236, Math.max(132, Math.round(shortest * 0.22)));
  const unit = Math.max(2, Math.floor(target / (modules + qrQuietModules * 2)));
  const symbol = unit * modules;
  const quiet = unit * qrQuietModules;
  const card = symbol + quiet * 2;
  return card > shortest ? null : { unit, symbol, quiet, card };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () =>
      reject(new Error('Capture could not be decoded')),
    );
    image.src = source;
  });
}

function cardPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  if (context.roundRect) context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
}

/**
 * Stamp the link onto the frame as a scannable badge, so the image on its own
 * reopens the view. Drawn dark on a solid light card rather than over the sky,
 * because an inverted symbol on a busy background is what scanners refuse.
 * Returns the width it claimed, or null when the link cannot be encoded.
 */
function drawQrBadge(
  context: CanvasRenderingContext2D,
  link: string,
  frame: { width: number; height: number; margin: number },
) {
  let symbol;
  try {
    symbol = encode(link, { ecc: 'M', border: 0 });
  } catch {
    return null;
  }
  const layout = qrBadgeLayout(frame.width, frame.height, symbol.size);
  if (!layout) return null;
  const label = Math.round(layout.card * 0.2);
  const left = frame.width - frame.margin - layout.card;
  const top = frame.height - frame.margin - layout.card - label;

  context.save();
  cardPath(
    context,
    left,
    top,
    layout.card,
    layout.card + label,
    layout.unit * 2,
  );
  context.fillStyle = '#ffffff';
  context.fill();
  context.fillStyle = '#0a0f18';
  for (let row = 0; row < symbol.size; row++) {
    for (let column = 0; column < symbol.size; column++) {
      if (!symbol.data[row][column]) continue;
      context.fillRect(
        left + layout.quiet + column * layout.unit,
        top + layout.quiet + row * layout.unit,
        layout.unit,
        layout.unit,
      );
    }
  }
  context.fillStyle = '#2a3342';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `600 ${Math.round(label * 0.46)}px ${shareFont}`;
  context.letterSpacing = `${Math.max(1, Math.round(label * 0.1))}px`;
  context.fillText(
    'ORBIT',
    left + layout.card / 2,
    top + layout.card + label / 2,
  );
  context.restore();
  return layout.card;
}

/**
 * Lay the observation caption over the captured frame so a screenshot that
 * leaves the site still says which body it shows, when, and how to reopen it.
 */
export async function composeShareImage(
  capture: string,
  stamp: { subject: string; moment: string; link: string },
): Promise<ShareImage | null> {
  const source = await loadImage(capture);
  const { width, height } = shareImageSize(
    source.naturalWidth,
    source.naturalHeight,
  );
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);

  const scale = Math.max(0.62, Math.min(1.25, width / 1280));
  const margin = Math.round(34 * scale);
  const band = Math.round(120 * scale);
  const shade = context.createLinearGradient(0, height - band, 0, height);
  shade.addColorStop(0, 'rgba(6, 10, 18, 0)');
  shade.addColorStop(1, 'rgba(6, 10, 18, 0.82)');
  context.fillStyle = shade;
  context.fillRect(0, height - band, width, band);

  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.fillStyle = '#f2e6cf';
  context.font = `500 ${Math.round(27 * scale)}px ${shareFont}`;
  context.fillText(
    stamp.subject,
    margin,
    height - margin - Math.round(26 * scale),
  );
  context.fillStyle = '#9fb0c4';
  context.font = `400 ${Math.round(17 * scale)}px ${shareFont}`;
  context.fillText(stamp.moment, margin, height - margin);

  // The badge carries the wordmark; without it, the wordmark stands alone.
  if (drawQrBadge(context, stamp.link, { width, height, margin }) === null) {
    context.textAlign = 'right';
    context.fillStyle = '#dfc99f';
    context.font = `600 ${Math.round(19 * scale)}px ${shareFont}`;
    context.letterSpacing = `${Math.round(3 * scale)}px`;
    context.fillText('ORBIT', width - margin, height - margin);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  return blob && { blob, width, height };
}
