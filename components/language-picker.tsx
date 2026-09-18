'use client';
import { track } from '@vercel/analytics';
import { Languages } from 'lucide-react';
import { languages, resolveLocale } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';

export default function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="language-picker" title={languages[locale].name}>
      <Languages size={18} aria-hidden="true" />
      <select
        aria-label={t('语言')}
        value={locale}
        onChange={(event) => {
          const next = resolveLocale(event.target.value);
          if (next && next !== locale) {
            track('language_switch', { from: locale, to: next });
            setLocale(next);
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
