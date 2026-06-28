"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator } from "@/i18n/translator";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import type { TranslationKey, TranslationParams } from "@/i18n/types";

type I18nContextValue = {
  locale: Locale;
  t: <K extends TranslationKey>(
    key: K,
    ...args: TranslationParams<K> extends undefined ? [] : [TranslationParams<K>]
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function I18nProvider({
  children,
  locale = DEFAULT_LOCALE
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const value = useMemo(() => createTranslator(locale), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return createTranslator(DEFAULT_LOCALE);
  }
  return context;
}

export { I18nProvider, useI18n };
