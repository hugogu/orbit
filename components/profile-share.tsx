'use client';

import { useState } from 'react';
import type { Locale } from '../lib/i18n/languages';

export default function ProfileShare({
  locale: _locale,
  title,
  url,
  label,
  copiedLabel,
  manualLabel,
  copyLinkAriaLabel,
}: {
  locale?: Locale;
  title: string;
  url: string;
  /** Already translated; pages that are not body profiles name their own. */
  label?: string;
  copiedLabel?: string;
  manualLabel?: string;
  copyLinkAriaLabel?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }
  return (
    <div className="profile-share-control">
      <button
        type="button"
        className="seo-secondary-action"
        onClick={() => void share()}
      >
        {label ?? '分享档案'}
      </button>
      <output aria-live="polite" aria-atomic="true">
        {status === 'copied'
          ? (copiedLabel ?? '链接已复制')
          : status === 'manual'
            ? (manualLabel ?? '请复制下方链接')
            : ''}
      </output>
      {status === 'manual' && (
        <input
          aria-label={copyLinkAriaLabel ?? '复制链接'}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
