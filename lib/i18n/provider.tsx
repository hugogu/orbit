'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  defaultLocale,
  detectLocale,
  languages,
  languageUrl,
  localeStorageKey,
  resolveLocale,
  type Locale,
  type Translate,
} from './languages';
import { loadLocaleCatalog } from './loader';
import { createTranslator, getSyncTranslator } from './translator';

type I18n = {
  locale: Locale;
  t: Translate;
  setLocale: (locale: Locale, href?: string) => void;
};

const defaultContext: I18n = {
  locale: defaultLocale,
  t: (key: string) => key,
  setLocale: () => {},
};

const Context = createContext<I18n>(defaultContext);

type CatalogState = {
  locale: Locale;
  catalog: Record<string, string>;
};

export function I18nProvider({
  children,
  initialLocale = defaultLocale,
  initialMessages,
}: {
  children?: React.ReactNode;
  initialLocale?: Locale;
  initialMessages?: Record<string, string>;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<CatalogState | undefined>(
    initialMessages
      ? { locale: initialLocale, catalog: initialMessages }
      : undefined,
  );

  const live = useRef(true);
  const request = useRef(0);

  useEffect(() => {
    live.current = true;
    const restore = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(localeStorageKey);
      } catch {
        /* Device preferences are optional. */
      }
      const url = new URL(window.location.href);
      const pathLocale = resolveLocale(url.pathname.split('/')[1]);
      const nextLocale = detectLocale(
        pathLocale ?? url.searchParams.get('lang'),
        saved,
        navigator.languages,
      );
      updateLocale(nextLocale);
      const ticket = ++request.current;
      void loadLocaleCatalog(nextLocale).then((loaded) => {
        if (!live.current || ticket !== request.current) return;
        setMessages({ locale: nextLocale, catalog: loaded });
      });
    };
    queueMicrotask(restore);
    window.addEventListener('popstate', restore);
    return () => {
      live.current = false;
      window.removeEventListener('popstate', restore);
    };
  }, []);

  const setLocale = useCallback((next: Locale, href?: string) => {
    updateLocale(next);
    const ticket = ++request.current;
    void loadLocaleCatalog(next).then((loaded) => {
      if (!live.current || ticket !== request.current) return;
      setMessages({ locale: next, catalog: loaded });
    });
    try {
      localStorage.setItem(localeStorageKey, next);
    } catch {
      /* Still usable with storage disabled. */
    }
    if (href) {
      window.location.assign(href);
    } else {
      // Localized profile routes replace their regional segment; the explorer keeps its language query.
      window.history.replaceState(
        window.history.state,
        '',
        languageUrl(window.location.href, next),
      );
    }
  }, []);

  const t = useMemo(() => {
    const syncT = getSyncTranslator(locale);
    if (syncT) return syncT;
    const catalog = messages?.locale === locale ? messages.catalog : undefined;
    return createTranslator(locale, catalog);
  }, [locale, messages]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  useEffect(() => {
    document.documentElement.lang = languages[locale].intl;
    // Profile routes own their metadata; only the explorer changes it client-side.
    if (window.location.pathname !== '/') return;
    document.title = value.t('Orbits Observer：实时三维太阳系探索');
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
export const useOptionalI18n = () => {
  const context = useContext(Context);
  return context === defaultContext ? null : context;
};
