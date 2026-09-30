import type { Metadata, Viewport } from 'next';
import { translator } from '../lib/i18n';
import { seoSiteName, siteOrigin } from '../lib/seo';
import { pwaThemeColor } from '../lib/pwa';

export const viewport: Viewport = {
  themeColor: pwaThemeColor,
  colorScheme: 'dark',
};

// Link cards and search snippets are built from this server-rendered metadata,
// and a crawler never runs the client code that picks a visitor's language, so
// the root page leads in English under the public site name. The explorer
// puts the visitor's own language in the tab title and description once it has
// hydrated (`I18nProvider`). The strings come from the catalog so the two agree.
const english = translator('en');
const title = english('Orbits Observer：实时三维太阳系探索');
const description = english(
  '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
);

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ORBIT', statusBarStyle: 'default' },
  metadataBase: new URL(`${siteOrigin}/`),
  title: {
    default: title,
    template: '%s | Orbits Observer',
  },
  description,
  applicationName: seoSiteName,
  category: 'education',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: seoSiteName,
    title,
    description,
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1672,
        height: 941,
        alt: 'The Sun, planets and asteroid belt of the Solar System on their orbits, against the Milky Way',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
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
