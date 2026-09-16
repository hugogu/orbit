import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../globals.css';
import GoogleAdSense from '../../../components/google-adsense';
import RootProviders from '../../root-providers';
import { metadata as siteMetadata } from '../../site-metadata';
import {
  languages,
  localePath,
  resolveLocalePath,
  type Locale,
} from '../../../lib/i18n';

export const metadata: Metadata = siteMetadata;

export function generateStaticParams() {
  return (Object.keys(languages) as Locale[]).map((locale) => ({
    locale: localePath(locale),
  }));
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
  const locale = resolveLocalePath(localeParam);
  if (!locale || localePath(locale) !== localeParam) notFound();
  return (
    <html lang={languages[locale].intl} className="dark">
      <head>
        <GoogleAdSense />
      </head>
      <body>
        <RootProviders locale={locale}>{children}</RootProviders>
      </body>
    </html>
  );
}
