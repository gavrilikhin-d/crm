import { describe, expect, test } from "bun:test";
import {
  commandReplyKeyboard,
  commandSuggestionsKeyboard,
  resolveCommandReplyLabel,
  resolveCommandSuggestion
} from "./commands";

describe("command suggestions", () => {
  test("builds inline keyboard for main commands", () => {
    const keyboard = commandSuggestionsKeyboard();
    const callbacks = keyboard.inline_keyboard
      .flat()
      .map((button) => (button as { callback_data?: string }).callback_data);

    expect(callbacks).toContain("cmd:schedule");
    expect(callbacks).toContain("cmd:balance");
    expect(callbacks).not.toContain("cmd:attend");
    expect(callbacks).not.toContain("cmd:decline");
    expect(callbacks).toContain("cmd:help");
  });

  test("builds persistent reply keyboard under the text input", () => {
    const keyboard = commandReplyKeyboard();
    const labels = keyboard.keyboard.flat().map((button) =>
      typeof button === "string" ? button : (button as { text: string }).text
    );

    expect(keyboard.resize_keyboard).toBe(true);
    expect(keyboard.is_persistent).toBe(true);
    expect(labels).toContain("📅 Расписание");
    expect(labels).toContain("💰 Баланс");
    expect(labels).not.toContain("👍 Буду");
    expect(labels).not.toContain("👎 Не буду");
    expect(labels).toContain("🔔 Напоминания");
  });

  test("resolves known command callbacks and reply labels", () => {
    expect(resolveCommandSuggestion("cmd:timezone")).toBe("timezone");
    expect(resolveCommandSuggestion("cmd:unknown")).toBeNull();
    expect(resolveCommandSuggestion("tz:r")).toBeNull();
    expect(resolveCommandReplyLabel("📅 Расписание")).toBe("schedule");
    expect(resolveCommandReplyLabel("👍 Буду")).toBeNull();
  });
});
