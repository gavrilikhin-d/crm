import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Database, Reminder, Student, StudentBalance } from "@crm/shared";

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

const balance: StudentBalance = {
  studentId: student.id,
  paidLessons: 0,
  chargedLessons: 1,
  remainingLessons: 0,
  debtLessons: 2
};

const settings: Database["settings"] = {
  lessonReminderMinutes: [60],
  individualDurationMinutes: 60,
  groupDurationMinutes: 90,
  defaultSingleLessonPrice: 3000,
  currency: "RUB",
  cancellationPolicy: "free"
};

const sendPaymentReminder = mock(() => Promise.resolve());
const upsertReminder = mock(() =>
  Promise.resolve({
    id: "rem-1",
    type: "payment",
    studentId: student.id,
    scheduledFor: "2026-06-30T12:00:00.000Z",
    status: "pending",
    dedupeKey: "payment:s-pay:2026-06-30",
    createdAt: "2026-06-30T12:00:00.000Z"
  } satisfies Reminder)
);
const updateReminder = mock(() => Promise.resolve({} as Reminder));
const getWorkerSnapshots = mock(() =>
  Promise.resolve([
    {
      accountId: "acc-1",
      snapshot: {
        students: [student],
        lessons: [],
        lessonPackages: [],
        recurringSchedules: [],
        payments: [],
        reminders: [],
        telegramInteractions: [],
        balanceAdjustments: [],
        vacationPeriods: [],
        settings
      },
      balances: [balance],
      settings
    }
  ])
);

mock.module("./backend-client", () => ({
  getWorkerSnapshots,
  upsertReminder,
  updateReminder
}));

mock.module("./telegram", () => ({
  sendLessonReminder: mock(() => Promise.resolve()),
  sendPaymentReminder
}));

const { sendManualPaymentReminder } = await import("./reminders");

describe("sendManualPaymentReminder", () => {
  beforeEach(() => {
    sendPaymentReminder.mockClear();
    upsertReminder.mockClear();
    updateReminder.mockClear();
    getWorkerSnapshots.mockReset();
    getWorkerSnapshots.mockImplementation(() =>
      Promise.resolve([
        {
          accountId: "acc-1",
          snapshot: {
            students: [student],
            lessons: [],
            lessonPackages: [],
            recurringSchedules: [],
            payments: [],
            reminders: [],
            telegramInteractions: [],
            balanceAdjustments: [],
        vacationPeriods: [],
            settings
          },
          balances: [balance],
          settings
        }
      ])
    );
  });

  test("sends payment reminder and marks reminder as sent", async () => {
    const result = await sendManualPaymentReminder(student.id);

    expect(result).toEqual({ sent: true });
    expect(sendPaymentReminder).toHaveBeenCalledWith(student, balance.debtLessons);
    expect(updateReminder).toHaveBeenCalledWith("rem-1", {
      status: "sent",
      sentAt: expect.any(String)
    });
  });

  test("returns skip reason when student has paid lessons", async () => {
    getWorkerSnapshots.mockImplementationOnce(() =>
      Promise.resolve([
        {
          accountId: "acc-1",
          snapshot: {
            students: [student],
            lessons: [],
            lessonPackages: [],
            recurringSchedules: [],
            payments: [],
            reminders: [],
            telegramInteractions: [],
            balanceAdjustments: [],
        vacationPeriods: [],
            settings
          },
          balances: [{ ...balance, remainingLessons: 3, debtLessons: 0 }],
          settings
        }
      ])
    );

    const result = await sendManualPaymentReminder(student.id);

    expect(result).toEqual({
      sent: false,
      reason: "У ученика есть оплаченные занятия на балансе."
    });
    expect(sendPaymentReminder).not.toHaveBeenCalled();
  });
});
