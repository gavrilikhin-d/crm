import { describe, expect, test } from "bun:test";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import {
  findLessonByScheduleIndex,
  formatAttendancePrompt,
  formatAttendanceResult,
  isActionableLesson,
  parseLessonIndex
} from "./attendance";

function createProfile(lessons: Lesson[]): TelegramStudentProfile {
  return {
    student: { id: "s1", fullName: "Alice" },
    settings: { lessonReminderMinutes: [1440, 120] },
    balance: {
      studentId: "s1",
      paidLessons: 1,
      chargedLessons: 0,
      remainingLessons: 1,
      debtLessons: 0
    },
    upcomingLessons: lessons,
    scheduleDays: 7
  };
}

function createLesson(input: {
  id: string;
  startsAt: string;
  status?: Lesson["status"];
  participantStatus?: Lesson["participants"][number]["status"];
  hasDebt?: boolean;
}): Lesson {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    startsAt: input.startsAt,
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: input.status ?? "scheduled",
    participants: [
      {
        id: "p1",
        studentId: "s1",
        status: input.participantStatus ?? "awaiting",
        balanceCharged: false,
        hasDebt: input.hasDebt ?? false
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("parseLessonIndex", () => {
  test("accepts positive integers", () => {
    expect(parseLessonIndex("1")).toEqual({ index: 1 });
    expect(parseLessonIndex(" 2 extra")).toEqual({ index: 2 });
  });

  test("returns empty payload for missing index", () => {
    expect(parseLessonIndex()).toEqual({});
    expect(parseLessonIndex("   ")).toEqual({});
  });

  test("rejects invalid values", () => {
    expect(parseLessonIndex("0").error).toContain("/attend 1");
    expect(parseLessonIndex("abc").error).toBeDefined();
  });
});

function futureStartsAt(offsetMs = 86_400_000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("isActionableLesson", () => {
  test("blocks completed and cancelled lessons", () => {
    const lesson = createLesson({ id: "l1", startsAt: futureStartsAt() });
    expect(isActionableLesson(lesson, "s1")).toBe(true);
    expect(isActionableLesson({ ...lesson, status: "completed" }, "s1")).toBe(false);
    expect(isActionableLesson({ ...lesson, status: "cancelled_by_teacher" }, "s1")).toBe(false);
  });

  test("blocks past lessons even if status is still scheduled", () => {
    const pastLesson = createLesson({
      id: "l-past",
      startsAt: new Date(Date.now() - 60_000).toISOString()
    });

    expect(isActionableLesson(pastLesson, "s1")).toBe(false);
  });
});

describe("findLessonByScheduleIndex", () => {
  test("maps 1-based schedule index to upcoming lessons", () => {
    const profile = createProfile([
      createLesson({ id: "l1", startsAt: futureStartsAt() }),
      createLesson({ id: "l2", startsAt: futureStartsAt(172_800_000) })
    ]);

    expect(findLessonByScheduleIndex(profile, 2)?.id).toBe("l2");
    expect(findLessonByScheduleIndex(profile, 3)).toBeUndefined();
  });
});

describe("formatAttendancePrompt", () => {
  test("lists numbered lessons with status hints", () => {
    const profile = createProfile([
      createLesson({
        id: "l1",
        startsAt: futureStartsAt(),
        participantStatus: "confirmed"
      })
    ]);

    const text = formatAttendancePrompt(profile, "confirmed");

    expect(text).toContain("1.");
    expect(text).toContain("буду");
    expect(text).toContain("/attend 1");
  });
});

describe("formatAttendanceResult", () => {
  test("includes debt warning when participant has debt", () => {
    const lesson = createLesson({
      id: "l1",
      startsAt: futureStartsAt(),
      hasDebt: true
    });

    const text = formatAttendanceResult(lesson, "s1", "declined");

    expect(text).toContain("не буду");
    expect(text).toContain("балансу");
  });
});
