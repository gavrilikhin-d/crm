"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator } from "@/i18n/translator";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  resolveLocaleFromPreferences,
  type Locale
} from "@/i18n/locale";
import type { TranslationKey, TranslationParams } from "@/i18n/types";

const localeCookieMaxAge = 60 * 60 * 24 * 365;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <K extends TranslationKey>(
    key: K,
    ...args: TranslationParams<K> extends undefined ? [] : [TranslationParams<K>]
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLocale(): Locale | undefined {
  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
    return isSupportedLocale(storedLocale) ? storedLocale : undefined;
  } catch {
    return undefined;
  }
}

function resolveInitialClientLocale(fallback: Locale): Locale {
  if (typeof window === "undefined") {
    return fallback;
  }

  return getStoredLocale() ?? resolveLocaleFromPreferences(window.navigator.languages, fallback);
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures; the cookie still lets the server render the selected locale.
  }
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${localeCookieMaxAge}; samesite=lax`;
  document.documentElement.lang = locale;
  delete document.documentElement.dataset.localePending;
}

function I18nProvider({
  children,
  locale = DEFAULT_LOCALE
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [currentLocale, setCurrentLocale] = useState(() => resolveInitialClientLocale(locale));

  useEffect(() => {
    persistLocale(currentLocale);
  }, [currentLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setCurrentLocale(nextLocale);
  }, []);

  const value = useMemo(() => {
    return {
      ...createTranslator(currentLocale),
      setLocale
    };
  }, [currentLocale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      ...createTranslator(DEFAULT_LOCALE),
      setLocale: () => undefined
    };
  }
  return context;
}

export { I18nProvider, useI18n };
