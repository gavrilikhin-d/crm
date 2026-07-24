import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Reminder, Student } from "@crm/shared";
import type { ClaimedLessonReminder, PaymentReminderContext } from "@crm/shared/lesson-reminder";

const student: Student = {
  id: "s-pay",
  fullName: "Pay Student",
  telegramChatId: "999",
  telegramBindToken: "token",
  status: "active",
  defaultLessonPrice: 3000,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const paymentContext: PaymentReminderContext = {
  accountId: "acc-1",
  student,
  balance: {
    studentId: student.id,
    remainingLessons: 0,
    debtLessons: 2
  }
};

const claimed: ClaimedLessonReminder = {
  reminderId: "rem-lesson-1",
  accountId: "acc-1",
  leadMinutes: 60,
  scheduledFor: "2026-06-30T17:00:00.000Z",
  timeZone: "Europe/Minsk",
  student: {
    id: "s1",
    fullName: "Lesson Student",
    telegramChatId: "111"
  },
  lesson: {
    id: "l1",
    startsAt: "2026-06-30T18:00:00.000Z",
    durationMinutes: 60,
    effectiveType: "individual",
    participants: [
      {
        id: "p1",
        studentId: "s1",
        status: "awaiting",
        balanceCharged: false,
        hasDebt: false
      }
    ]
  }
};

const sendPaymentReminder = mock(() => Promise.resolve());
const sendLessonReminder = mock(() => Promise.resolve());
const upsertReminder = mock(() =>
  Promise.resolve({
    id: "rem-1",
    type: "payment",
    studentId: student.id,
    scheduledFor: "2026-06-30T12:00:00.000Z",
    status: "pending",
    createdAt: "2026-06-30T12:00:00.000Z"
  } satisfies Reminder)
);
const updateReminder = mock(() => Promise.resolve({} as Reminder));
const claimDueLessonReminders = mock(() => Promise.resolve([claimed]));
const getPaymentReminderContext = mock(() => Promise.resolve(paymentContext));
const backfillLessonReminders = mock(() => Promise.resolve({ accounts: 1, lessons: 1 }));

mock.module("./backend-client", () => ({
  claimDueLessonReminders,
  backfillLessonReminders,
  getPaymentReminderContext,
  upsertReminder,
  updateReminder
}));

mock.module("./telegram", () => ({
  sendLessonReminder,
  sendPaymentReminder
}));

const { runReminderTick, sendManualPaymentReminder } = await import("./reminders");

describe("runReminderTick", () => {
  beforeEach(() => {
    sendLessonReminder.mockClear();
    updateReminder.mockClear();
    claimDueLessonReminders.mockReset();
    claimDueLessonReminders.mockImplementation(() => Promise.resolve([claimed]));
  });

  test("claims due reminders, sends, and marks sent", async () => {
    await runReminderTick();

    expect(claimDueLessonReminders).toHaveBeenCalledWith(50);
    expect(sendLessonReminder).toHaveBeenCalledTimes(1);
    expect(updateReminder).toHaveBeenCalledWith("rem-lesson-1", {
      status: "sent",
      sentAt: expect.any(String),
      telegramChatId: "111",
      leadMinutes: 60
    });
  });

  test("no-ops when claim returns empty", async () => {
    claimDueLessonReminders.mockImplementationOnce(() => Promise.resolve([]));

    await runReminderTick();

    expect(sendLessonReminder).not.toHaveBeenCalled();
    expect(updateReminder).not.toHaveBeenCalled();
  });

  test("marks failed when telegram send throws", async () => {
    sendLessonReminder.mockImplementationOnce(() => Promise.reject(new Error("telegram down")));

    await runReminderTick();

    expect(updateReminder).toHaveBeenCalledWith("rem-lesson-1", {
      status: "failed",
      error: "telegram down",
      telegramChatId: "111",
      leadMinutes: 60
    });
  });
});

describe("sendManualPaymentReminder", () => {
  beforeEach(() => {
    sendPaymentReminder.mockClear();
    upsertReminder.mockClear();
    updateReminder.mockClear();
    getPaymentReminderContext.mockReset();
    getPaymentReminderContext.mockImplementation(() => Promise.resolve(paymentContext));
  });

  test("sends payment reminder and marks reminder as sent", async () => {
    const result = await sendManualPaymentReminder(student.id);

    expect(result).toEqual({ sent: true });
    expect(getPaymentReminderContext).toHaveBeenCalledWith(student.id);
    expect(sendPaymentReminder).toHaveBeenCalledWith(student, paymentContext.balance.debtLessons);
    expect(updateReminder).toHaveBeenCalledWith("rem-1", {
      status: "sent",
      sentAt: expect.any(String),
      telegramChatId: student.telegramChatId
    });
  });

  test("returns skip reason when student has paid lessons", async () => {
    getPaymentReminderContext.mockImplementationOnce(() =>
      Promise.resolve({
        ...paymentContext,
        balance: { studentId: student.id, remainingLessons: 3, debtLessons: 0 }
      })
    );

    const result = await sendManualPaymentReminder(student.id);

    expect(result).toEqual({
      sent: false,
      reason: "У ученика есть оплаченные занятия на балансе."
    });
    expect(sendPaymentReminder).not.toHaveBeenCalled();
  });
});
