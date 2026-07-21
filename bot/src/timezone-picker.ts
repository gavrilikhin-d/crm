import type { InlineKeyboardMarkup } from "@telegraf/types";
import type { TelegramStudentProfile } from "@crm/shared";
import { formatInTimeZone, isValidTimeZone } from "@crm/shared/timezone";
import { resolveProfileTimeZone } from "./messages";

export type TimezonePreset = {
  id: string;
  timeZone: string;
  label: string;
  aliases: string[];
};

export const timezonePresets: TimezonePreset[] = [
  {
    id: "msk",
    timeZone: "Europe/Moscow",
    label: "Москва",
    aliases: ["москва", "moscow", "мск", "msk", "russia", "россия"]
  },
  {
    id: "msq",
    timeZone: "Europe/Minsk",
    label: "Минск",
    aliases: ["минск", "minsk", "беларусь", "belarus", "by"]
  },
  {
    id: "kie",
    timeZone: "Europe/Kyiv",
    label: "Киев",
    aliases: ["киев", "київ", "kyiv", "kiev", "украина", "ukraine"]
  },
  {
    id: "waw",
    timeZone: "Europe/Warsaw",
    label: "Варшава",
    aliases: ["варшава", "warsaw", "польша", "poland"]
  },
  {
    id: "ber",
    timeZone: "Europe/Berlin",
    label: "Берлин",
    aliases: ["берлин", "berlin", "германия", "germany"]
  },
  {
    id: "lon",
    timeZone: "Europe/London",
    label: "Лондон",
    aliases: ["лондон", "london", "uk", "britain"]
  },
  {
    id: "ist",
    timeZone: "Europe/Istanbul",
    label: "Стамбул",
    aliases: ["стамбул", "istanbul", "турция", "turkey"]
  },
  {
    id: "dxb",
    timeZone: "Asia/Dubai",
    label: "Дубай",
    aliases: ["дубай", "dubai", "оаэ", "uae"]
  },
  {
    id: "tash",
    timeZone: "Asia/Tashkent",
    label: "Ташкент",
    aliases: ["ташкент", "tashkent", "узбекистан", "uzbekistan"]
  },
  {
    id: "alm",
    timeZone: "Asia/Almaty",
    label: "Алматы",
    aliases: ["алматы", "almaty", "казахстан", "kazakhstan"]
  },
  {
    id: "nyc",
    timeZone: "America/New_York",
    label: "Нью-Йорк",
    aliases: ["нью-йорк", "ньюйорк", "new york", "newyork", "ny", "est", "сша", "usa"]
  },
  {
    id: "utc",
    timeZone: "UTC",
    label: "UTC",
    aliases: ["utc", "gmt", "гринвич"]
  }
];

export function resolveTimezoneInput(raw: string): string | "reset" | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().replaceAll("_", " ").replaceAll("/", " ");
  if (normalized === "reset" || normalized === "default" || normalized === "сброс") {
    return "reset";
  }

  if (isValidTimeZone(value)) {
    return value;
  }

  const byAlias = timezonePresets.find(
    (preset) =>
      preset.label.toLowerCase() === normalized ||
      preset.id === normalized ||
      preset.timeZone.toLowerCase() === value.toLowerCase() ||
      preset.aliases.some((alias) => alias === normalized)
  );
  return byAlias?.timeZone ?? null;
}

const alwaysSuggestedTimeZones = new Set(["Europe/Moscow", "Europe/Minsk"]);

export function getSuggestedTimezonePresets(
  now = new Date(),
  activeTimeZone?: string | null
): TimezonePreset[] {
  const seenOffsets = new Set<string>();
  const suggested: TimezonePreset[] = [];

  for (const preset of timezonePresets) {
    const offsetKey = getUtcOffsetKey(preset.timeZone, now);
    const keepAlways = alwaysSuggestedTimeZones.has(preset.timeZone);
    const isActive = preset.timeZone === activeTimeZone;

    if (!keepAlways && !isActive && seenOffsets.has(offsetKey)) {
      continue;
    }

    seenOffsets.add(offsetKey);
    suggested.push(preset);
  }

  return suggested;
}

function getUtcOffsetKey(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit"
  }).formatToParts(now);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function timezoneSettingsKeyboard(profile: TelegramStudentProfile, now = new Date()): InlineKeyboardMarkup {
  const active = resolveProfileTimeZone(profile);
  const rows = getSuggestedTimezonePresets(now, active).map((preset) => {
    const localTime = formatInTimeZone(now, preset.timeZone, {
      hour: "numeric",
      minute: "2-digit",
      hour12: false
    });
    const selected = active === preset.timeZone ? "✓ " : "";
    return [
      {
        text: `${selected}${preset.label} · ${localTime}`,
        callback_data: `tz:s:${preset.id}`
      }
    ];
  });

  rows.push([{ text: "Сбросить к настройкам преподавателя", callback_data: "tz:r" }]);
  return { inline_keyboard: rows };
}

export function resolveTimezoneCallback(callbackData: string): string | null | "invalid" {
  if (callbackData === "tz:r") {
    return null;
  }

  const match = callbackData.match(/^tz:s:([a-z0-9]+)$/);
  if (!match) {
    return "invalid";
  }

  const preset = timezonePresets.find((item) => item.id === match[1]);
  return preset?.timeZone ?? "invalid";
}

export function formatTimezoneSettingsMessage(profile: TelegramStudentProfile, prefix?: string): string {
  const effective = resolveProfileTimeZone(profile);
  const teacherTimezone = profile.settings.timezone;
  const isCustom = Boolean(profile.student.timezone);
  const preset = timezonePresets.find((item) => item.timeZone === effective);
  const effectiveLabel = preset ? `${preset.label} (${effective})` : effective;
  const localTime = formatInTimeZone(new Date(), effective, {
    hour: "numeric",
    minute: "2-digit",
    hour12: false
  });

  return [
    prefix,
    "Часовой пояс уведомлений",
    isCustom
      ? `Сейчас используется ваш личный пояс: ${effectiveLabel}.`
      : `Сейчас используется пояс преподавателя: ${effectiveLabel}.`,
    `Сейчас у вас: ${localTime}.`,
    `Пояс преподавателя: ${teacherTimezone}.`,
    "",
    "Нажмите город ниже или напишите название, например: Москва."
  ]
    .filter(Boolean)
    .join("\n");
}
