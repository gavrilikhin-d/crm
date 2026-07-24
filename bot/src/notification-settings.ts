import type { InlineKeyboardMarkup } from "@telegraf/types";
import type { TelegramStudentProfile } from "@crm/shared";

export const notificationMinutePresets = [30, 60, 120, 1440];

export function resolveActiveNotificationMinutes(profile: TelegramStudentProfile): number[] {
  return profile.student.lessonReminderMinutes?.length
    ? profile.student.lessonReminderMinutes
    : profile.settings.lessonReminderMinutes;
}

const DURATION_TOKEN_SOURCE =
  "(?<![-\\d.])(\\d+)\\s*(мин(?:ут(?:а|ы|у)?)?|min(?:ute)?s?|ч(?:ас(?:а|ов)?)?|h(?:ou)?rs?|дн(?:я|ей|\\.)?|день|d(?:ay)?s?)?";

function durationTokenPattern(): RegExp {
  return new RegExp(DURATION_TOKEN_SOURCE, "gi");
}

function durationTokenToMinutes(value: number, unit: string | undefined): number | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  const normalized = (unit ?? "").toLowerCase();
  if (!normalized || normalized.startsWith("мин") || normalized.startsWith("min")) {
    return value;
  }
  if (normalized.startsWith("ч") || normalized.startsWith("h")) {
    return value * 60;
  }
  if (normalized.startsWith("д") || normalized.startsWith("d")) {
    return value * 1440;
  }

  return null;
}

export function parseNotificationMinutesPayload(payload: string): number[] {
  const minutes: number[] = [];

  for (const match of payload.matchAll(durationTokenPattern())) {
    const asMinutes = durationTokenToMinutes(Number(match[1]), match[2]);
    if (asMinutes !== null) {
      minutes.push(asMinutes);
    }
  }

  return [...new Set(minutes)].sort((a, b) => b - a).slice(0, 8);
}

/** True when the whole message is only reminder lead times, e.g. "45", "3 ч", "15 минут". */
export function looksLikeNotificationMinutesInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const parsed = parseNotificationMinutesPayload(trimmed);
  if (!parsed.length) {
    return false;
  }

  const remainder = trimmed
    .replace(durationTokenPattern(), " ")
    .replace(/[,\s]+/g, "")
    .trim();

  return remainder.length === 0;
}

export function mergeNotificationMinutes(current: number[], added: number[]): number[] {
  return [...new Set([...current, ...added])]
    .filter((item) => Number.isInteger(item) && item > 0)
    .sort((a, b) => b - a)
    .slice(0, 8);
}

export function resolveNextNotificationMinutes(
  profile: TelegramStudentProfile,
  callbackData: string
): number[] | null | "empty" {
  if (callbackData === "nt:r") {
    return null;
  }

  const match = callbackData.match(/^nt:t:(\d+)$/);
  if (!match) {
    return profile.student.lessonReminderMinutes ?? null;
  }

  const minutes = Number(match[1]);
  const current = new Set(resolveActiveNotificationMinutes(profile));
  if (current.has(minutes)) {
    current.delete(minutes);
  } else {
    current.add(minutes);
  }

  if (!current.size) {
    return "empty";
  }

  return [...current].sort((a, b) => b - a);
}

export function notificationSettingsKeyboard(profile: TelegramStudentProfile): InlineKeyboardMarkup {
  const active = resolveActiveNotificationMinutes(profile);
  const activeSet = new Set(active);
  const customMinutes = active.filter((minutes) => !notificationMinutePresets.includes(minutes));
  const buttonMinutes = [...new Set([...notificationMinutePresets, ...customMinutes])].sort(
    (a, b) => a - b
  );

  const rows = buttonMinutes.map((minutes) => [
    {
      text: `${activeSet.has(minutes) ? "✓ " : ""}${formatReminderMinutes(minutes)}`,
      callback_data: `nt:t:${minutes}`
    }
  ]);
  rows.push([{ text: "Сбросить к настройкам преподавателя", callback_data: "nt:r" }]);
  return { inline_keyboard: rows };
}

export function formatNotificationSettingsMessage(profile: TelegramStudentProfile): string {
  const isCustom = Boolean(profile.student.lessonReminderMinutes?.length);
  const active = resolveActiveNotificationMinutes(profile);
  const inheritedLine = isCustom
    ? "Сейчас используются ваши личные настройки."
    : "Сейчас используются настройки преподавателя.";

  return [
    "Напоминания о занятиях",
    inheritedLine,
    `Отправлять за: ${formatReminderMinutesList(active)}.`,
    "",
    "Нажмите на интервал, чтобы включить или выключить его.",
    "Или напишите своё время, например: 45, 15 мин, 3 ч — появится кнопка."
  ].join("\n");
}

export function formatReminderMinutesList(minutes: number[]): string {
  return minutes.map(formatReminderMinutes).join(", ");
}

export function formatReminderMinutes(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "24 часа" : `${days} дн.`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60} ч`;
  }
  return `${minutes} мин`;
}
