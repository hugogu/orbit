import './globals.css';
import GoogleAnalytics from '../components/google-analytics';
import { I18nProvider } from '../lib/i18n/provider';
import { defaultLocale, languages, type Locale } from '../lib/i18n';

export default function LayoutShell({
  children,
  locale = defaultLocale,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  return (
    <html lang={languages[locale].intl} className="dark">
      <body>
        <GoogleAnalytics />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
