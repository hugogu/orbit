import type { Locale } from './languages';

const catalogCache = new Map<Locale, Record<string, string>>();

export async function loadLocaleCatalog(
  locale: Locale,
): Promise<Record<string, string>> {
  const cached = catalogCache.get(locale);
  if (cached) return cached;

  let messages: Record<string, string>;
  switch (locale) {
    case 'zh-CN':
      messages = (await import('./messages/zh-CN.json')).default;
      break;
    case 'en':
      messages = (await import('./messages/en.json')).default;
      break;
    case 'ja':
      messages = (await import('./messages/ja.json')).default;
      break;
    case 'nl':
      messages = (await import('./messages/nl.json')).default;
      break;
    case 'pt':
      messages = (await import('./messages/pt.json')).default;
      break;
    case 'de':
      messages = (await import('./messages/de.json')).default;
      break;
    case 'ko':
      messages = (await import('./messages/ko.json')).default;
      break;
    case 'es':
      messages = (await import('./messages/es.json')).default;
      break;
    case 'fr':
      messages = (await import('./messages/fr.json')).default;
      break;
    case 'it':
      messages = (await import('./messages/it.json')).default;
      break;
    case 'ru':
      messages = (await import('./messages/ru.json')).default;
      break;
    case 'tr':
      messages = (await import('./messages/tr.json')).default;
      break;
  }
  catalogCache.set(locale, messages);
  return messages;
}
