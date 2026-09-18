import type { Metadata, Viewport } from 'next';
import { siteOrigin } from '../lib/seo';
import { pwaThemeColor } from '../lib/pwa';

export const viewport: Viewport = {
  themeColor: pwaThemeColor,
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ORBIT', statusBarStyle: 'default' },
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
  // A raster icon beside the vector one: system surfaces that represent a page
  // outside the browser, such as a share sheet, do not all render SVG.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};
