import type { Metadata } from 'next';
import Link from 'next/link';
import { bodyDetailsPath, catalogEntry, seoLocales } from '../lib/seo';
import { languages, translator, type Locale } from '../lib/i18n';

export const metadata: Metadata = {
  title: '页面未找到 · ORBIT',
  description: '这个地址不存在，但你可以继续探索太阳系。',
  robots: {
    index: false,
    follow: true,
  },
};

const popularIds = ['sun', 'earth', 'jupiter'];
const fallbackLocale: Locale = 'zh-CN';

export default function NotFound() {
  const t = translator(fallbackLocale);
  return (
    <main className="not-found" lang="zh-CN">
      <p className="not-found-code">404 · ORBIT</p>
      <h1>{t('页面未找到')}</h1>
      <div className="not-found-copy">
        {seoLocales.map((locale) => (
          <p key={locale} lang={languages[locale].intl}>
            {translator(locale)('这个地址不存在，但你可以继续探索太阳系。')}
          </p>
        ))}
      </div>
      <section aria-labelledby="not-found-popular">
        <h2 id="not-found-popular">{t('热门天体')}</h2>
        <ul>
          {popularIds.flatMap((id) => {
            const entry = catalogEntry(id);
            if (!entry) return [];
            return seoLocales.map((locale) => {
              const localized = translator(locale);
              return (
                <li key={`${locale}-${id}`}>
                  <Link
                    href={bodyDetailsPath(locale, id)}
                    lang={languages[locale].intl}
                  >
                    {localized(entry.data.name)} · {languages[locale].short} →
                  </Link>
                </li>
              );
            });
          })}
        </ul>
      </section>
      <Link className="not-found-home" href="/">
        {t('返回太阳系观测台')}
      </Link>
    </main>
  );
}
