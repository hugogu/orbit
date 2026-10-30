'use client';
import { Languages } from 'lucide-react';
import { languages, resolveLocale, type Locale } from '../lib/i18n/languages';
import { useOptionalI18n } from '../lib/i18n/provider';

export default function LanguagePicker({
  hrefs,
  locale: propLocale,
  label: propLabel,
}: {
  hrefs?: Partial<Record<Locale, string>>;
  locale?: Locale;
  label?: string;
}) {
  const i18n = useOptionalI18n();
  const locale = propLocale ?? i18n?.locale ?? 'zh-CN';
  const label = propLabel ?? i18n?.t('语言') ?? '语言';
  return (
    <label className="language-picker" title={languages[locale].name}>
      <Languages size={18} aria-hidden="true" />
      <select
        aria-label={label}
        value={locale}
        onChange={(event) => {
          const next = resolveLocale(event.target.value);
          if (next && next !== locale) {
            if (hrefs?.[next]) {
              window.location.assign(hrefs[next]);
            } else if (i18n?.setLocale) {
              i18n.setLocale(next, hrefs?.[next]);
            }
          }
        }}
      >
        {Object.entries(languages).map(([code, language]) => (
          <option key={code} value={code} lang={language.intl}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}
