import { describe, expect, test } from "bun:test";
import {
  formatPackageLessonProgress,
  formatParticipantNameWithPackageProgress,
  getPackageLessonProgress
} from "./package-progress";
import type { Lesson, Payment } from "./types";

const studentId = "student-1";

function createLesson(
  overrides: Partial<Lesson> & Pick<Lesson, "id" | "startsAt">,
  participantStatus: Lesson["participants"][number]["status"] = "confirmed"
): Lesson {
  return {
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "scheduled",
    participants: [
      {
        id: `participant-${overrides.id}`,
        studentId,
        status: participantStatus,
        balanceCharged: false,
        hasDebt: false
      }
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function createPayment(
  overrides: Partial<Payment> & Pick<Payment, "id" | "lessonCount" | "paidAt">
): Payment {
  return {
    studentId,
    amount: 100,
    currency: "USD",
    method: "cash",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("getPackageLessonProgress", () => {
  test("returns N/M within a single package", () => {
    const lessons = [
      createLesson({ id: "l1", startsAt: "2026-06-01T10:00:00.000Z" }),
      createLesson({ id: "l2", startsAt: "2026-06-02T10:00:00.000Z" }),
      createLesson({ id: "l3", startsAt: "2026-06-03T10:00:00.000Z" })
    ];
    const payments = [createPayment({ id: "p1", lessonCount: 8, paidAt: "2026-05-01T00:00:00.000Z" })];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l3", lessons, payments })
    ).toEqual({ n: 3, m: 8 });
    expect(formatPackageLessonProgress({ n: 3, m: 8 })).toBe("3/8");
    expect(formatParticipantNameWithPackageProgress("Anna Ivanova", { n: 3, m: 8 })).toBe(
      "Anna Ivanova 3/8"
    );
  });

  test("moves to the next payment after the first is exhausted", () => {
    const lessons = Array.from({ length: 5 }, (_, index) =>
      createLesson({
        id: `l${index + 1}`,
        startsAt: `2026-06-0${index + 1}T10:00:00.000Z`
      })
    );
    const payments = [
      createPayment({ id: "p1", lessonCount: 3, paidAt: "2026-05-01T00:00:00.000Z" }),
      createPayment({ id: "p2", lessonCount: 4, paidAt: "2026-05-15T00:00:00.000Z" })
    ];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l3", lessons, payments })
    ).toEqual({ n: 3, m: 3 });
    expect(
      getPackageLessonProgress({ studentId, lessonId: "l4", lessons, payments })
    ).toEqual({ n: 1, m: 4 });
  });

  test("returns null when there are no payments", () => {
    const lessons = [createLesson({ id: "l1", startsAt: "2026-06-01T10:00:00.000Z" })];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l1", lessons, payments: [] })
    ).toBeNull();
    expect(formatParticipantNameWithPackageProgress("Anna Ivanova", null)).toBe("Anna Ivanova");
  });

  test("skips teacher-cancelled lessons", () => {
    const lessons = [
      createLesson({ id: "l1", startsAt: "2026-06-01T10:00:00.000Z", status: "cancelled_by_teacher" }),
      createLesson({ id: "l2", startsAt: "2026-06-02T10:00:00.000Z" })
    ];
    const payments = [createPayment({ id: "p1", lessonCount: 8, paidAt: "2026-05-01T00:00:00.000Z" })];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l1", lessons, payments })
    ).toBeNull();
    expect(
      getPackageLessonProgress({ studentId, lessonId: "l2", lessons, payments })
    ).toEqual({ n: 1, m: 8 });
  });

  test("skips declined participants and omits progress on that lesson", () => {
    const lessons = [
      createLesson({ id: "l1", startsAt: "2026-06-01T10:00:00.000Z" }),
      createLesson({ id: "l2", startsAt: "2026-06-02T10:00:00.000Z" }, "declined"),
      createLesson({ id: "l3", startsAt: "2026-06-03T10:00:00.000Z" })
    ];
    const payments = [createPayment({ id: "p1", lessonCount: 8, paidAt: "2026-05-01T00:00:00.000Z" })];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l2", lessons, payments })
    ).toBeNull();
    expect(
      getPackageLessonProgress({ studentId, lessonId: "l3", lessons, payments })
    ).toEqual({ n: 2, m: 8 });
  });

  test("returns null when lesson is past paid package credits", () => {
    const lessons = [
      createLesson({ id: "l1", startsAt: "2026-06-01T10:00:00.000Z" }),
      createLesson({ id: "l2", startsAt: "2026-06-02T10:00:00.000Z" }),
      createLesson({ id: "l3", startsAt: "2026-06-03T10:00:00.000Z" })
    ];
    const payments = [createPayment({ id: "p1", lessonCount: 2, paidAt: "2026-05-01T00:00:00.000Z" })];

    expect(
      getPackageLessonProgress({ studentId, lessonId: "l3", lessons, payments })
    ).toBeNull();
  });
});
