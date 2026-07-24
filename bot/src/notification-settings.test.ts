import { describe, expect, test } from "bun:test";
import type { TelegramStudentProfile } from "@crm/shared";
import {
  looksLikeNotificationMinutesInput,
  mergeNotificationMinutes,
  notificationSettingsKeyboard,
  parseNotificationMinutesPayload,
  resolveNextNotificationMinutes
} from "./notification-settings";

function createProfile(overrides?: {
  studentMinutes?: number[] | null;
  settingsMinutes?: number[];
}): TelegramStudentProfile {
  return {
    student: {
      id: "s1",
      fullName: "Alice",
      lessonReminderMinutes: overrides?.studentMinutes === undefined ? null : overrides.studentMinutes
    },
    settings: {
      lessonReminderMinutes: overrides?.settingsMinutes ?? [1440, 120],
      timezone: "Europe/Minsk"
    },
    balance: {
      studentId: "s1",
      paidLessons: 0,
      chargedLessons: 0,
      remainingLessons: 0,
      debtLessons: 0
    },
    upcomingLessons: [],
    scheduleDays: 7
  };
}

describe("parseNotificationMinutesPayload", () => {
  test("parses comma and space separated minutes", () => {
    expect(parseNotificationMinutesPayload("45, 120")).toEqual([120, 45]);
    expect(parseNotificationMinutesPayload("30 15")).toEqual([30, 15]);
  });

  test("parses russian and english duration units", () => {
    expect(parseNotificationMinutesPayload("3 ч")).toEqual([180]);
    expect(parseNotificationMinutesPayload("72 часа")).toEqual([4320]);
    expect(parseNotificationMinutesPayload("15 мин")).toEqual([15]);
    expect(parseNotificationMinutesPayload("15 минут")).toEqual([15]);
    expect(parseNotificationMinutesPayload("1 час, 30 мин")).toEqual([60, 30]);
    expect(parseNotificationMinutesPayload("2 дня")).toEqual([2880]);
    expect(parseNotificationMinutesPayload("1 day, 2 hours")).toEqual([1440, 120]);
  });

  test("ignores invalid tokens", () => {
    expect(parseNotificationMinutesPayload("abc")).toEqual([]);
    expect(parseNotificationMinutesPayload("0, -5")).toEqual([]);
  });
});

describe("looksLikeNotificationMinutesInput", () => {
  test("accepts bare minute lists and unit phrases", () => {
    expect(looksLikeNotificationMinutesInput("45")).toBe(true);
    expect(looksLikeNotificationMinutesInput("45, 120")).toBe(true);
    expect(looksLikeNotificationMinutesInput("3 ч")).toBe(true);
    expect(looksLikeNotificationMinutesInput("72 часа")).toBe(true);
    expect(looksLikeNotificationMinutesInput("15 минут")).toBe(true);
  });

  test("rejects unrelated words and empty input", () => {
    expect(looksLikeNotificationMinutesInput("напоминания 45")).toBe(false);
    expect(looksLikeNotificationMinutesInput("Москва")).toBe(false);
    expect(looksLikeNotificationMinutesInput("")).toBe(false);
  });
});

describe("mergeNotificationMinutes", () => {
  test("adds custom minutes to the current set", () => {
    expect(mergeNotificationMinutes([1440, 120], [45])).toEqual([1440, 120, 45]);
  });
});

describe("notificationSettingsKeyboard", () => {
  test("includes custom active minutes as toggle buttons sorted by time", () => {
    const keyboard = notificationSettingsKeyboard(
      createProfile({ studentMinutes: [1440, 120, 45] })
    );
    const minuteButtons = keyboard.inline_keyboard
      .flat()
      .filter((button) => button.callback_data?.startsWith("nt:t:"))
      .map((button) => button.callback_data);

    expect(minuteButtons).toEqual(["nt:t:30", "nt:t:45", "nt:t:60", "nt:t:120", "nt:t:1440"]);
    expect(
      keyboard.inline_keyboard.flat().some(
        (button) => button.text.startsWith("✓ ") && button.text.includes("45 мин")
      )
    ).toBe(true);
  });

  test("keeps preset buttons even when inactive", () => {
    const keyboard = notificationSettingsKeyboard(createProfile({ studentMinutes: [45] }));
    const callbacks = keyboard.inline_keyboard.flat().map((button) => button.callback_data);

    expect(callbacks).toContain("nt:t:30");
    expect(callbacks).toContain("nt:t:45");
    expect(callbacks).not.toContain("nt:t:15");
    expect(callbacks).toContain("nt:r");
  });
});

describe("resolveNextNotificationMinutes", () => {
  test("toggles a custom button on and off", () => {
    const withCustom = createProfile({ studentMinutes: [120, 45] });
    expect(resolveNextNotificationMinutes(withCustom, "nt:t:45")).toEqual([120]);

    const withoutCustom = createProfile({ studentMinutes: [120] });
    expect(resolveNextNotificationMinutes(withoutCustom, "nt:t:45")).toEqual([120, 45]);
  });
});
