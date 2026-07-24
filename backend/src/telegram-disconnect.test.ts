import { describe, expect, test } from "bun:test";
import { formatTelegramDisconnectMessage } from "./telegram-disconnect";

describe("formatTelegramDisconnectMessage", () => {
  test("names the deleted teacher", () => {
    expect(formatTelegramDisconnectMessage("Alice Teacher")).toBe(
      "Аккаунт преподавателя Alice Teacher удалён. Telegram-подключение к CRM отключено, напоминания больше не будут приходить."
    );
  });
});
