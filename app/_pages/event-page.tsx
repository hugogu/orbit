import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import {
  eventCategory,
  eventTopic,
  eventTopics,
  topicsByCategory,
  type EventTopic,
} from '../../lib/event-guide';
import {
  languages,
  localePath,
  resolveLocalePath,
  translator,
  type Locale,
} from '../../lib/i18n';
import GitHubLink from '../../components/github-link';
import ProfileShare from '../../components/profile-share';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntry,
  entryImagePath,
  eventDetailsPath,
  eventJsonLd,
  eventsIndexPath,
  eventTitle,
  explorerPath,
  serializeJsonLd,
  seoSiteName,
  seoLocales,
} from '../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

type ResolvedPage = {
  locale: Locale;
  topic: EventTopic;
};

/** Averaged dates and rates describe a long-term pattern, not a given year. */
const dataNote =
  '活跃期、极大日期与出现率为多年平均值，实际情况每年略有差别；计划观测时请以当年的预报为准。';

export function generateStaticParams() {
  return seoLocales.flatMap((locale) =>
    eventTopics.map((topic) => ({
      locale: localePath(locale),
      id: topic.id,
    })),
  );
}

export const dynamicParams = false;

async function resolvePage(params: PageProps['params']): Promise<ResolvedPage> {
  const { locale: localeParam, id } = await params;
  const locale = resolveLocalePath(localeParam);
  const topic = eventTopic(id);
  if (!locale || localePath(locale) !== localeParam || !topic) notFound();
  return { locale, topic };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, topic } = await resolvePage(params);
  const t = translator(locale);
  const title = eventTitle(topic, locale);
  const description = t(topic.summary);
  const canonical = absoluteSiteUrl(eventDetailsPath(locale, topic.id));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(eventDetailsPath(item, topic.id)),
        ]),
        ['x-default', absoluteSiteUrl(eventDetailsPath('zh-CN', topic.id))],
      ]),
    },
    openGraph: {
      type: 'article',
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
          alt: t(topic.name),
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

export default async function EventPage({ params }: PageProps) {
  const { locale, topic } = await resolvePage(params);
  const t = translator(locale);
  const name = t(topic.name);
  const category = eventCategory(topic.category);
  const title = eventTitle(topic, locale);
  const description = t(topic.summary);
  const canonical = absoluteSiteUrl(eventDetailsPath(locale, topic.id));
  const jsonLd = eventJsonLd({ topic, locale, title, description, canonical });
  const related = topicsByCategory(topic.category).filter(
    (item) => item.id !== topic.id,
  );
  const relatedBodies = topic.bodies.flatMap((id) => {
    const entry = catalogEntry(id);
    return entry ? [entry] : [];
  });
  const navigation = [
    ['overview', t('事件概览')],
    ['data', t('关键数据')],
    ['observing', t('观测提示')],
    ['sources', t('资料来源')],
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
              href={eventDetailsPath(item, topic.id)}
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
          <a href={eventsIndexPath(locale)}>{t('天象事件')}</a>
          <span aria-hidden="true">/</span>
          <span>{name}</span>
        </nav>
        <div className="event-cover">
          <p className="seo-eyebrow">
            {t(category.name)} <span>{topic.en}</span>
          </p>
          <h1>{name}</h1>
          <p className="profile-headline">{t(topic.headline)}</p>
          <p className="seo-lead">{description}</p>
          <div className="seo-actions">
            <a
              className="seo-primary-action"
              href={explorerPath(locale, topic.bodies[0])}
            >
              {t('在 3D 观测台中观察')}
            </a>
            <ProfileShare
              locale={locale}
              title={title}
              url={canonical}
              label={t('分享这份介绍')}
            />
          </div>
        </div>
        <dl className="profile-key-facts">
          {topic.facts.slice(0, 3).map((fact) => (
            <div key={fact.label}>
              <dt>{t(fact.label)}</dt>
              <dd>{t(fact.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="profile-reading-layout">
          <aside className="profile-toc">
            <nav aria-label={t('资料导航')}>
              <p>{t('资料导航')}</p>
              {navigation.map(([id, label], index) => (
                <a key={id} href={`#${id}`}>
                  <span>0{index + 1}</span>
                  {label}
                </a>
              ))}
            </nav>
          </aside>
          <div className="profile-reading">
            <section
              id="overview"
              className="seo-section"
              aria-labelledby="event-overview-heading"
            >
              <p className="seo-section-number">01 / {t('事件概览')}</p>
              <h2 id="event-overview-heading">{t('认识{{name}}', { name })}</h2>
              <p className="profile-intro">{t(topic.intro)}</p>
              {topic.sections.map((section) => (
                <div className="profile-chapter" key={section.heading}>
                  <h3>{t(section.heading)}</h3>
                  <p>{t(section.text)}</p>
                </div>
              ))}
            </section>
            <section
              id="data"
              className="seo-section"
              aria-labelledby="event-data-heading"
            >
              <p className="seo-section-number">02 / {t('关键数据')}</p>
              <h2 id="event-data-heading">{t('核心参数')}</h2>
              <dl className="seo-facts">
                {topic.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{t(fact.label)}</dt>
                    <dd>{t(fact.value)}</dd>
                  </div>
                ))}
                <div>
                  <dt>{t('发生频率')}</dt>
                  <dd>{t(topic.season)}</dd>
                </div>
              </dl>
              <details className="profile-data-note">
                <summary>{t('数据与计算说明')}</summary>
                <p>{t(dataNote)}</p>
              </details>
            </section>
            <section
              id="observing"
              className="seo-section"
              aria-labelledby="event-observing-heading"
            >
              <p className="seo-section-number">03 / {t('观测提示')}</p>
              <h2 id="event-observing-heading">{t('怎么看')}</h2>
              <ul className="event-observing">
                {topic.observing.map((tip) => (
                  <li key={tip}>{t(tip)}</li>
                ))}
              </ul>
            </section>
            <section
              id="sources"
              className="seo-section profile-sources"
              aria-labelledby="event-sources-heading"
            >
              <p className="seo-section-number">04 / {t('资料来源')}</p>
              <h2 id="event-sources-heading">{t('可信来源')}</h2>
              {topic.sources.map((source) => (
                <a
                  key={source.url}
                  className="seo-source-link"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{source.name}</span>
                  <ArrowUpRight className="external-arrow" aria-hidden="true" />
                </a>
              ))}
            </section>
          </div>
        </div>
        {related.length > 0 && (
          <nav
            className="event-related"
            aria-labelledby="event-related-heading"
          >
            <h2 id="event-related-heading">
              {t('更多{{category}}', { category: t(category.name) })}
            </h2>
            <ul>
              {related.map((item) => (
                <li key={item.id}>
                  <a href={eventDetailsPath(locale, item.id)}>
                    <strong>{t(item.name)}</strong>
                    <small>{t(item.season)}</small>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {relatedBodies.length > 0 && (
          <nav className="seo-related" aria-labelledby="event-bodies-heading">
            <h2 id="event-bodies-heading">{t('相关天体')}</h2>
            <ul>
              {relatedBodies.map((entry) => (
                <li key={entry.data.id}>
                  <a href={bodyDetailsPath(locale, entry.data.id)}>
                    {/* Build-time renders avoid a WebGL scene and an image-optimization server on static pages. */}
                    <Image
                      src={entryImagePath(entry)}
                      alt=""
                      width={160}
                      height={160}
                      loading="lazy"
                      unoptimized
                    />
                    <span>{t(entry.data.name)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
      <footer className="seo-page-footer">
        <a href={eventsIndexPath(locale)}>{t('返回天象事件列表')}</a>
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
