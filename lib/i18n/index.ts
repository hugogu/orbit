import { createInstance } from 'i18next';
import {
  defaultLocale,
  languages as metaLanguages,
  type LanguageMetadata,
  type Locale,
  type Translate,
} from './languages';
import { registerSyncTranslator } from './translator';

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

export * from './languages';

export const serverCatalogs: Record<Locale, Record<string, string>> = {
  'zh-CN': zh,
  en,
  ja,
  nl,
  pt,
  de,
  ko,
  es,
  fr,
  it,
  ru,
  tr,
};

export function getMessages(locale: Locale): Record<string, string> {
  return serverCatalogs[locale] ?? serverCatalogs[defaultLocale];
}

export type LocalizedLanguage = LanguageMetadata & {
  messages: Record<string, string>;
};

// Augmented languages map providing messages for server-side code and test suites.
export const languages = Object.fromEntries(
  Object.entries(metaLanguages).map(([code, meta]) => [
    code,
    {
      ...meta,
      messages: serverCatalogs[code as Locale],
    },
  ]),
) as Record<Locale, LocalizedLanguage>;

const translators = new Map<Locale, Translate>();

export function translator(locale: Locale = defaultLocale): Translate {
  const cached = translators.get(locale);
  if (cached) return cached;
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    resources: Object.fromEntries(
      Object.entries(serverCatalogs).map(([code, messages]) => [
        code,
        { translation: messages },
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

registerSyncTranslator(translator);
