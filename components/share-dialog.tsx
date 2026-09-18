'use client';
import { track } from '@vercel/analytics';
import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Download, Link2, Share2 } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { composeShareImage } from '../lib/share-image';
import { absoluteSiteUrl } from '../lib/seo';
import {
  encodeShareView,
  shareDateLabel,
  shareMomentLabel,
  sharePath,
  shareSubjectName,
  type ShareView,
} from '../lib/share-view';
import type { SceneHandle } from './solar-scene';

type Preview =
  | { status: 'pending' }
  | { status: 'ready'; url: string; file: File; width: number; height: number }
  | { status: 'failed' };

type CopyStatus = 'idle' | 'copied' | 'manual';

function shareFileName(view: ShareView) {
  const subject = view.selected ?? view.region ?? 'solar-system';
  return `orbit-${subject}-${new Date(view.time).toISOString().slice(0, 10)}.png`;
}

/**
 * Shares the observation on screen: the link restores the same moment, subject
 * and framing, while the captured frame travels with it wherever the target
 * application accepts an image.
 */
export default function ShareDialog({
  open,
  onOpenChange,
  view,
  capture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ShareView;
  capture: SceneHandle['capture'];
}) {
  const { t, locale } = useI18n();
  // Both results are tagged with the snapshot they belong to, so reopening the
  // dialog on a new moment shows a fresh capture without a resetting render.
  const [captured, setCaptured] = useState<{
    view: ShareView;
    preview: Preview;
  } | null>(null);
  const [copied, setCopied] = useState<{
    view: ShareView;
    status: CopyStatus;
  } | null>(null);
  const preview: Preview =
    captured?.view === view ? captured.preview : { status: 'pending' };
  const status: CopyStatus = copied?.view === view ? copied.status : 'idle';
  const subject = shareSubjectName(view, t);
  const moment = shareMomentLabel(view.time);
  const date = shareDateLabel(view.time, locale);
  const heading = view.selected
    ? t('{{name}}，{{date}}', { name: subject, date })
    : t('太阳系，{{date}}', { date });
  const url = absoluteSiteUrl(
    `${sharePath(locale, view.selected)}?${encodeShareView(view).toString()}`,
  );

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    void (async () => {
      let result: Preview = { status: 'failed' };
      try {
        // Read the frame before awaiting: the drawing buffer is not preserved.
        const frame = capture();
        const image = frame
          ? await composeShareImage(frame, { subject, moment })
          : null;
        if (image) {
          objectUrl = URL.createObjectURL(image.blob);
          result = {
            status: 'ready',
            url: objectUrl,
            file: new File([image.blob], shareFileName(view), {
              type: 'image/png',
            }),
            width: image.width,
            height: image.height,
          };
        }
      } catch {
        /* The link is still shareable without a screenshot. */
      }
      if (cancelled) return;
      setCaptured({ view, preview: result });
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, capture, view, subject, moment]);

  async function copyLink() {
    let result: CopyStatus = 'manual';
    try {
      await navigator.clipboard.writeText(url);
      result = 'copied';
    } catch {
      /* Fall back to the visible link below. */
    }
    setCopied({ view, status: result });
    track('share', { method: 'copy_link', body_id: view.selected ?? 'system' });
  }

  async function shareCurrentView() {
    const file = preview.status === 'ready' ? preview.file : undefined;
    const link = { title: heading, url };
    // Probe the exact payload rather than the file on its own: a browser can
    // accept an image alone and still refuse one beside a link, and sharing a
    // payload it rejected throws instead of opening the sheet. Carrying the
    // file also gives the system sheet our own frame to preview, in place of
    // the generic page glyph it draws for a bare link.
    const withImage = file
      ? [
          { ...link, files: [file] },
          { title: heading, text: url, files: [file] },
        ].find((candidate) => navigator.canShare?.(candidate))
      : undefined;
    // Targets that reject an attached screenshot still receive the link, whose
    // social card already matches the body on screen.
    const payload = withImage ?? link;
    try {
      await navigator.share(payload);
      track('share', {
        method: withImage ? 'system_image' : 'system_link',
        body_id: view.selected ?? 'system',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      await copyLink();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('Close')}
        className="orbit-dialog share-dialog"
      >
        <DialogTitle>{t('分享此刻所见')}</DialogTitle>
        <DialogDescription>
          {t('打开链接的人会看到同一时刻、同一天体的太阳系。')}
        </DialogDescription>
        <figure className="share-preview">
          {preview.status === 'ready' ? (
            <div
              className="share-preview-frame"
              style={
                {
                  backgroundImage: `url(${preview.url})`,
                  aspectRatio: `${preview.width} / ${preview.height}`,
                } as CSSProperties
              }
            />
          ) : (
            <div className="share-preview-placeholder">
              {t(
                preview.status === 'pending'
                  ? '正在生成观测截图…'
                  : '截图生成失败，链接仍可分享。',
              )}
            </div>
          )}
          <figcaption>
            <span className="sr-only">{t('当前观测画面预览')}</span>
            {heading}
          </figcaption>
        </figure>
        <div className="share-actions">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              className="primary-action"
              onClick={() => void shareCurrentView()}
            >
              <Share2 size={16} />
              {t('分享')}
            </button>
          )}
          <button
            type="button"
            className="secondary-action"
            onClick={() => void copyLink()}
          >
            {status === 'copied' ? <Check size={15} /> : <Link2 size={15} />}
            {t('复制链接')}
          </button>
          {preview.status === 'ready' && (
            <a
              className="secondary-action"
              href={preview.url}
              download={shareFileName(view)}
              onClick={() =>
                track('share', {
                  method: 'download_image',
                  body_id: view.selected ?? 'system',
                })
              }
            >
              <Download size={15} />
              {t('保存图片')}
            </a>
          )}
        </div>
        <output className="share-status" aria-live="polite" aria-atomic="true">
          {status === 'copied'
            ? t('链接已复制')
            : status === 'manual'
              ? t('请复制下方链接')
              : ''}
        </output>
        <input
          className="share-link"
          aria-label={t('分享链接')}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </DialogContent>
    </Dialog>
  );
}
