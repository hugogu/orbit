import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LayoutShell from '../../layout-shell';
import { metadata as siteMetadata } from '../../site-metadata';
import { languages, resolveLocale } from '../../../lib/i18n';

export const metadata: Metadata = siteMetadata;

export function generateStaticParams() {
  return Object.keys(languages).map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  if (!locale || locale !== localeParam) notFound();
  return <LayoutShell locale={locale}>{children}</LayoutShell>;
}
