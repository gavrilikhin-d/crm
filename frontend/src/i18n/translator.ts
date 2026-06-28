import { ru } from "@/i18n/locales/ru";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import type { TranslationKey, TranslationParams } from "@/i18n/types";

const locales = { ru } as const;

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

  if (typeof value !== "string") {
    throw new Error(`Missing translation for key: ${path}`);
  }

  return value;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function createTranslator(locale: Locale = DEFAULT_LOCALE) {
  const dictionary = locales[locale];

  function t<K extends TranslationKey>(
    key: K,
    ...args: TranslationParams<K> extends undefined ? [] : [TranslationParams<K>]
  ): string {
    const params = args[0];
    return interpolate(getNestedValue(dictionary, key), params);
  }

  return { t, locale };
}

export { createTranslator, getNestedValue, interpolate };
