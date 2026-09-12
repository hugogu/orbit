import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { moonRadii } from '../../../../lib/eclipse-shadows';
import { moonSemimajorKm } from '../../../../lib/satellite-elements';
import { translator, languages, type Locale } from '../../../../lib/i18n';
import { bodies } from '../../../../lib/solar';
import { comets } from '../../../../lib/comets';
import { orbitingMoons } from '../../../../lib/moon-orbits';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  catalogEntry,
  explorerPath,
  seoLocales,
  siteOrigin,
  type CatalogEntry,
} from '../../../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

type ResolvedPage = {
  locale: Locale;
  entry: CatalogEntry;
};

function resolveLocale(value: string): Locale | undefined {
  return seoLocales.includes(value as Locale) ? (value as Locale) : undefined;
}

async function resolvePage(params: PageProps['params']): Promise<ResolvedPage> {
  const { locale: localeParam, id } = await params;
  const locale = resolveLocale(localeParam);
  const entry = catalogEntry(id);
  if (!locale || !entry) notFound();
  return { locale, entry };
}

function entryName(entry: CatalogEntry, locale: Locale) {
  return translator(locale)(entry.data.name);
}

function entryDescription(entry: CatalogEntry, locale: Locale) {
  return translator(locale)(entry.data.description);
}

function pageTitle(entry: CatalogEntry, locale: Locale) {
  const t = translator(locale);
  const name = entryName(entry, locale);
  if (entry.kind === 'body') return `${name} · ${t('太阳系知识')}`;
  if (entry.kind === 'moon') return `${name} · ${t('天然卫星资料')}`;
  return `${name} · ${t('彗星档案 /')}`;
}

function sourceUrl(entry: CatalogEntry) {
  if (entry.kind === 'body') {
    return entry.data.id === 'sun'
      ? 'https://science.nasa.gov/sun/facts/'
      : `https://science.nasa.gov/${entry.data.source}/`;
  }
  if (entry.kind === 'moon') return `https://science.nasa.gov/${entry.data.source}/`;
  return `https://science.nasa.gov/solar-system/comets/${entry.data.source}/`;
}

function relatedEntries(entry: CatalogEntry) {
  if (entry.kind === 'body') {
    const moons = orbitingMoons.filter((moon) => moon.parentId === entry.data.id);
    return [
      ...bodies.filter((body) => body.id !== entry.data.id).slice(0, 4).map((data) => ({ kind: 'body' as const, data })),
      ...moons.slice(0, 4).map((data) => ({ kind: 'moon' as const, data })),
    ];
  }
  if (entry.kind === 'moon') {
    const parent = bodies.find((body) => body.id === entry.data.parentId);
    return parent ? [{ kind: 'body' as const, data: parent }] : [];
  }
  return comets
    .filter((comet) => comet.id !== entry.data.id)
    .map((data) => ({ kind: 'comet' as const, data }));
}

function coreFacts(entry: CatalogEntry, locale: Locale) {
  const t = translator(locale);
  if (entry.kind === 'body') {
    const body = entry.data;
    return [
      [t('平均半径'), `${body.radius.toLocaleString(locale)} km`],
      [t('平均日距'), body.au ? `${body.au} AU` : '—'],
      [t('公转周期'), body.period ? `${body.period.toLocaleString(locale)} ${body.period > 1000 ? t('年') : t('天')}` : '—'],
      [t('自转周期'), `${Math.abs(body.day).toFixed(2)} ${t('天')}`],
    ];
  }
  if (entry.kind === 'moon') {
    const moon = entry.data;
    return [
      [t('平均半径'), `${moonRadii[moon.en].toLocaleString(locale)} km`],
      [t('平均直径'), `${(moonRadii[moon.en] * 2).toLocaleString(locale)} km`],
      [t('轨道半长轴'), `${moonSemimajorKm(moon).toLocaleString(locale)} km`],
      [t('公转周期'), `${moon.period} ${t('天')}`],
    ];
  }
  const comet = entry.data;
  return [
    [t('模型公转周期'), `${(comet.period / 365.256).toLocaleString(locale, { maximumFractionDigits: 1 })} ${t('年')}`],
    [t('轨道倾角'), `${comet.inc}°`],
    [t('模型近日点'), `${(comet.au * (1 - comet.e)).toFixed(2)} AU`],
    [t('模型远日点'), `${(comet.au * (1 + comet.e)).toFixed(2)} AU`],
  ];
}

export function generateStaticParams() {
  return seoLocales.flatMap((locale) =>
    catalogEntries().map((entry) => ({ locale, id: entry.data.id })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, entry } = await resolvePage(params);
  const t = translator(locale);
  const title = pageTitle(entry, locale);
  const description = entryDescription(entry, locale);
  const canonical = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
  return {
    title,
    description,
    applicationName: t('ORBIT · 太阳系漫游'),
    alternates: {
      canonical,
      languages: Object.fromEntries(
        [
          ...seoLocales.map((item) => [
            item,
            absoluteSiteUrl(bodyDetailsPath(item, entry.data.id)),
          ]),
          [
            'x-default',
            absoluteSiteUrl(bodyDetailsPath('zh-CN', entry.data.id)),
          ],
        ],
      ),
    },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description,
      siteName: 'ORBIT · Solar System Observatory',
      locale: languages[locale].intl.replace('-', '_'),
      images: [
        {
          url: `${siteOrigin}/og-image.png`,
          width: 1672,
          height: 941,
          alt: `${entryName(entry, locale)} · ORBIT`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteOrigin}/og-image.png`],
    },
  };
}

function BodyFacts({ entry, locale }: { entry: CatalogEntry; locale: Locale }) {
  const t = translator(locale);
  return (
    <dl className="seo-facts">
      {coreFacts(entry, locale).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {entry.kind === 'body' && (
        <div>
          <dt>{t('天然卫星')}</dt>
          <dd>{t(entry.data.moons)}</dd>
        </div>
      )}
      {entry.kind === 'moon' && (
        <div>
          <dt>{t('所属行星')}</dt>
          <dd>{t(bodies.find((body) => body.id === entry.data.parentId)?.name ?? '')}</dd>
        </div>
      )}
    </dl>
  );
}

export default async function BodyPage({ params }: PageProps) {
  const { locale, entry } = await resolvePage(params);
  const t = translator(locale);
  const name = entryName(entry, locale);
  const description = entryDescription(entry, locale);
  const title = pageTitle(entry, locale);
  const canonical = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
  const related = relatedEntries(entry);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: languages[locale].intl,
    isPartOf: {
      '@type': 'WebSite',
      name: t('ORBIT · 太阳系漫游'),
      url: absoluteSiteUrl('/'),
    },
    about: {
      '@type': 'Thing',
      name,
      description,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'ORBIT',
          item: absoluteSiteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t('太阳系知识'),
          item: absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id)),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name,
          item: canonical,
        },
      ],
    },
  };

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
              href={bodyDetailsPath(item, entry.data.id)}
              hrefLang={languages[item].intl}
              aria-current={item === locale ? 'page' : undefined}
            >
              {languages[item].short}
            </a>
          ))}
        </nav>
      </header>
      <article className="seo-article">
        <nav className="seo-breadcrumb" aria-label="Breadcrumb">
          <a href={explorerPath(locale)}>{t('返回总览')}</a>
          <span aria-hidden="true">/</span>
          <span>{name}</span>
        </nav>
        <p className="seo-eyebrow">
          {entry.kind === 'body'
            ? t('天体档案 /')
            : entry.kind === 'moon'
              ? t('{{name}}的天然卫星', {
                  name: t(
                    bodies.find((body) => body.id === entry.data.parentId)?.name ?? '',
                  ),
                })
              : t('彗星档案 /')}{' '}
          <span>{entry.data.en}</span>
        </p>
        <h1>{name}</h1>
        <p className="seo-lead">{description}</p>
        <div className="seo-actions">
          <a className="seo-primary-action" href={explorerPath(locale, entry.data.id)}>
            {t('在 3D 观测台中观察')} →
          </a>
          <a className="seo-secondary-action" href={explorerPath(locale)}>
            {t('返回总览')}
          </a>
        </div>

        <section className="seo-section" aria-labelledby="seo-facts-heading">
          <h2 id="seo-facts-heading">{t('资料与计算依据')}</h2>
          <BodyFacts entry={entry} locale={locale} />
          <p className="seo-copy">
            {t(entry.kind === 'moon' ? entry.data.description : entry.data.fact)}
          </p>
          {entry.kind === 'moon' && (
            <p className="seo-copy">
              {t(
                '半径采用球形近似，轨道半长轴从主星中心计量。除月球外的卫星表面配色与自转朝向仍为教学示意。',
              )}
            </p>
          )}
          {entry.kind === 'comet' && (
            <p className="seo-copy">
              {t(
                '位置由共享日期与 JPL 带历元轨道参数计算。固定二体轨道未计入行星摄动和喷气效应，距历元越远误差越大；不是精确回归预报。轨道按 AU 比例显示，彗核、旋转与彗尾为示意。',
              )}
            </p>
          )}
        </section>

        <section className="seo-section" aria-labelledby="seo-source-heading">
          <h2 id="seo-source-heading">{t('模型说明与来源')}</h2>
          <p className="seo-copy">{t('ORBIT 是一个透明说明假设的学习工具，并非导航或专业星历服务。')}</p>
          <a className="seo-source-link" href={sourceUrl(entry)} target="_blank" rel="noreferrer">
            {entry.kind === 'moon' ? t('阅读 NASA 的{{name}}资料 ↗', { name }) : t('在 NASA 继续探索')}
          </a>
          {entry.kind !== 'body' && (
            <a
              className="seo-source-link"
              href="https://ssd.jpl.nasa.gov/sats/"
              target="_blank"
              rel="noreferrer"
            >
              {entry.kind === 'moon' ? t('JPL 卫星物理参数 ↗') : t('轨道参数：JPL 小天体数据库')}
            </a>
          )}
        </section>

        {related.length > 0 && (
          <nav className="seo-section seo-related" aria-labelledby="seo-related-heading">
            <h2 id="seo-related-heading">{t('继续探索')}</h2>
            <ul>
              {related.map((item) => (
                <li key={`${item.kind}-${item.data.id}`}>
                  <a href={bodyDetailsPath(locale, item.data.id)}>
                    {entryName(item, locale)} <span aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('开始你的太空漫游')}</a>
        <span>ORBIT · Solar System Observatory</span>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
