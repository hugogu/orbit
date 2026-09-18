import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShareRedirect from '../../components/share-redirect';
import {
  languages,
  localePath,
  resolveLocalePath,
  translator,
  type Locale,
} from '../../lib/i18n';
import { squareImagePath, wideImagePath } from '../../lib/profile-images';
import {
  absoluteSiteUrl,
  catalogEntries,
  explorerPath,
  seoLocales,
  seoSiteName,
  type CatalogEntry,
} from '../../lib/seo';

type OverviewProps = { params: Promise<{ locale: string }> };
type BodyProps = { params: Promise<{ locale: string; id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return catalogEntries().map((entry) => ({ id: entry.data.id }));
}

/** The overview landing page owns no body, so it enumerates languages itself. */
export function generateOverviewStaticParams() {
  return seoLocales.map((locale) => ({ locale: localePath(locale) }));
}

function resolveLocale(value: string): Locale {
  const locale = resolveLocalePath(value);
  if (!locale || localePath(locale) !== value) notFound();
  return locale;
}

function resolveEntry(id: string): CatalogEntry {
  const entry = catalogEntries().find((item) => item.data.id === id);
  if (!entry) notFound();
  return entry;
}

/**
 * A share link carries its moment in the query string, which a static export
 * cannot read while rendering. The card therefore names the body being observed
 * and shows its rendered portrait; the exact time travels in the link and in
 * the screenshot attached alongside it.
 */
function shareMetadata(locale: Locale, entry: CatalogEntry | null): Metadata {
  const t = translator(locale);
  const name = entry ? t(entry.data.name) : t('太阳系');
  const title = name;
  const description = t('看看分享者在 ORBIT 中观测{{name}}的这一刻。', {
    name,
  });
  const alt = t('{{name}}的天体渲染图', { name });
  const wide = entry
    ? absoluteSiteUrl(wideImagePath(locale, entry.data.id))
    : absoluteSiteUrl('/og-image.png');
  // Clients crop and cache og:image differently, so the subject-first square
  // stays ahead of the wide card.
  const images = entry
    ? [
        {
          url: absoluteSiteUrl(squareImagePath(entry.data.id)),
          width: 600,
          height: 600,
          type: 'image/jpeg',
          alt,
        },
        { url: wide, width: 1200, height: 630, type: 'image/jpeg', alt },
      ]
    : [{ url: wide, width: 1672, height: 941, type: 'image/png', alt }];
  return {
    title,
    description,
    applicationName: seoSiteName,
    // A share link carries its moment in the query string, and social crawlers
    // rewrite the posted link to `og:url` or the canonical when either is
    // present. Both are dropped so the shared state survives the post; search
    // engines instead follow the redirect below back to the observatory.
    alternates: { canonical: null },
    openGraph: {
      type: 'website',
      siteName: seoSiteName,
      locale: languages[locale].intl.replace('-', '_'),
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [wide],
    },
  };
}

function ShareLanding({
  locale,
  entry,
}: {
  locale: Locale;
  entry: CatalogEntry | null;
}) {
  const t = translator(locale);
  const id = entry?.data.id ?? null;
  return (
    <main className="share-landing">
      <ShareRedirect locale={locale} selected={id} />
      <p className="share-landing-brand">ORBIT</p>
      <h1>{t('正在打开分享的观测视角…')}</h1>
      <a href={explorerPath(locale, id ?? undefined)}>
        {t('如果没有自动跳转，点此进入观测台')}
      </a>
    </main>
  );
}

export async function generateOverviewMetadata({
  params,
}: OverviewProps): Promise<Metadata> {
  const { locale } = await params;
  return shareMetadata(resolveLocale(locale), null);
}

export async function ShareOverviewPage({ params }: OverviewProps) {
  const { locale } = await params;
  return <ShareLanding locale={resolveLocale(locale)} entry={null} />;
}

export async function generateBodyMetadata({
  params,
}: BodyProps): Promise<Metadata> {
  const { locale, id } = await params;
  return shareMetadata(resolveLocale(locale), resolveEntry(id));
}

export default async function ShareBodyPage({ params }: BodyProps) {
  const { locale, id } = await params;
  return (
    <ShareLanding locale={resolveLocale(locale)} entry={resolveEntry(id)} />
  );
}
