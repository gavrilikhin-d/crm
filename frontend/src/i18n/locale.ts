const DEFAULT_LOCALE = "ru" as const;
const LOCALE_TAG = "ru-RU";

type Locale = typeof DEFAULT_LOCALE;

export { DEFAULT_LOCALE, LOCALE_TAG, type Locale };
