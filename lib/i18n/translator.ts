import { createInstance, type TOptions } from 'i18next';
import { defaultLocale, type Locale, type Translate } from './languages';

export function createTranslator(
  locale: Locale = defaultLocale,
  messages?: Record<string, string>,
): Translate {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    resources: messages
      ? {
          [locale]: { translation: messages },
        }
      : undefined,
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: true,
    interpolation: { escapeValue: false },
  });
  return (key: string, values?: TOptions) =>
    String(instance.t(key, { ...values, defaultValue: key }));
}

let syncTranslatorGetter: ((locale: Locale) => Translate) | undefined;

export function registerSyncTranslator(getter: (locale: Locale) => Translate) {
  syncTranslatorGetter = getter;
}

export function getSyncTranslator(locale: Locale): Translate | undefined {
  return syncTranslatorGetter?.(locale);
}
