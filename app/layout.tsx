import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '../lib/i18n/provider';
import GoogleAnalytics from '../components/google-analytics';
import { siteOrigin } from '../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(`${siteOrigin}/`),
  title: {
    default: 'ORBIT · 太阳系漫游',
    template: '%s | ORBIT',
  },
  description:
    '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
  applicationName: 'ORBIT · 太阳系漫游',
  category: 'education',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ORBIT · 太阳系漫游',
    title: 'ORBIT · 太阳系漫游',
    description:
      '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
    locale: 'zh_CN',
    images: [
      {
        url: '/og-image.png',
        width: 1672,
        height: 941,
        alt: 'ORBIT 交互式三维太阳系观测台',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORBIT · 太阳系漫游',
    description:
      '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <GoogleAnalytics />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
