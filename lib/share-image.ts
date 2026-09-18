/** Longest edge of a shared screenshot; keeps the file small enough to attach. */
const maxShareEdge = 1600;

const shareFont = "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";

export type ShareImageSize = { width: number; height: number };
export type ShareImage = ShareImageSize & { blob: Blob };

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

/**
 * Lay the observation caption over the captured frame so a screenshot that
 * leaves the site still says which body it shows and when.
 */
export async function composeShareImage(
  capture: string,
  caption: { subject: string; moment: string },
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
    caption.subject,
    margin,
    height - margin - Math.round(26 * scale),
  );
  context.fillStyle = '#9fb0c4';
  context.font = `400 ${Math.round(17 * scale)}px ${shareFont}`;
  context.fillText(caption.moment, margin, height - margin);

  context.textAlign = 'right';
  context.fillStyle = '#dfc99f';
  context.font = `600 ${Math.round(19 * scale)}px ${shareFont}`;
  context.letterSpacing = `${Math.round(3 * scale)}px`;
  context.fillText('ORBIT', width - margin, height - margin);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  return blob && { blob, width, height };
}
