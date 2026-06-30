import { describe, expect, test } from "bun:test";
import type { Database, Lesson, Student } from "@crm/shared";
import {
  collectPendingLessonReminders,
  isLessonReminderDue,
  isSkippedLessonStatus,
  isSkippedParticipantStatus,
  shouldSendManualPaymentReminder
} from "./reminder-logic";

function createStudent(id: string): Student {
  const timestamp = new Date().toISOString();
  return {
    id,
    fullName: `Student ${id}`,
    telegramChatId: "12345",
    telegramBindToken: "token",
    status: "active",
    defaultLessonPrice: 3000,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createLesson(input: {
  id: string;
  startsAt: string;
  status?: Lesson["status"];
  studentIds: string[];
  participantStatuses?: string[];
}): Lesson {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    startsAt: input.startsAt,
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: input.status ?? "scheduled",
    participants: input.studentIds.map((studentId, index) => ({
      id: `p-${studentId}`,
      studentId,
      status: (input.participantStatuses?.[index] ?? "awaiting") as Lesson["participants"][number]["status"],
      balanceCharged: false,
      hasDebt: false
    })),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createSnapshot(input: {
  accountId?: string;
  students: Student[];
  lessons: Lesson[];
  leadMinutes?: number[];
}): Parameters<typeof collectPendingLessonReminders>[0] {
  const settings: Database["settings"] = {
    lessonReminderMinutes: input.leadMinutes ?? [60],
    individualDurationMinutes: 60,
    groupDurationMinutes: 90,
    defaultSingleLessonPrice: 3000,
    currency: "RUB",
    cancellationPolicy: "free"
  };

  return [
    {
      accountId: input.accountId ?? "acc-1",
      snapshot: {
        students: input.students,
        lessons: input.lessons,
        lessonPackages: [],
        recurringSchedules: [],
        payments: [],
        reminders: [],
        telegramInteractions: [],
        balanceAdjustments: [],
        vacationPeriods: [],
        settings
      },
      settings
    }
  ];
}

describe("isLessonReminderDue", () => {
  test("sends when lead window has started and lesson is still in the future", () => {
    const lessonStartsAtMs = Date.parse("2026-06-30T18:00:00.000Z");
    const nowMs = Date.parse("2026-06-30T17:05:00.000Z");

    expect(isLessonReminderDue({ nowMs, lessonStartsAtMs, leadMinutes: 60 })).toBe(true);
  });

  test("does not send after lesson start", () => {
    const lessonStartsAtMs = Date.parse("2026-06-30T18:00:00.000Z");
    const nowMs = Date.parse("2026-06-30T18:01:00.000Z");

    expect(isLessonReminderDue({ nowMs, lessonStartsAtMs, leadMinutes: 60 })).toBe(false);
  });

  test("does not send before lead window", () => {
    const lessonStartsAtMs = Date.parse("2026-06-30T18:00:00.000Z");
    const nowMs = Date.parse("2026-06-30T16:30:00.000Z");

    expect(isLessonReminderDue({ nowMs, lessonStartsAtMs, leadMinutes: 60 })).toBe(false);
  });
});

describe("collectPendingLessonReminders", () => {
  test("collects awaiting participants inside the reminder window", () => {
    const student = createStudent("s1");
    const startsAt = "2026-06-30T18:00:00.000Z";
    const nowMs = Date.parse("2026-06-30T17:10:00.000Z");
    const snapshots = createSnapshot({
      students: [student],
      lessons: [createLesson({ id: "l1", startsAt, studentIds: ["s1"] })]
    });

    const pending = collectPendingLessonReminders(snapshots, nowMs);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.dedupeKey).toBe("lesson:l1:s1:60");
    expect(pending[0]?.student.id).toBe("s1");
  });

  test("skips cancelled lessons and already answered participants", () => {
    const student = createStudent("s1");
    const startsAt = "2026-06-30T18:00:00.000Z";
    const nowMs = Date.parse("2026-06-30T17:10:00.000Z");
    const snapshots = createSnapshot({
      students: [student],
      lessons: [
        createLesson({
          id: "cancelled",
          startsAt,
          status: "cancelled_by_teacher",
          studentIds: ["s1"]
        }),
        createLesson({
          id: "answered",
          startsAt,
          studentIds: ["s1"],
          participantStatuses: ["confirmed"]
        })
      ]
    });

    expect(collectPendingLessonReminders(snapshots, nowMs)).toHaveLength(0);
  });

  test("emits one reminder per configured lead time", () => {
    const student = createStudent("s1");
    const startsAt = "2026-06-30T18:00:00.000Z";
    const nowMs = Date.parse("2026-06-30T17:10:00.000Z");
    const snapshots = createSnapshot({
      students: [student],
      lessons: [createLesson({ id: "l1", startsAt, studentIds: ["s1"] })],
      leadMinutes: [1440, 60]
    });

    const pending = collectPendingLessonReminders(snapshots, nowMs);

    expect(pending.map((item) => item.dedupeKey)).toEqual(["lesson:l1:s1:1440", "lesson:l1:s1:60"]);
  });
});

describe("status helpers", () => {
  test("isSkippedLessonStatus", () => {
    expect(isSkippedLessonStatus("cancelled_by_teacher")).toBe(true);
    expect(isSkippedLessonStatus("scheduled")).toBe(false);
  });

  test("isSkippedParticipantStatus", () => {
    expect(isSkippedParticipantStatus("confirmed")).toBe(true);
    expect(isSkippedParticipantStatus("awaiting")).toBe(false);
  });
});

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
