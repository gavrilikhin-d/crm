import { describe, expect, test } from "bun:test";
import { shouldSendManualPaymentReminder } from "./reminder-logic";

describe("shouldSendManualPaymentReminder", () => {
  test("allows send when balance is empty or in debt", () => {
    expect(shouldSendManualPaymentReminder({ balance: { remainingLessons: 0, debtLessons: 0 }, telegramChatId: "1" })).toEqual({
      send: true
    });
    expect(shouldSendManualPaymentReminder({ balance: { remainingLessons: 2, debtLessons: 1 }, telegramChatId: "1" })).toEqual({
      send: true
    });
  });

  test("blocks send when balance is healthy or telegram is missing", () => {
    expect(
      shouldSendManualPaymentReminder({ balance: { remainingLessons: 2, debtLessons: 0 }, telegramChatId: "1" })
    ).toEqual({
      send: false,
      reason: "У ученика есть оплаченные занятия на балансе."
    });
    expect(shouldSendManualPaymentReminder({ balance: { remainingLessons: 0, debtLessons: 1 } })).toEqual({
      send: false,
      reason: "У ученика не указан Telegram chat id."
    });
  });
});
