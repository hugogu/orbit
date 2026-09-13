'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  defaultLocale,
  detectLocale,
  languages,
  languageUrl,
  localeStorageKey,
  resolveLocale,
  translator,
  type Locale,
  type Translate,
} from './index';

type I18n = {
  locale: Locale;
  t: Translate;
  setLocale: (locale: Locale) => void;
};
const Context = createContext<I18n>({
  locale: defaultLocale,
  t: translator(),
  setLocale: () => {},
});
export function I18nProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children?: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  useEffect(() => {
    const restore = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(localeStorageKey);
      } catch {
        /* Device preferences are optional. */
      }
      const url = new URL(window.location.href);
      const pathLocale = resolveLocale(url.pathname.split('/')[1]);
      updateLocale(
        detectLocale(
          pathLocale ?? url.searchParams.get('lang'),
          saved,
          navigator.languages,
        ),
      );
    };
    queueMicrotask(restore);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try {
      localStorage.setItem(localeStorageKey, next);
    } catch {
      /* Still usable with storage disabled. */
    }
    // Localized profile routes replace their regional segment; the explorer keeps its language query.
    window.history.replaceState(
      window.history.state,
      '',
      languageUrl(window.location.href, next),
    );
  }, []);
  const value = useMemo(
    () => ({ locale, setLocale, t: translator(locale) }),
    [locale, setLocale],
  );
  useEffect(() => {
    document.documentElement.lang = languages[locale].intl;
    // Profile routes own their metadata; only the explorer changes it client-side.
    if (window.location.pathname !== '/') return;
    document.title = value.t('ORBIT · 太阳系漫游');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        value.t(
          '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
        ),
      );
  }, [locale, value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);
