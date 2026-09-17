'use client';
import { track } from '@vercel/analytics';
import { Languages } from 'lucide-react';
import { languages, resolveLocale } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';

export default function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="language-picker">
      <Languages size={16} aria-hidden="true" />
      <span className="language-name" aria-hidden="true">
        {languages[locale].name}
      </span>
      <span className="language-short" aria-hidden="true">
        {languages[locale].short}
      </span>
      <select
        aria-label={t('语言')}
        value={locale}
        onChange={(event) => {
          const next = resolveLocale(event.target.value);
          if (next) {
            setLocale(next);
            track('language_switch', { from: locale, to: next });
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
