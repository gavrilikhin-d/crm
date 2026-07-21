import { describe, expect, test } from "bun:test";
import type { TelegramStudentProfile } from "@crm/shared";
import {
  formatTimezoneSettingsMessage,
  getSuggestedTimezonePresets,
  resolveTimezoneCallback,
  resolveTimezoneInput,
  timezoneSettingsKeyboard
} from "./timezone-picker";

function createProfile(overrides?: Partial<TelegramStudentProfile>): TelegramStudentProfile {
  return {
    student: { id: "s1", fullName: "Alice", timezone: null, ...overrides?.student },
    settings: {
      lessonReminderMinutes: [60],
      timezone: "Europe/Minsk",
      ...overrides?.settings
    },
    balance: {
      studentId: "s1",
      paidLessons: 1,
      chargedLessons: 0,
      remainingLessons: 1,
      debtLessons: 0,
      ...overrides?.balance
    },
    upcomingLessons: [],
    scheduleDays: 7
  };
}

describe("resolveTimezoneInput", () => {
  test("resolves city aliases and IANA values", () => {
    expect(resolveTimezoneInput("Москва")).toBe("Europe/Moscow");
    expect(resolveTimezoneInput("minsk")).toBe("Europe/Minsk");
    expect(resolveTimezoneInput("Europe/Berlin")).toBe("Europe/Berlin");
  });

  test("resolves reset keywords", () => {
    expect(resolveTimezoneInput("reset")).toBe("reset");
    expect(resolveTimezoneInput("сброс")).toBe("reset");
  });

  test("rejects unknown values", () => {
    expect(resolveTimezoneInput("Not/AZone")).toBeNull();
    expect(resolveTimezoneInput("")).toBeNull();
  });
});

describe("timezone picker callbacks", () => {
  test("maps preset ids and reset", () => {
    expect(resolveTimezoneCallback("tz:s:msk")).toBe("Europe/Moscow");
    expect(resolveTimezoneCallback("tz:r")).toBeNull();
    expect(resolveTimezoneCallback("tz:s:unknown")).toBe("invalid");
  });

  test("marks active timezone in keyboard", () => {
    const keyboard = timezoneSettingsKeyboard(
      createProfile({ student: { id: "s1", fullName: "Alice", timezone: "Europe/Moscow" } }),
      new Date("2024-04-01T12:00:00.000Z")
    );
    const moscow = keyboard.inline_keyboard
      .flat()
      .find((button) => (button as { callback_data?: string }).callback_data === "tz:s:msk") as
      | { text: string }
      | undefined;
    expect(moscow?.text).toContain("✓");
    expect(moscow?.text).toContain("Москва");
  });

  test("suggests only distinct offsets, but keeps Moscow and Minsk", () => {
    const now = new Date("2024-04-01T12:00:00.000Z");
    const suggested = getSuggestedTimezonePresets(now);
    const ids = suggested.map((preset) => preset.id);

    expect(ids).toContain("msk");
    expect(ids).toContain("msq");
    expect(ids).not.toContain("ist"); // same offset as Moscow/Minsk
    expect(ids).not.toContain("ber"); // same offset as Warsaw in summer
    expect(ids.filter((id, index) => ids.indexOf(id) === index)).toEqual(ids);
  });

  test("keeps active timezone even when it duplicates an offset", () => {
    const now = new Date("2024-04-01T12:00:00.000Z");
    const suggested = getSuggestedTimezonePresets(now, "Europe/Istanbul");
    expect(suggested.map((preset) => preset.id)).toContain("ist");
  });

  test("explains how to pick a city", () => {
    const text = formatTimezoneSettingsMessage(createProfile());
    expect(text).toContain("Нажмите город");
    expect(text).toContain("Москва");
  });
});
