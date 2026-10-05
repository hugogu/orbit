import { createInstance, type TOptions } from 'i18next';
import zh from './messages/zh-CN.json';
import en from './messages/en.json';
import ja from './messages/ja.json';
import nl from './messages/nl.json';
import pt from './messages/pt.json';
import de from './messages/de.json';
import ko from './messages/ko.json';
import es from './messages/es.json';
import fr from './messages/fr.json';
import it from './messages/it.json';
import ru from './messages/ru.json';
import tr from './messages/tr.json';

// Add a catalog here to expose another language throughout the application.
export const languages = {
  'zh-CN': {
    name: '简体中文',
    short: '中',
    route: 'zh-CN',
    intl: 'zh-CN',
    messages: zh,
  },
  en: {
    name: 'English',
    short: 'EN',
    route: 'en-US',
    intl: 'en-US',
    messages: en,
  },
  ja: {
    name: '日本語',
    short: '日',
    route: 'ja-JP',
    intl: 'ja-JP',
    messages: ja,
  },
  nl: {
    name: 'Nederlands',
    short: 'NL',
    route: 'nl-NL',
    intl: 'nl-NL',
    messages: nl,
  },
  pt: {
    name: 'Português',
    short: 'PT',
    route: 'pt-BR',
    intl: 'pt-BR',
    messages: pt,
  },
  de: {
    name: 'Deutsch',
    short: 'DE',
    route: 'de-DE',
    intl: 'de-DE',
    messages: de,
  },
  ko: {
    name: '한국어',
    short: '한',
    route: 'ko-KR',
    intl: 'ko-KR',
    messages: ko,
  },
  es: {
    name: 'Español',
    short: 'ES',
    route: 'es-ES',
    intl: 'es-ES',
    messages: es,
  },
  fr: {
    name: 'Français',
    short: 'FR',
    route: 'fr-FR',
    intl: 'fr-FR',
    messages: fr,
  },
  it: {
    name: 'Italiano',
    short: 'IT',
    route: 'it-IT',
    intl: 'it-IT',
    messages: it,
  },
  ru: {
    name: 'Русский',
    short: 'RU',
    route: 'ru-RU',
    intl: 'ru-RU',
    messages: ru,
  },
  tr: {
    name: 'Türkçe',
    short: 'TR',
    route: 'tr-TR',
    intl: 'tr-TR',
    messages: tr,
  },
} as const;
export type Locale = keyof typeof languages;
export const defaultLocale: Locale = 'zh-CN';
export const localeStorageKey = 'orbit-language';
export type Translate = (key: string, values?: TOptions) => string;
export function resolveLocale(value: unknown): Locale | undefined {
  if (typeof value !== 'string') return;
  const normalized = value.toLowerCase().replaceAll('_', '-');
  const codes = Object.keys(languages) as Locale[];
  return (
    codes.find((locale) => locale.toLowerCase() === normalized) ??
    codes.find((locale) => locale.split('-')[0] === normalized.split('-')[0])
  );
}

/** The canonical regional segment used by localized static pages. */
export function localePath(locale: Locale) {
  return languages[locale].route;
}

/** Resolve only canonical regional URL segments; language aliases remain for preferences and explorer URLs. */
export function resolveLocalePath(value: unknown): Locale | undefined {
  if (typeof value !== 'string') return;
  const normalized = value.toLowerCase().replaceAll('_', '-');
  const codes = Object.keys(languages) as Locale[];
  return codes.find(
    (locale) => languages[locale].route.toLowerCase() === normalized,
  );
}
export function detectLocale(
  urlValue: unknown,
  saved: unknown,
  preferred: readonly string[],
): Locale {
  return (
    resolveLocale(urlValue) ??
    resolveLocale(saved) ??
    preferred.map(resolveLocale).find(Boolean) ??
    defaultLocale
  );
}
const translators = new Map<Locale, Translate>();
export function translator(locale: Locale = defaultLocale): Translate {
  const cached = translators.get(locale);
  if (cached) return cached;
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    resources: Object.fromEntries(
      Object.entries(languages).map(([code, language]) => [
        code,
        { translation: language.messages },
      ]),
    ),
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: true,
    interpolation: { escapeValue: false },
  });
  const t: Translate = (key, values) =>
    String(instance.t(key, { ...values, defaultValue: key }));
  translators.set(locale, t);
  return t;
}
export function languageUrl(href: string, locale: Locale) {
  const url = new URL(href);
  const segments = url.pathname.split('/');
  const currentPathLocale = resolveLocalePath(segments[1]);
  if (currentPathLocale) segments[1] = localePath(locale);
  else url.searchParams.set('lang', locale);
  url.pathname = segments.join('/');
  return url.pathname + url.search + url.hash;
}
