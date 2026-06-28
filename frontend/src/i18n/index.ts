import { createTranslator } from "@/i18n/translator";
import { DEFAULT_LOCALE, LOCALE_TAG } from "@/i18n/locale";

const { t, locale } = createTranslator(DEFAULT_LOCALE);

export { t, locale, DEFAULT_LOCALE, LOCALE_TAG, createTranslator };
export type { TranslationKey, TranslationParams } from "@/i18n/types";
