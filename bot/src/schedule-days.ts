import type { InlineKeyboardMarkup } from "@telegraf/types";
import { getInlineCallbackData } from "./inline-keyboard";

const DEFAULT_SCHEDULE_DAYS = 7;
const ATTENDANCE_SCHEDULE_DAYS = 60;
const MIN_SCHEDULE_DAYS = 1;
const MAX_SCHEDULE_DAYS = 90;
const SCHEDULE_DAY_PRESETS = [7, 14, 30, 60] as const;

const SCHEDULE_COMMANDS = ["schedule", "shedule", "lessons", "расписание"] as const;

function normalizeScheduleDays(value?: number): number {
  if (value === undefined || !Number.isFinite(value) || !Number.isInteger(value)) {
    return DEFAULT_SCHEDULE_DAYS;
  }

  return Math.min(MAX_SCHEDULE_DAYS, Math.max(MIN_SCHEDULE_DAYS, value));
}

function parseScheduleDaysFromPayload(payload?: string): { days: number; error?: string } {
  const rawDays = payload?.trim().split(/\s+/)[0];
  if (!rawDays) {
    return { days: DEFAULT_SCHEDULE_DAYS };
  }

  const parsed = Number(rawDays);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return {
      days: DEFAULT_SCHEDULE_DAYS,
      error: `Укажите число дней от ${MIN_SCHEDULE_DAYS} до ${MAX_SCHEDULE_DAYS}, например: /schedule 14`
    };
  }

  if (parsed < MIN_SCHEDULE_DAYS || parsed > MAX_SCHEDULE_DAYS) {
    return {
      days: DEFAULT_SCHEDULE_DAYS,
      error: `Окно должно быть от ${MIN_SCHEDULE_DAYS} до ${MAX_SCHEDULE_DAYS} дней. Пример: /schedule 14`
    };
  }

  return { days: parsed };
}

function parseScheduleDaysFromPhrase(text: string): number | undefined {
  const match = text.trim().match(/^расписание(?:\s+на)?\s+(\d+)\s*(?:дн(?:я|ей)?)?$/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < MIN_SCHEDULE_DAYS || parsed > MAX_SCHEDULE_DAYS) {
    return undefined;
  }

  return parsed;
}

function scheduleDaysKeyboard(activeDays: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      SCHEDULE_DAY_PRESETS.map((days) => ({
        text: `${activeDays === days ? "✓ " : ""}${days} дн.`,
        callback_data: `sch:d:${days}`
      }))
    ]
  };
}

function resolveScheduleDaysCallback(callbackData: string): number | null {
  const match = callbackData.match(/^sch:d:(\d+)$/);
  if (!match) {
    return null;
  }

  const days = Number(match[1]);
  if (!Number.isInteger(days) || days < MIN_SCHEDULE_DAYS || days > MAX_SCHEDULE_DAYS) {
    return null;
  }

  return days;
}

function resolveActiveScheduleDaysFromMarkup(markup: InlineKeyboardMarkup | undefined): number | null {
  const buttons = markup?.inline_keyboard.flat() ?? [];
  const hasScheduleDays = buttons.some((button) => getInlineCallbackData(button)?.startsWith("sch:d:"));
  if (!hasScheduleDays) {
    return null;
  }

  const active = buttons.find((button) => {
    const callbackData = getInlineCallbackData(button);
    return Boolean(callbackData?.startsWith("sch:d:") && button.text.startsWith("✓ "));
  });
  const activeCallbackData = active ? getInlineCallbackData(active) : undefined;
  if (activeCallbackData) {
    return resolveScheduleDaysCallback(activeCallbackData);
  }

  return DEFAULT_SCHEDULE_DAYS;
}

export {
  ATTENDANCE_SCHEDULE_DAYS,
  DEFAULT_SCHEDULE_DAYS,
  MAX_SCHEDULE_DAYS,
  MIN_SCHEDULE_DAYS,
  SCHEDULE_COMMANDS,
  SCHEDULE_DAY_PRESETS,
  normalizeScheduleDays,
  parseScheduleDaysFromPhrase,
  parseScheduleDaysFromPayload,
  resolveActiveScheduleDaysFromMarkup,
  resolveScheduleDaysCallback,
  scheduleDaysKeyboard
};
