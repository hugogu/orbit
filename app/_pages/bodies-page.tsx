import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  languages,
  localePath,
  resolveLocalePath,
  translator,
  type Locale,
} from '../../lib/i18n';
import GitHubLink from '../../components/github-link';
import {
  absoluteSiteUrl,
  bodiesIndexDescription,
  bodiesIndexJsonLd,
  bodiesIndexPath,
  bodiesIndexSections,
  bodiesIndexTitle,
  bodyDetailsPath,
  entryImagePath,
  explorerPath,
  serializeJsonLd,
  seoSiteName,
  seoLocales,
  type CatalogEntry,
} from '../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/** The index owns no entity of its own, so it enumerates languages itself. */
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
  const title = bodiesIndexTitle(locale);
  const description = bodiesIndexDescription(locale);
  const canonical = absoluteSiteUrl(bodiesIndexPath(locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(bodiesIndexPath(item)),
        ]),
        ['x-default', absoluteSiteUrl(bodiesIndexPath('zh-CN'))],
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
          alt: t('天体档案'),
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

function EntryGrid({
  entries,
  locale,
  heading: Heading,
}: {
  entries: CatalogEntry[];
  locale: Locale;
  heading: 'h3' | 'h4';
}) {
  const t = translator(locale);
  return (
    <ul className="body-index-grid">
      {entries.map((entry) => {
        const name = t(entry.data.name);
        // Moons and comets are already named by the section they sit in.
        const type =
          entry.kind === 'body' || entry.kind === 'asteroid'
            ? entry.data.type
            : undefined;
        return (
          <li key={entry.data.id}>
            <a href={bodyDetailsPath(locale, entry.data.id)}>
              {/* Build-time renders avoid a WebGL scene and an image-optimization server on static pages. */}
              <Image
                src={entryImagePath(entry)}
                alt=""
                width={88}
                height={88}
                loading="lazy"
                unoptimized
              />
              <div>
                <Heading>
                  {name}{' '}
                  {entry.data.en.toLowerCase() !== name.toLowerCase() && (
                    <span>{entry.data.en}</span>
                  )}
                </Heading>
                {type && <p className="body-index-type">{t(type)}</p>}
                <p className="body-index-summary">
                  {t(entry.data.description)}
                </p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default async function BodiesPage({ params }: PageProps) {
  const locale = await resolvePage(params);
  const t = translator(locale);
  const title = bodiesIndexTitle(locale);
  const description = bodiesIndexDescription(locale);
  const canonical = absoluteSiteUrl(bodiesIndexPath(locale));
  const jsonLd = bodiesIndexJsonLd({ locale, title, description, canonical });
  const sections = bodiesIndexSections();

  return (
    <main className="seo-page">
      <header className="seo-page-header">
        <a className="seo-brand" href={explorerPath(locale)}>
          ORBIT <span>{t('太阳系漫游')}</span>
        </a>
        <nav aria-label={t('语言')} className="seo-language-nav">
          {seoLocales.map((item) => (
            <a
              key={item}
              href={bodiesIndexPath(item)}
              hrefLang={languages[item].intl}
              aria-current={item === locale ? 'page' : undefined}
            >
              {languages[item].short}
            </a>
          ))}
        </nav>
      </header>
      <article className="seo-article">
        <nav className="seo-breadcrumb" aria-label={t('面包屑')}>
          <a href={explorerPath(locale)}>{t('返回总览')}</a>
          <span aria-hidden="true">/</span>
          <span>{t('天体档案')}</span>
        </nav>
        <div className="event-cover">
          <p className="seo-eyebrow">
            {t('天体百科')} <span>Celestial Bodies</span>
          </p>
          <h1>{t('天体档案')}</h1>
          <p className="profile-headline">
            {t('从太阳到彗星，每个天体都有一份自己的档案。')}
          </p>
          <p className="seo-lead">{description}</p>
          <div className="seo-actions">
            <a className="seo-primary-action" href={explorerPath(locale)}>
              {t('回到三维观测台')}
            </a>
          </div>
        </div>
        <nav className="event-toc body-index-toc" aria-label={t('资料导航')}>
          {sections.map((section, index) => (
            <a key={section.id} href={`#${section.id}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {t(section.name)}
              <small>
                {section.groups.reduce(
                  (count, group) => count + group.entries.length,
                  0,
                )}
              </small>
            </a>
          ))}
        </nav>
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className="seo-section"
            aria-labelledby={`${section.id}-heading`}
          >
            <p className="seo-section-number">
              {String(index + 1).padStart(2, '0')} / {section.en}
            </p>
            <h2 id={`${section.id}-heading`}>{t(section.name)}</h2>
            <p className="profile-intro">{t(section.summary)}</p>
            {section.groups.map((group) =>
              group.planet ? (
                <div className="body-index-group" key={group.planet.id}>
                  <h3>{t('{{name}}的卫星', { name: t(group.planet.name) })}</h3>
                  <EntryGrid
                    entries={group.entries}
                    locale={locale}
                    heading="h4"
                  />
                </div>
              ) : (
                <EntryGrid
                  key={section.id}
                  entries={group.entries}
                  locale={locale}
                  heading="h3"
                />
              ),
            )}
          </section>
        ))}
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('返回太阳系观测台')}</a>
        <span className="seo-page-byline">
          ORBIT / orbits.observer
          <GitHubLink label={t('在 GitHub 查看源代码')} />
        </span>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </main>
  );
}
