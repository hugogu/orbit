import type { Metadata } from 'next';
import Image from 'next/image';
import GitHubLink from '../../components/github-link';
import LanguagePicker from '../../components/language-picker';
import ProfileShare from '../../components/profile-share';
import {
  eventOccurrences,
  occurrenceCircumstances,
  occurrenceImagePath,
  occurrenceImageSize,
  type EventOccurrence,
} from '../../lib/event-occurrences';
import { languages, translator, type Locale } from '../../lib/i18n';
import {
  absoluteSiteUrl,
  eventDetailsPath,
  eventsIndexPath,
  explorerPath,
  occurrenceDescription,
  occurrenceExplorerPath,
  occurrenceJsonLd,
  occurrenceName,
  occurrenceSkyCaption,
  occurrenceTitle,
  privacyPath,
  seoLocales,
  seoSiteName,
  serializeJsonLd,
} from '../../lib/seo';

export function occurrenceMetadata(
  event: EventOccurrence,
  locale: Locale,
): Metadata {
  const title = occurrenceTitle(event, locale);
  const description = occurrenceDescription(event, locale);
  const canonical = absoluteSiteUrl(eventDetailsPath(locale, event.id));
  const image = absoluteSiteUrl(occurrenceImagePath(event, locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(eventDetailsPath(item, event.id)),
        ]),
        ['x-default', absoluteSiteUrl(eventDetailsPath('zh-CN', event.id))],
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
          url: image,
          ...occurrenceImageSize,
          alt: occurrenceSkyCaption(event, locale),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
  };
}

export default function EventOccurrencePage({
  event,
  locale,
}: {
  event: EventOccurrence;
  locale: Locale;
}) {
  const t = translator(locale);
  const name = occurrenceName(event, locale);
  const title = occurrenceTitle(event, locale);
  const canonical = absoluteSiteUrl(eventDetailsPath(locale, event.id));
  const data = occurrenceCircumstances(event);
  const format = (ms: number, offset = 0) =>
    new Intl.DateTimeFormat(languages[locale].intl, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(ms + offset * 3_600_000);
  const facts = [
    [t('冲日预测时刻（UTC）'), format(event.peak)],
    [t('北京当地时刻（UTC+8）'), format(event.peak, 8)],
    [t('地心距离'), `${data.distance.toFixed(3)} AU`],
    [t('视星等'), data.magnitude.toFixed(1)],
    [t('星环倾角'), `${data.ringTilt.toFixed(1)}°`],
  ];
  const navigation = [
    ['overview', t('本次冲日')],
    ['sky', t('天空位置图')],
    ['observing', t('北京观测时段')],
    ['sources', t('资料来源')],
  ];
  const sources = [
    {
      name: 'Astronomy Engine — planetary positions and event searches',
      url: 'https://github.com/cosinekitty/astronomy',
    },
    {
      name: 'NASA Science — See Saturn at its Best and Brightest',
      url: 'https://science.nasa.gov/science-research/planetary-science/25apr_saturn/',
    },
    {
      name: 'NASA Science — Opposition Surge on the B Ring',
      url: 'https://science.nasa.gov/resource/opposition-surge-on-the-b-ring/',
    },
    ...(event.date.startsWith('2026')
      ? [
          {
            name: 'IGN — Astronomical events 2026',
            url: 'https://astronomia.ign.es/rknowsys-theme/images/webAstro/paginas/publicaciones/atlas-celestes/Atlas_celeste_2026_Peninsula-Baleares_english_version.pdf',
          },
        ]
      : []),
  ];
  return (
    <main className="seo-page">
      <header className="seo-page-header">
        <a className="seo-brand" href={explorerPath(locale)}>
          ORBIT <span>{t('太阳系漫游')}</span>
        </a>
        <LanguagePicker
          hrefs={Object.fromEntries(
            seoLocales.map((item) => [
              item,
              eventDetailsPath(item, event.id),
            ]),
          )}
        />
      </header>
      <article className="seo-article">
        <nav className="seo-breadcrumb" aria-label={t('面包屑')}>
          <a href={explorerPath(locale)}>{t('返回总览')}</a>
          <span aria-hidden="true">/</span>
          <a href={eventsIndexPath(locale)}>{t('天象百科')}</a>
          <span aria-hidden="true">/</span>
          <a href={eventDetailsPath(locale, event.concept)}>{t('冲')}</a>
          <span aria-hidden="true">/</span>
          <span>{name}</span>
        </nav>
        <div className="event-cover">
          <p className="seo-eyebrow">
            {t('具体天象')} <span>Saturn opposition · {event.date} UTC</span>
          </p>
          <h1>{name}</h1>
          <p className="seo-lead">{occurrenceDescription(event, locale)}</p>
          <p className="little-note">
            {t('页面日期以 UTC 为准；当地日期可能不同。')}
          </p>
          <div className="seo-actions">
            <a
              className="seo-primary-action"
              href={occurrenceExplorerPath(event, locale)}
            >
              {t('查看本次事件推演')}
            </a>
            <a
              className="seo-secondary-action"
              href={eventDetailsPath(locale, event.concept)}
            >
              {t('了解“冲”的原理')}
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
          {facts.slice(0, 3).map(([label, value]) => (
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
              aria-labelledby="occurrence-overview-heading"
            >
              <p className="seo-section-number">01 / {t('本次冲日')}</p>
              <h2 id="occurrence-overview-heading">{t('这一年的土星')}</h2>
              <p className="profile-intro">
                {t(
                  '本次冲日预计发生在 {{utc}}（UTC），北京为 {{local}}（UTC+8）。这是全球共同的几何时刻，土星与太阳的地心视黄经相差 180°；距离最近的时刻可能略有不同。',
                  { utc: format(event.peak), local: format(event.peak, 8) },
                )}
              </p>
              <p>
                {t(
                  '本次土星距地球约 {{distance}} AU，视星等约 {{magnitude}}，星环倾角约 {{tilt}}°。倾角越接近 0°，星环越接近侧向；每次冲日的外观与观测条件都会变化。',
                  {
                    distance: data.distance.toFixed(3),
                    magnitude: data.magnitude.toFixed(1),
                    tilt: data.ringTilt.toFixed(1),
                  },
                )}
              </p>
              <dl className="seo-facts">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="little-note">
                {t(
                  '数据由 Astronomy Engine 预测，时刻显示到分钟，与高精度年历可能相差数分钟；未来 UTC 也受地球自转预测误差影响。',
                )}
              </p>
            </section>
            <section
              id="sky"
              className="seo-section"
              aria-labelledby="occurrence-sky-heading"
            >
              <p className="seo-section-number">02 / {t('天空位置图')}</p>
              <h2 id="occurrence-sky-heading">{t('当天 22:00 的北京夜空')}</h2>
              <figure className="occurrence-sky-figure">
                <a
                  href={occurrenceImagePath(event, locale)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image
                    src={occurrenceImagePath(event, locale)}
                    {...occurrenceImageSize}
                    alt={t(
                      '{{name}}当天的北京夜空，标出土星、周围星座和地平方位。',
                      { name },
                    )}
                    className="occurrence-sky-image"
                    unoptimized
                  />
                </a>
                <figcaption>
                  <p>
                    <a
                      href={occurrenceImagePath(event, locale)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('查看完整星图')}
                    </a>
                  </p>
                  <p>{occurrenceSkyCaption(event, locale)}</p>
                  <p>
                    {t(
                      '此时土星高度约 {{altitude}}°，方位角约 {{azimuth}}°（从正北顺时针计）。',
                      {
                        altitude: data.altitude.toFixed(1),
                        azimuth: data.azimuth.toFixed(1),
                      },
                    )}
                  </p>
                </figcaption>
              </figure>
              <p className="little-note">
                {t(
                  '星图使用观测台同一套天体历表、真实恒星目录和星座连线计算绘制；天体标记经过放大，这是预测图，不是实拍照片。',
                )}
              </p>
              <p>
                {t(
                  '配图选择当天夜间，而不是强求冲日瞬间；冲日可能发生在当地白天。换一个地点或时刻，天空中的位置也会改变。',
                )}
              </p>
            </section>
            <section
              id="observing"
              className="seo-section"
              aria-labelledby="occurrence-observing-heading"
            >
              <p className="seo-section-number">03 / {t('北京观测时段')}</p>
              <h2 id="occurrence-observing-heading">{t('从傍晚到次日清晨')}</h2>
              <p>
                {t(
                  '以下为配图所在夜晚的北京时刻（UTC+8），跨过午夜时会标出次日日期；其他地点请在观测台中设置自己的观测点。',
                )}
              </p>
              <dl className="seo-facts">
                {[
                  [t('土星升起'), data.rise],
                  [t('土星上中天'), data.transit],
                  [t('土星落下'), data.set],
                ].map(([label, ms]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>
                      {typeof ms === 'number'
                        ? format(ms, 8)
                        : t('当天无此事件')}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="event-observing">
                <li>
                  {t(
                    '优先选择土星升高、天空黑暗且天气晴朗的时段；冲日前后数周也适合观测。',
                  )}
                </li>
                <li>
                  {t(
                    '肉眼可辨认土星的亮点；观察星环需要小型望远镜，先低倍定位，再根据大气宁静度增加倍率。',
                  )}
                </li>
                <li>
                  {t(
                    '预测不包含天气、建筑遮挡和光污染；图中标出的暗行星不一定能用肉眼看见。',
                  )}
                </li>
              </ul>
            </section>
            <section
              id="sources"
              className="seo-section profile-sources"
              aria-labelledby="occurrence-sources-heading"
            >
              <p className="seo-section-number">04 / {t('资料来源')}</p>
              <h2 id="occurrence-sources-heading">{t('可信来源')}</h2>
              {sources.map((source) => (
                <a
                  key={source.url}
                  className="seo-source-link"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{source.name}</span>
                  <small>{new URL(source.url).hostname}</small>
                </a>
              ))}
            </section>
          </div>
        </div>
        <section
          className="seo-section"
          aria-labelledby="occurrence-related-heading"
        >
          <h2 id="occurrence-related-heading">{t('其他年份的土星冲日')}</h2>
          <ul className="event-related-list">
            {eventOccurrences
              .filter((other) => other.id !== event.id)
              .map((other) => (
                <li key={other.id}>
                  <a href={eventDetailsPath(locale, other.id)}>
                    {occurrenceName(other, locale)}
                  </a>
                </li>
              ))}
          </ul>
        </section>
      </article>
      <footer className="seo-page-footer">
        <a href={eventsIndexPath(locale)}>{t('返回天象百科列表')}</a>
        <span className="seo-page-byline">
          ORBIT / orbits.observer
          <a href={privacyPath(locale)}>{t('隐私政策')}</a>
          <GitHubLink label={t('在 GitHub 查看源代码')} />
        </span>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(occurrenceJsonLd(event, locale)),
        }}
      />
    </main>
  );
}
