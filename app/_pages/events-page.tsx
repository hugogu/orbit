import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  eventCategories,
  eventTopics,
  topicsByCategory,
} from '../../lib/event-guide';
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
  eventDetailsPath,
  eventsIndexJsonLd,
  eventsIndexPath,
  eventsIndexTitle,
  explorerPath,
  privacyPath,
  serializeJsonLd,
  seoSiteName,
  seoLocales,
} from '../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/** The index owns no entity of its own, so it enumerates languages itself. */
export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale: localePath(locale) }));
}

export const dynamicParams = false;

const indexDescription =
  '流星雨、合相、冲、大距、月相、日食与月食：常见天象的成因、周期与观测要点，一页读完。';

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
  const title = eventsIndexTitle(locale);
  const description = t(indexDescription);
  const canonical = absoluteSiteUrl(eventsIndexPath(locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(eventsIndexPath(item)),
        ]),
        ['x-default', absoluteSiteUrl(eventsIndexPath('zh-CN'))],
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
          alt: t('天象事件'),
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

export default async function EventsPage({ params }: PageProps) {
  const locale = await resolvePage(params);
  const t = translator(locale);
  const title = eventsIndexTitle(locale);
  const description = t(indexDescription);
  const canonical = absoluteSiteUrl(eventsIndexPath(locale));
  const jsonLd = eventsIndexJsonLd({ locale, title, description, canonical });
  const overview = [
    [t('收录事件'), `${eventTopics.length}`],
    [t('事件分类'), `${eventCategories.length}`],
    [t('观测门槛'), t('肉眼为主')],
  ];

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
              href={eventsIndexPath(item)}
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
          <span>{t('天象事件')}</span>
        </nav>
        <div className="event-cover">
          <p className="seo-eyebrow">
            {t('天象指南')} <span>Sky Events</span>
          </p>
          <h1>{t('天象事件')}</h1>
          <p className="profile-headline">
            {t('天上按时发生的事，大多可以提前知道。')}
          </p>
          <p className="seo-lead">{description}</p>
          <div className="seo-actions">
            <a className="seo-primary-action" href={explorerPath(locale)}>
              {t('回到三维观测台')}
            </a>
          </div>
        </div>
        <dl className="profile-key-facts">
          {overview.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <nav className="event-toc" aria-label={t('事件分类')}>
          {eventCategories.map((category, index) => (
            <a key={category.id} href={`#${category.id}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {t(category.name)}
              <small>{topicsByCategory(category.id).length}</small>
            </a>
          ))}
        </nav>
        {eventCategories.map((category, index) => (
          <section
            key={category.id}
            id={category.id}
            className="seo-section event-category"
            aria-labelledby={`${category.id}-heading`}
          >
            <p className="seo-section-number">
              {String(index + 1).padStart(2, '0')} / {category.en}
            </p>
            <h2 id={`${category.id}-heading`}>{t(category.name)}</h2>
            <p className="profile-intro">{t(category.summary)}</p>
            <ul className="event-grid">
              {topicsByCategory(category.id).map((topic) => (
                <li key={topic.id}>
                  <a href={eventDetailsPath(locale, topic.id)}>
                    <h3>
                      {t(topic.name)}
                      <span>{topic.en}</span>
                    </h3>
                    <p className="event-season">{t(topic.season)}</p>
                    <p className="event-summary">{t(topic.summary)}</p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('返回太阳系观测台')}</a>
        <span className="seo-page-byline">
          ORBIT / orbits.observer
          <a href={privacyPath(locale)}>{t('隐私政策')}</a>
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
