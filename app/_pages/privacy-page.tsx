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
  absoluteSiteUrl,
  explorerPath,
  privacyPath,
  privacyDescription,
  privacyTitle,
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
  const title = privacyTitle(locale);
  const description = privacyDescription(locale);
  const canonical = absoluteSiteUrl(privacyPath(locale));
  return {
    title,
    description,
    applicationName: seoSiteName,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...seoLocales.map((item) => [
          languages[item].intl,
          absoluteSiteUrl(privacyPath(item)),
        ]),
        ['x-default', absoluteSiteUrl(privacyPath('zh-CN'))],
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

export default async function PrivacyPage({ params }: PageProps) {
  const locale = await resolvePage(params);
  const t = translator(locale);
  const title = privacyTitle(locale);
  const description = privacyDescription(locale);

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
              href={privacyPath(item)}
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
            {t('法律信息')} <span>Privacy</span>
          </p>
          <h1>{title}</h1>
          <p className="profile-headline">
            {t('一个没有账号、没有服务器数据库的静态网站')}
          </p>
          <p className="seo-lead">{description}</p>
          <p className="little-note">
            {t('最近更新：{{date}}', { date: '2026-09-26' })}
          </p>
          <div className="seo-actions">
            <a className="seo-primary-action" href={explorerPath(locale)}>
              {t('回到三维观测台')}
            </a>
          </div>
        </div>

        <section
          id="data"
          className="seo-section"
          aria-labelledby="privacy-data-heading"
        >
          <p className="seo-section-number">01 / {t('总览')}</p>
          <h2 id="privacy-data-heading">{t('我们收集了什么')}</h2>
          <p className="profile-intro">
            {t(
              'ORBIT 不要求注册账号，页面上也没有收集姓名、邮箱或其他身份信息的表单。整个网站以静态文件构建，没有后端服务器，也就没有存储用户数据的数据库。',
            )}
          </p>
        </section>

        <section
          id="local"
          className="seo-section"
          aria-labelledby="privacy-local-heading"
        >
          <p className="seo-section-number">02 / {t('本地信息')}</p>
          <h2 id="privacy-local-heading">
            {t('保存在您浏览器中的信息')}
          </h2>
          <div className="profile-chapter">
            <h3>{t('显示设置')}</h3>
            <p>
              {t(
                '轨道线、标签、纹理画质、真实比例等偏好保存在您浏览器的本地存储（localStorage）中，只用于记住您的选择，不会被发送到任何服务器。',
              )}
            </p>
          </div>
          <div className="profile-chapter">
            <h3>{t('位置与设备朝向')}</h3>
            <p>
              {t(
                '地表观星、日出日落计算以及天象可见性判断，在获得您的授权后会使用浏览器的定位与设备朝向接口。这些信息只用于在您的设备上完成计算，ORBIT 不会收集、上传或存储它们。',
              )}
            </p>
          </div>
          <div className="profile-chapter">
            <h3>{t('离线缓存')}</h3>
            <p>
              {t(
                '作为渐进式网页应用（PWA），ORBIT 会在您的浏览器中缓存部分页面、脚本与贴图，以便离线浏览。这份缓存同样只保存在本地设备上。',
              )}
            </p>
          </div>
        </section>

        <section
          id="third-party"
          className="seo-section"
          aria-labelledby="privacy-third-party-heading"
        >
          <p className="seo-section-number">03 / {t('第三方服务')}</p>
          <h2 id="privacy-third-party-heading">
            {t('我们使用的第三方服务')}
          </h2>
          <p className="profile-intro">
            {t(
              '以下服务由 Google 和 Vercel 独立运营，各自的数据处理方式受它们自己的隐私政策约束：',
            )}
          </p>
          <div className="profile-chapter">
            <h3>Google AdSense</h3>
            <p>
              {t(
                'ORBIT 通过 Google AdSense 展示广告以维持运营。Google 可能使用 Cookie 及类似技术，根据您的兴趣展示广告；您可以在这里查看或关闭个性化广告：',
              )}{' '}
              <a
                href="https://adssettings.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                {t('Google 广告设置')}
              </a>
            </p>
          </div>
          <div className="profile-chapter">
            <h3>Google Analytics</h3>
            <p>
              {t(
                '部分部署可能启用 Google Analytics，用于统计整体访问情况；启用时会使用测量 Cookie。ORBIT 默认不启用它，是否开启由具体部署决定。',
              )}
            </p>
          </div>
          <div className="profile-chapter">
            <h3>Vercel Web Analytics</h3>
            <p>
              {t(
                '用于统计匿名、聚合的整体使用情况（如访问量与功能使用次数）。它不使用 Cookie，也不会尝试识别您的身份。',
              )}
            </p>
          </div>
        </section>

        <section
          id="choices"
          className="seo-section"
          aria-labelledby="privacy-choices-heading"
        >
          <p className="seo-section-number">04 / {t('您的选择')}</p>
          <h2 id="privacy-choices-heading">{t('您可以怎么做')}</h2>
          <p className="profile-intro">
            {t('您可以随时通过以下方式管理这些数据：')}
          </p>
          <ul className="legal-list">
            <li>
              {t(
                '在浏览器设置中清除本地存储或屏蔽 Cookie，将重置您在本站保存的偏好。',
              )}
            </li>
            <li>
              <a
                href="https://adssettings.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                {t('管理广告个性化')}
              </a>
            </li>
            <li>
              {t(
                '随时在浏览器或系统设置中关闭定位与设备朝向的授权；关闭后仅地表观星等相关功能不可用，其余功能不受影响。',
              )}
            </li>
          </ul>
        </section>

        <section
          id="children"
          className="seo-section"
          aria-labelledby="privacy-children-heading"
        >
          <p className="seo-section-number">05 / {t('儿童隐私')}</p>
          <h2 id="privacy-children-heading">{t('儿童隐私')}</h2>
          <p className="profile-intro">
            {t(
              'ORBIT 是面向大众的天文科普网站，并非专门面向儿童设计，也不会在知情的情况下收集儿童的个人信息。',
            )}
          </p>
        </section>

        <section
          id="changes"
          className="seo-section"
          aria-labelledby="privacy-changes-heading"
        >
          <p className="seo-section-number">06 / {t('政策更新')}</p>
          <h2 id="privacy-changes-heading">{t('政策更新')}</h2>
          <p className="profile-intro">
            {t(
              '我们可能不时更新本政策，以反映网站或适用法规的变化。更新后的版本会直接发布在本页面，并更新上方的日期。',
            )}
          </p>
        </section>

        <section
          id="contact"
          className="seo-section profile-sources"
          aria-labelledby="privacy-contact-heading"
        >
          <p className="seo-section-number">07 / {t('资料来源')}</p>
          <h2 id="privacy-contact-heading">{t('联系我们')}</h2>
          <p className="profile-intro">
            {t(
              '如果您对本政策有任何疑问，欢迎通过 GitHub 提交 Issue 与我们联系。',
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
            {t('相关页面：')} <a href={aboutPath(locale)}>{t('关于与联系')}</a>
          </p>
        </section>
      </article>
      <footer className="seo-page-footer">
        <a href={explorerPath(locale)}>{t('返回太阳系观测台')}</a>
        <span className="seo-page-byline">
          ORBIT / orbits.observer
          <a href={aboutPath(locale)}>{t('关于与联系')}</a>
          <GitHubLink label={t('在 GitHub 查看源代码')} />
        </span>
      </footer>
    </main>
  );
}
