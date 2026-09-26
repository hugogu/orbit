import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import {
  languages,
  localePath,
  resolveLocalePath,
  translator,
  type Locale,
} from '../../lib/i18n';
import GitHubLink, { repositoryUrl } from '../../components/github-link';
import {
  aboutPath,
  aboutDescription,
  aboutTitle,
  absoluteSiteUrl,
  explorerPath,
  privacyPath,
  seoSiteName,
  seoLocales,
} from '../../lib/seo';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/** The page owns no entity of its own, so it enumerates languages itself. */
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
  const title = aboutTitle(locale);
  const description = aboutDescription(locale);
  const canonical = absoluteSiteUrl(aboutPath(locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(aboutPath(item)),
        ]),
        ['x-default', absoluteSiteUrl(aboutPath('zh-CN'))],
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
          alt: title,
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

export default async function AboutPage({ params }: PageProps) {
  const locale = await resolvePage(params);
  const t = translator(locale);
  const title = aboutTitle(locale);
  const description = aboutDescription(locale);

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
              href={aboutPath(item)}
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
          <span>{title}</span>
        </nav>
        <div className="event-cover">
          <p className="seo-eyebrow">
            {t('关于本站')} <span>About</span>
          </p>
          <h1>{title}</h1>
          <p className="profile-headline">
            {t('一个开源的太阳系可视化项目')}
          </p>
          <p className="seo-lead">{description}</p>
          <div className="seo-actions">
            <a className="seo-primary-action" href={explorerPath(locale)}>
              {t('回到三维观测台')}
            </a>
          </div>
        </div>

        <section
          id="what"
          className="seo-section"
          aria-labelledby="about-what-heading"
        >
          <p className="seo-section-number">01 / {t('项目简介')}</p>
          <h2 id="about-what-heading">{t('ORBIT 是什么')}</h2>
          <p className="profile-intro">
            {t(
              'ORBIT 是一个免费的三维太阳系模拟器：太阳、八大行星与冥王星、有代表性的卫星、小行星与彗星都可以在真实的时间尺度上运行，配合每个天体的完整档案页面，帮助你直观理解太阳系的结构与运动。',
            )}
          </p>
        </section>

        <section
          id="source"
          className="seo-section"
          aria-labelledby="about-source-heading"
        >
          <p className="seo-section-number">02 / {t('开源与数据来源')}</p>
          <h2 id="about-source-heading">{t('开源与数据来源')}</h2>
          <p className="profile-intro">
            {t(
              'ORBIT 的源代码在 GitHub 上公开，欢迎查看实现、提出问题或参与改进。天体数据主要引用 NASA 与 JPL 的公开资料，星表与银河全景引用公开亮星星表和 Solar System Scope 的素材；每份天体档案底部都列出了对应的资料来源。',
            )}
          </p>
          <a
            className="seo-source-link"
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('在 GitHub 查看源代码')}</span>
            <ArrowUpRight className="external-arrow" aria-hidden="true" />
          </a>
        </section>

        <section
          id="contact"
          className="seo-section profile-sources"
          aria-labelledby="about-contact-heading"
        >
          <p className="seo-section-number">03 / {t('资料来源')}</p>
          <h2 id="about-contact-heading">{t('联系我们')}</h2>
          <p className="profile-intro">
            {t(
              '有问题、发现错误，或者想提建议？最快的方式是在 GitHub 上提交 Issue。',
            )}
          </p>
          <a
            className="seo-source-link"
            href={`${repositoryUrl}/issues`}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('在 GitHub 提交 Issue')}</span>
            <ArrowUpRight className="external-arrow" aria-hidden="true" />
          </a>
          <p className="profile-intro">
            {t('相关页面：')} <a href={privacyPath(locale)}>{t('隐私政策')}</a>
          </p>
        </section>
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('返回太阳系观测台')}</a>
        <span className="seo-page-byline">
          ORBIT / orbits.observer
          <a href={privacyPath(locale)}>{t('隐私政策')}</a>
          <GitHubLink label={t('在 GitHub 查看源代码')} />
        </span>
      </footer>
    </main>
  );
}
