import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { moonRadii } from '../../lib/eclipse-shadows';
import { moonSemimajorKm } from '../../lib/satellite-elements';
import {
  localePath,
  resolveLocalePath,
  translator,
  languages,
  type Locale,
} from '../../lib/i18n';
import { curiosities, type Curiosity } from '../../lib/curiosities';
import { extraFacts } from '../../lib/physical-facts';
import { bodies } from '../../lib/solar';
import { comets } from '../../lib/comets';
import { profileContent, type ProfileContent } from '../../lib/profile-content';
import {
  squareImagePath,
  isIllustrativePortrait,
  portraitCredit,
} from '../../lib/profile-images';
import ProfileShare from '../../components/profile-share';
import { orbitingMoons } from '../../lib/moon-orbits';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  catalogEntry,
  entryImagePath,
  explorerPath,
  ogImagePath,
  profileJsonLd,
  profileTitle,
  serializeJsonLd,
  seoSiteName,
  seoLocales,
  type CatalogEntry,
} from '../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

type ResolvedPage = {
  locale: Locale;
  entry: CatalogEntry;
};

function resolveLocale(value: string): Locale | undefined {
  const locale = resolveLocalePath(value);
  return locale && localePath(locale) === value ? locale : undefined;
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

function sourceUrl(entry: CatalogEntry) {
  if (entry.kind === 'body') {
    return entry.data.id === 'sun'
      ? 'https://science.nasa.gov/sun/facts/'
      : `https://science.nasa.gov/${entry.data.source}/`;
  }
  if (entry.kind === 'moon')
    return `https://science.nasa.gov/${entry.data.source}/`;
  return `https://science.nasa.gov/solar-system/comets/${entry.data.source}/`;
}

function relatedEntries(entry: CatalogEntry) {
  if (entry.kind === 'body') {
    const moons = orbitingMoons.filter(
      (moon) => moon.parentId === entry.data.id,
    );
    return [
      ...bodies
        .filter((body) => body.id !== entry.data.id)
        .slice(0, 4)
        .map((data) => ({ kind: 'body' as const, data })),
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
    const orbitalPeriod =
      body.period > 1000
        ? `${(body.period / 365.256).toLocaleString(locale, {
            maximumFractionDigits: 1,
          })} ${t('年')}`
        : `${body.period.toLocaleString(locale)} ${t('天')}`;
    return [
      [t('平均半径'), `${body.radius.toLocaleString(locale)} km`],
      [t('平均日距'), body.au ? `${body.au} AU` : '—'],
      [t('公转周期'), body.period ? orbitalPeriod : '—'],
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
    [
      t('模型公转周期'),
      `${(comet.period / 365.256).toLocaleString(locale, { maximumFractionDigits: 1 })} ${t('年')}`,
    ],
    [t('轨道倾角'), `${comet.inc}°`],
    [t('模型近日点'), `${(comet.au * (1 - comet.e)).toFixed(2)} AU`],
    [t('模型远日点'), `${(comet.au * (1 + comet.e)).toFixed(2)} AU`],
  ];
}

function localizedCuriosity(fact: Curiosity, locale: Locale) {
  const t = translator(locale);
  return t(
    fact.text,
    Object.fromEntries(
      Object.entries(fact.values ?? {}).map(([key, value]) => [
        key,
        typeof value === 'string' ? t(value) : value,
      ]),
    ),
  );
}

export function generateStaticParams() {
  return seoLocales.flatMap((locale) =>
    catalogEntries().map((entry) => ({
      locale: localePath(locale),
      id: entry.data.id,
    })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, entry } = await resolvePage(params);
  const title = profileTitle(entry, locale);
  const description = entryDescription(entry, locale);
  const canonical = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(bodyDetailsPath(item, entry.data.id)),
        ]),
        ['x-default', absoluteSiteUrl(bodyDetailsPath('zh-CN', entry.data.id))],
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
          url: absoluteSiteUrl(squareImagePath(entry.data.id)),
          width: 600,
          height: 600,
          type: 'image/jpeg',
          alt: translator(locale)('{{name}}的天体渲染图', {
            name: entryName(entry, locale),
          }),
        },
        {
          url: absoluteSiteUrl(ogImagePath(locale, entry.data.id)),
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: translator(locale)('{{name}}的天体渲染图', {
            name: entryName(entry, locale),
          }),
        },
      ],
    },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteSiteUrl(ogImagePath(locale, entry.data.id))],
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
        <>
          <div>
            <dt>{t('天然卫星')}</dt>
            <dd>{t(entry.data.moons)}</dd>
          </div>
          {extraFacts(entry.data, locale).map((fact) => (
            <div key={fact.label}>
              <dt>{t(fact.label)}</dt>
              <dd>
                {t(fact.value)}
                {fact.unit && <> {t(fact.unit)}</>}
              </dd>
            </div>
          ))}
        </>
      )}
      {entry.kind === 'moon' && (
        <div>
          <dt>{t('所属行星')}</dt>
          <dd>
            {t(
              bodies.find((body) => body.id === entry.data.parentId)?.name ??
                '',
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

function ProfileFactGroup({
  group,
  index,
  pool,
  locale,
}: {
  group: ProfileContent['groups'][number];
  index: number;
  pool: Curiosity[];
  locale: Locale;
}) {
  const t = translator(locale);
  const sources = [
    ...new Set(
      group.indices
        .map((itemIndex) => pool[itemIndex]?.source)
        .filter((source): source is string => Boolean(source)),
    ),
  ];
  return (
    <details className="profile-fact-group" open={index === 0}>
      <summary>
        {t(group.heading)}
        <span>{group.indices.length}</span>
      </summary>
      <ul>
        {group.indices.map((itemIndex) => {
          const fact = pool[itemIndex];
          return (
            <li key={itemIndex}>
              <p>{localizedCuriosity(fact, locale)}</p>
            </li>
          );
        })}
      </ul>
      {sources.length > 0 && (
        <div className="profile-group-sources">
          {sources.map((source, sourceIndex) => (
            <a
              key={source}
              href={source}
              target="_blank"
              rel="noreferrer"
              aria-label={t('参考资料 {{number}}', { number: sourceIndex + 1 })}
            >
              {t('资料来源')} {sources.length > 1 ? sourceIndex + 1 : ''} ↗
            </a>
          ))}
        </div>
      )}
    </details>
  );
}

function CuriosityList({
  entry,
  locale,
}: {
  entry: CatalogEntry;
  locale: Locale;
}) {
  const t = translator(locale);
  const pool = curiosities[entry.data.id] ?? [];
  return (
    <section
      id="knowledge"
      className="seo-section"
      aria-labelledby="seo-knowledge-heading"
    >
      <p className="seo-section-number">03 / {t('延伸阅读')}</p>
      <h2 id="seo-knowledge-heading">{t('深入了解')}</h2>
      {profileContent[entry.data.id].groups.map((group, index) => (
        <ProfileFactGroup
          key={group.heading}
          group={group}
          index={index}
          pool={pool}
          locale={locale}
        />
      ))}
    </section>
  );
}

export default async function BodyPage({ params }: PageProps) {
  const { locale, entry } = await resolvePage(params);
  const t = translator(locale);
  const name = entryName(entry, locale);
  const description = entryDescription(entry, locale);
  const title = profileTitle(entry, locale);
  const canonical = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
  const content = profileContent[entry.data.id];
  const credit = portraitCredit(entry);
  const related = relatedEntries(entry);
  const jsonLd = profileJsonLd({
    entry,
    locale,
    title,
    description,
    canonical,
  });
  const keyFacts = coreFacts(entry, locale)
    .filter(([, value]) => value !== '—')
    .slice(0, 3);
  const profileSource = sourceUrl(entry);
  const navigation = [
    ['overview', t('天体概览')],
    ['data', t('关键数据')],
    ['knowledge', t('延伸阅读')],
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
        <nav className="seo-breadcrumb" aria-label={t('面包屑')}>
          <a href={explorerPath(locale)}>{t('返回总览')}</a>
          <span aria-hidden="true">/</span>
          <span>{name}</span>
        </nav>
        <div className="profile-cover">
          <div className="profile-cover-copy">
            <div className="profile-cover-title">
              <p className="seo-eyebrow">
                {t(
                  entry.kind === 'body'
                    ? entry.data.type
                    : entry.kind === 'moon'
                      ? '天然卫星'
                      : '彗星档案',
                )}{' '}
                <span>{entry.data.en}</span>
              </p>
              <h1>{name}</h1>
              <p className="profile-headline">{t(content.headline)}</p>
            </div>
            <div className="profile-cover-details">
              <p className="seo-lead">{description}</p>
              <div className="seo-actions">
                <a
                  className="seo-primary-action"
                  href={explorerPath(locale, entry.data.id)}
                >
                  {t('在 3D 观测台中观察')} <span aria-hidden="true">↗</span>
                </a>
                <ProfileShare locale={locale} title={title} url={canonical} />
              </div>
            </div>
          </div>
          <figure className="seo-hero">
            {/* Build-time renders avoid a WebGL scene and an image-optimization server on static pages. */}
            <Image
              src={entryImagePath(entry)}
              alt={t('{{name}}的天体渲染图', { name })}
              width={1000}
              height={1000}
              sizes="(max-width: 760px) 100vw, 50vw"
              loading="eager"
              unoptimized
            />
            <figcaption>
              {t(
                isIllustrativePortrait(entry)
                  ? '表面与形状为示意'
                  : '光照与视角为示意',
              )}{' '}
              · <a href="#image-credits">{t('图像与授权')}</a>
            </figcaption>
          </figure>
        </div>
        <dl className="profile-key-facts">
          {keyFacts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
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
              aria-labelledby="profile-overview-heading"
            >
              <p className="seo-section-number">01 / {t('天体概览')}</p>
              <h2 id="profile-overview-heading">
                {t('认识{{name}}', { name })}
              </h2>
              <p className="profile-intro">{t(content.intro)}</p>
              {content.sections.map((section) => (
                <div className="profile-chapter" key={section.heading}>
                  <h3>{t(section.heading)}</h3>
                  <p>{t(section.text)}</p>
                </div>
              ))}
            </section>
            <section
              id="data"
              className="seo-section"
              aria-labelledby="profile-data-heading"
            >
              <p className="seo-section-number">02 / {t('关键数据')}</p>
              <h2 id="profile-data-heading">{t('核心参数')}</h2>
              <BodyFacts entry={entry} locale={locale} />
              <details className="profile-data-note">
                <summary>{t('数据与计算说明')}</summary>
                <p>
                  {t(
                    entry.kind === 'comet'
                      ? '位置由共享日期与 JPL 带历元轨道参数计算。固定二体轨道未计入行星摄动和喷气效应，距历元越远误差越大；不是精确回归预报。轨道按 AU 比例显示，彗核、旋转与彗尾为示意。'
                      : '半径采用平均值；轨道数据用于介绍天体的尺度与运动。',
                  )}
                </p>
              </details>
            </section>
            <CuriosityList entry={entry} locale={locale} />
            <section
              id="sources"
              className="seo-section profile-sources"
              aria-labelledby="profile-sources-heading"
            >
              <p className="seo-section-number">04 / {t('资料来源')}</p>
              <h2 id="profile-sources-heading">{t('可信来源')}</h2>
              <a
                className="seo-source-link"
                href={profileSource}
                target="_blank"
                rel="noreferrer"
              >
                NASA Science — {name} ↗
              </a>
              <a
                className="seo-source-link"
                href={
                  entry.kind === 'comet'
                    ? 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html'
                    : entry.kind === 'moon'
                      ? 'https://ssd.jpl.nasa.gov/sats/'
                      : 'https://ssd.jpl.nasa.gov/planets/'
                }
                target="_blank"
                rel="noreferrer"
              >
                JPL — {t('轨道数据')} ↗
              </a>
              <div id="image-credits" className="profile-image-credits">
                <h3>{t('图像与授权')}</h3>
                <p>
                  {t('图像基于已有贴图重新投影与布光，不代表实时观测照片。')}
                </p>
                <p>
                  {t('表面素材')}：<a href={credit.url}>{credit.name}</a> ·{' '}
                  <a href={credit.license}>{t('授权协议')}</a> ·{' '}
                  {t('渲染：ORBIT')}
                </p>
              </div>
            </section>
            <section
              className="profile-share-panel"
              aria-labelledby="profile-share-heading"
            >
              <Image
                src={squareImagePath(entry.data.id)}
                alt=""
                width={120}
                height={120}
                loading="lazy"
                unoptimized
              />
              <div>
                <h2 id="profile-share-heading">{t('分享这份天体档案')}</h2>
                <div className="profile-downloads">
                  <a href={squareImagePath(entry.data.id)} download>
                    {t('下载方形图')} ↓
                  </a>
                  <a href={ogImagePath(locale, entry.data.id)} download>
                    {t('下载横版图')} ↓
                  </a>
                </div>
                <p>
                  {t('保存图片时请保留素材署名与授权信息。')}{' '}
                  <a href="#image-credits">{t('图像与授权')}</a>
                </p>
              </div>
            </section>
          </div>
        </div>
        {related.length > 0 && (
          <nav
            className="seo-related"
            aria-labelledby="profile-related-heading"
          >
            <h2 id="profile-related-heading">{t('继续探索')}</h2>
            <ul>
              {related.map((item) => (
                <li key={item.data.id}>
                  <a href={bodyDetailsPath(locale, item.data.id)}>
                    <Image
                      src={entryImagePath(item)}
                      alt=""
                      width={160}
                      height={160}
                      loading="lazy"
                      unoptimized
                    />
                    <span>{entryName(item, locale)}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('返回太阳系观测台')}</a>
        <span>ORBIT / orbits.observer</span>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </main>
  );
}
