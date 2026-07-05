import { DEFAULT_LOCALE, LOCALE_TAG_BY_LOCALE, type Locale } from "@/i18n/locale";

function getLocaleTag(locale: Locale = DEFAULT_LOCALE): string {
  return LOCALE_TAG_BY_LOCALE[locale];
}

function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), options).format(new Date(value));
}

function formatTime(value: Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatFullDate(value: string | Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateTime(value: string | Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDay(value: Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), { month: "short", day: "numeric" }).format(value);
}

function formatWeekday(value: Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), { weekday: "short" }).format(value);
}

function formatMonth(value: Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), { month: "long", year: "numeric" }).format(value);
}

function formatLongDate(value: string | Date, locale?: Locale): string {
  return new Intl.DateTimeFormat(getLocaleTag(locale), { dateStyle: "long" }).format(new Date(value));
}

function formatWeekRange(days: Date[], locale?: Locale): string {
  return `${formatDay(days[0], locale)} - ${formatDay(days[6], locale)}`;
}

export {
  formatDate,
  formatTime,
  formatFullDate,
  formatDateTime,
  formatDay,
  formatWeekday,
  formatMonth,
  formatLongDate,
  formatWeekRange
};
