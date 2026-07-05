const SUPPORTED_LOCALES = ["ru", "en"] as const;
const LOCALE_STORAGE_KEY = "crm.locale";
const LOCALE_COOKIE_NAME = "crm.locale";
const LOCALE_TAG_BY_LOCALE = {
  ru: "ru-RU",
  en: "en-US"
} as const;

type Locale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

function resolveLocale(value: string | undefined): Locale {
  return isSupportedLocale(value) ? value : "ru";
}

function resolveLocaleFromPreferences(preferences: readonly string[], fallback: Locale = DEFAULT_LOCALE): Locale {
  for (const preference of preferences) {
    const [language] = preference.toLowerCase().split("-");
    if (isSupportedLocale(language)) {
      return language;
    }
  }

  return fallback;
}

const DEFAULT_LOCALE = resolveLocale(process.env.NEXT_PUBLIC_LOCALE);
const LOCALE_TAG = LOCALE_TAG_BY_LOCALE[DEFAULT_LOCALE];

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  LOCALE_TAG,
  LOCALE_TAG_BY_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveLocale,
  resolveLocaleFromPreferences,
  type Locale
};
