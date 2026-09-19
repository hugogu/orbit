import { encode } from 'uqr';

/** Longest edge of a shared screenshot; keeps the file small enough to attach. */
const maxShareEdge = 1600;

const shareFont = "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";

/** Clear margin a scanner needs around the symbol, in modules. */
export const qrQuietModules = 4;

/**
 * Badge palette. A scanner separates modules by luminance, not by brightness,
 * so the card can sit far down towards the sky it lies on and still read
 * cleanly. These stay muted enough not to glare over a dark scene while
 * holding a wide margin over the ratio any scanner asks for; the contrast test
 * guards that trade.
 */
export const qrBadgePalette = {
  card: '#a8b6c8',
  module: '#070c15',
  label: '#1d2635',
  edge: 'rgba(7, 12, 21, 0.55)',
  /**
   * The code shown in the dialog is a control among buttons, not something
   * lying on a picture, so it carries their weight instead of receding the way
   * the badge on the frame has to.
   */
  screen: '#c6d1e0',
};

/**
 * Largest whole-pixel symbol for the requested size at this display's
 * resolution. Returning the drawn side lets the caller present the canvas at
 * exactly those pixels, because a resampled module is what a camera fails on.
 * A module never falls below one pixel, so a size too small to hold the symbol
 * returns a side larger than the one asked for rather than an unreadable
 * smudge; callers that must not overflow should check it.
 */
export function qrCanvasSize(size: number, modules: number, ratio: number) {
  const across = modules + qrQuietModules * 2;
  const unit = Math.max(1, Math.floor((size * ratio) / across));
  return { unit, side: unit * across };
}

function channelLuminance(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour, per WCAG. */
export function relativeLuminance(colour: string) {
  const hex = colour.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((at) =>
    channelLuminance(Number.parseInt(hex.slice(at, at + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Contrast between two `#rrggbb` colours, as the familiar n:1 ratio. */
export function contrastRatio(one: string, other: string) {
  const [dark, light] = [relativeLuminance(one), relativeLuminance(other)].sort(
    (a, b) => a - b,
  );
  return (light + 0.05) / (dark + 0.05);
}

export type ShareImageSize = { width: number; height: number };
export type ShareImage = ShareImageSize & { blob: Blob };

export type SaveRoute = 'album' | 'download';

/**
 * Where a viewer who asks to keep the frame should receive it. No page may
 * write to a photo library itself, and a phone's download folder is not
 * anywhere a social application looks for a picture, so on a touch screen the
 * image goes to the system sheet instead: the sheet's own save action is what
 * files it in the album, and the applications listed beside that action take
 * the picture straight from here. A pointer that is not coarse is a desktop,
 * where a file on disk is the useful result.
 */
export function saveImageRoute(
  sheetTakesImages: boolean,
  touchScreen: boolean,
): SaveRoute {
  return sheetTakesImages && touchScreen ? 'album' : 'download';
}

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
 * reopens the view. The symbol sits dark on its own card rather than inverted
 * over the sky, which is what scanners refuse, but the card is toned well down
 * from white and its edge is dissolved by a shadow, so it settles into a dark
 * frame instead of glaring out of it.
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
    layout.unit * 3,
  );
  // A soft shadow dissolves the card edge into the sky instead of cutting a
  // hard rectangle out of it. It sits under the card, never over the modules.
  context.shadowColor = 'rgba(3, 6, 12, 0.55)';
  context.shadowBlur = layout.unit * 6;
  context.fillStyle = qrBadgePalette.card;
  context.fill();
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.strokeStyle = qrBadgePalette.edge;
  context.lineWidth = Math.max(1, Math.round(layout.unit / 3));
  context.stroke();
  context.fillStyle = qrBadgePalette.module;
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
  context.fillStyle = qrBadgePalette.label;
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
