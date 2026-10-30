import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomePage from './home-page';
import {
  absoluteSiteUrl,
  homeDescription,
  homeJsonLd,
  homePath,
  homeTitle,
  serializeJsonLd,
  seoLocales,
  seoSiteName,
} from '../../lib/seo';
import {
  getMessages,
  languages,
  localePath,
  resolveLocalePath,
  translator,
  type Locale,
} from '../../lib/i18n';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale: localePath(locale) }));
}

export const dynamicParams = false;

async function resolvePage(params: PageProps['params']): Promise<Locale> {
  const { locale: localeParam } = await params;
  const locale = resolveLocalePath(localeParam);
  if (!locale || localePath(locale) !== localeParam) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const locale = await resolvePage(params);
  const t = translator(locale);
  const title = homeTitle(locale);
  const description = homeDescription(locale);
  const canonical = absoluteSiteUrl(homePath(locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(homePath(item)),
        ]),
        ['x-default', absoluteSiteUrl('/')],
      ]),
    },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: seoSiteName,
      locale: languages[locale].intl.replace('-', '_'),
      images: [
        {
          url: absoluteSiteUrl('/og-image.png'),
          width: 1672,
          height: 941,
          type: 'image/png',
          alt: t('太阳系'),
        },
      ],
    },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteSiteUrl('/og-image.png')],
    },
  };
}

export default async function LocalizedHomePage({ params }: PageProps) {
  const locale = await resolvePage(params);
  return (
    <>
      <HomePage initialLocale={locale} initialMessages={getMessages(locale)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            homeJsonLd(locale, absoluteSiteUrl(homePath(locale))),
          ),
        }}
      />
    </>
  );
}
