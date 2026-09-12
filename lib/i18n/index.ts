import { createInstance, type TOptions } from 'i18next';
import zh from './messages/zh-CN.json';
import en from './messages/en.json';
import ja from './messages/ja.json';

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
