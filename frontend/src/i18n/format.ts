import { LOCALE_TAG } from "@/i18n/locale";

function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, options).format(new Date(value));
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatFullDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDay(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, { month: "short", day: "numeric" }).format(value);
}

function formatWeekday(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, { weekday: "short" }).format(value);
}

function formatMonth(value: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, { month: "long", year: "numeric" }).format(value);
}

function formatLongDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, { dateStyle: "long" }).format(new Date(value));
}

function formatWeekRange(days: Date[]): string {
  return `${formatDay(days[0])} - ${formatDay(days[6])}`;
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
