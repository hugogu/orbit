import type { TOptions } from 'i18next';

export type LanguageMetadata = {
  name: string;
  short: string;
  route: string;
  intl: string;
};

// Add a catalog here to expose another language throughout the application.
export const languages = {
  'zh-CN': {
    name: '简体中文',
    short: '中',
    route: 'zh-CN',
    intl: 'zh-CN',
  },
  en: {
    name: 'English',
    short: 'EN',
    route: 'en-US',
    intl: 'en-US',
  },
  ja: {
    name: '日本語',
    short: '日',
    route: 'ja-JP',
    intl: 'ja-JP',
  },
  nl: {
    name: 'Nederlands',
    short: 'NL',
    route: 'nl-NL',
    intl: 'nl-NL',
  },
  pt: {
    name: 'Português',
    short: 'PT',
    route: 'pt-BR',
    intl: 'pt-BR',
  },
  de: {
    name: 'Deutsch',
    short: 'DE',
    route: 'de-DE',
    intl: 'de-DE',
  },
  ko: {
    name: '한국어',
    short: '한',
    route: 'ko-KR',
    intl: 'ko-KR',
  },
  es: {
    name: 'Español',
    short: 'ES',
    route: 'es-ES',
    intl: 'es-ES',
  },
  fr: {
    name: 'Français',
    short: 'FR',
    route: 'fr-FR',
    intl: 'fr-FR',
  },
  it: {
    name: 'Italiano',
    short: 'IT',
    route: 'it-IT',
    intl: 'it-IT',
  },
  ru: {
    name: 'Русский',
    short: 'RU',
    route: 'ru-RU',
    intl: 'ru-RU',
  },
  tr: {
    name: 'Türkçe',
    short: 'TR',
    route: 'tr-TR',
    intl: 'tr-TR',
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

export function languageUrl(href: string, locale: Locale) {
  const url = new URL(href);
  const segments = url.pathname.split('/');
  const currentPathLocale = resolveLocalePath(segments[1]);
  if (currentPathLocale) segments[1] = localePath(locale);
  else url.searchParams.set('lang', locale);
  url.pathname = segments.join('/');
  return url.pathname + url.search + url.hash;
}
