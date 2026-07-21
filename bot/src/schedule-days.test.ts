import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCHEDULE_DAYS,
  parseScheduleDaysFromPayload,
  parseScheduleDaysFromPhrase,
  resolveScheduleDaysCallback,
  scheduleDaysKeyboard
} from "./schedule-days";

describe("parseScheduleDaysFromPayload", () => {
  test("defaults to 7 days when payload is empty", () => {
    expect(parseScheduleDaysFromPayload()).toEqual({ days: DEFAULT_SCHEDULE_DAYS });
    expect(parseScheduleDaysFromPayload("   ")).toEqual({ days: DEFAULT_SCHEDULE_DAYS });
  });

  test("accepts valid day windows", () => {
    expect(parseScheduleDaysFromPayload("14")).toEqual({ days: 14 });
  });

  test("rejects invalid and out-of-range values", () => {
    expect(parseScheduleDaysFromPayload("abc").error).toContain("14");
    expect(parseScheduleDaysFromPayload("0").error).toContain("1");
    expect(parseScheduleDaysFromPayload("100").error).toContain("90");
  });
});

describe("parseScheduleDaysFromPhrase", () => {
  test("parses natural-language schedule requests", () => {
    expect(parseScheduleDaysFromPhrase("расписание на 14 дней")).toBe(14);
    expect(parseScheduleDaysFromPhrase("Расписание 3 дня")).toBe(3);
  });

  test("returns undefined for unrelated phrases", () => {
    expect(parseScheduleDaysFromPhrase("баланс")).toBeUndefined();
    expect(parseScheduleDaysFromPhrase("расписание на 100 дней")).toBeUndefined();
  });
});

describe("schedule days keyboard", () => {
  test("marks active period and resolves callbacks", () => {
    const keyboard = scheduleDaysKeyboard(14);
    const buttons = (keyboard.inline_keyboard[0] ?? []) as Array<{ callback_data?: string; text: string }>;
    expect(buttons.map((button) => button.callback_data)).toEqual([
      "sch:d:7",
      "sch:d:14",
      "sch:d:30",
      "sch:d:60"
    ]);
    expect(buttons.find((button) => button.callback_data === "sch:d:14")?.text).toContain("✓");
    expect(resolveScheduleDaysCallback("sch:d:30")).toBe(30);
    expect(resolveScheduleDaysCallback("sch:d:0")).toBeNull();
  });
});
