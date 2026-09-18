'use client';
import { useEffect } from 'react';
import { explorerHref } from '../lib/share-view';
import type { Locale } from '../lib/i18n';

/**
 * Hands the visitor to the explorer with the shared observation applied. The
 * landing page exists so social crawlers, which do not run scripts, still read
 * a card matching the body on screen.
 */
export default function ShareRedirect({
  locale,
  selected,
}: {
  locale: Locale;
  selected: string | null;
}) {
  useEffect(() => {
    // Replace, so going back leaves ORBIT instead of bouncing through the link.
    window.location.replace(
      explorerHref(locale, selected, window.location.search),
    );
  }, [locale, selected]);
  return null;
}
