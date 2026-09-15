import GoogleAnalytics from '../components/google-analytics';
import { I18nProvider } from '../lib/i18n/provider';
import { defaultLocale, type Locale } from '../lib/i18n';
import { Analytics } from '@vercel/analytics/next';

export default function RootProviders({
  children,
  locale = defaultLocale,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  return (
    <>
      <GoogleAnalytics />
      <Analytics />
      <I18nProvider initialLocale={locale}>{children}</I18nProvider>
    </>
  );
}
