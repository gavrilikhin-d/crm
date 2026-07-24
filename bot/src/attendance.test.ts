import { describe, expect, test } from "bun:test";
import { getInlineCallbackData } from "./inline-keyboard";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import {
  findLessonByScheduleIndex,
  formatAttendanceResult,
  isActionableLesson,
  parseAttendancePhrase,
  parseLessonIndex,
  scheduleKeyboard
} from "./attendance";

function createProfile(lessons: Lesson[]): TelegramStudentProfile {
  return {
    student: { id: "s1", fullName: "Alice" },
    settings: { lessonReminderMinutes: [1440, 120], timezone: "Europe/Minsk" },
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

function futureStartsAt(offsetMs = 86_400_000): string {
  return new Date(Date.now() + offsetMs).toISOString();
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
    expect(parseLessonIndex("0").error).toContain("буду 1");
    expect(parseLessonIndex("abc").error).toBeDefined();
  });
});

describe("parseAttendancePhrase", () => {
  test("parses confirm and decline phrases", () => {
    expect(parseAttendancePhrase("буду")).toEqual({ intent: "confirmed" });
    expect(parseAttendancePhrase("не буду")).toEqual({ intent: "declined" });
    expect(parseAttendancePhrase("буду 1")).toEqual({ intent: "confirmed", index: 1 });
    expect(parseAttendancePhrase("не буду 2")).toEqual({ intent: "declined", index: 2 });
  });

  test("rejects unrelated text", () => {
    expect(parseAttendancePhrase("расписание")).toBeNull();
    expect(parseAttendancePhrase("буду завтра")).toBeNull();
  });
});

describe("isActionableLesson", () => {
  test("blocks completed and teacher-cancelled lessons", () => {
    const lesson = createLesson({ id: "l1", startsAt: futureStartsAt() });
    expect(isActionableLesson(lesson, "s1")).toBe(true);
    expect(isActionableLesson({ ...lesson, status: "completed" }, "s1")).toBe(false);
    expect(isActionableLesson({ ...lesson, status: "cancelled_by_teacher" }, "s1")).toBe(false);
  });

  test("keeps student-declined cancelled lessons actionable so RSVP can be reversed", () => {
    const lesson = createLesson({
      id: "l1",
      startsAt: futureStartsAt(),
      status: "cancelled_by_student",
      participantStatus: "declined"
    });
    expect(isActionableLesson(lesson, "s1")).toBe(true);
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

describe("scheduleKeyboard", () => {
  test("includes period presets and both action buttons for unanswered lessons", () => {
    const profile = createProfile([
      createLesson({ id: "l1", startsAt: futureStartsAt() }),
      createLesson({
        id: "l2",
        startsAt: futureStartsAt(172_800_000),
        status: "completed"
      })
    ]);

    const keyboard = scheduleKeyboard(profile, 7);
    const labelRow = keyboard.inline_keyboard[1] ?? [];
    const actionRow = keyboard.inline_keyboard[2] ?? [];
    const callbacks = keyboard.inline_keyboard.flat().map((button) => getInlineCallbackData(button));

    expect(callbacks).toContain("sch:d:7");
    expect(callbacks).toContain("sch:d:14");
    expect(labelRow).toHaveLength(1);
    expect(labelRow[0] ? getInlineCallbackData(labelRow[0]) : undefined).toBe("sch:n");
    expect(labelRow[0]?.text).toMatch(/^1\./);
    expect(actionRow).toHaveLength(2);
    expect(actionRow[0]?.text).toBe("👍");
    expect(actionRow[0] ? getInlineCallbackData(actionRow[0])?.startsWith("la:l1:") : false).toBe(true);
    expect(actionRow[1]?.text).toBe("👎");
    expect(actionRow[1] ? getInlineCallbackData(actionRow[1])?.startsWith("ld:l1:") : false).toBe(true);
    expect(callbacks.some((item) => item?.includes("l2"))).toBe(false);
  });

  test("puts status thumb on the label and keeps only the reverse action", () => {
    const profile = createProfile([
      createLesson({
        id: "approved",
        startsAt: futureStartsAt(),
        participantStatus: "confirmed"
      }),
      createLesson({
        id: "declined",
        startsAt: futureStartsAt(172_800_000),
        status: "cancelled_by_student",
        participantStatus: "declined"
      })
    ]);

    const keyboard = scheduleKeyboard(profile, 7);
    const approvedLabel = keyboard.inline_keyboard[1]?.[0];
    const approvedAction = keyboard.inline_keyboard[2] ?? [];
    const declinedLabel = keyboard.inline_keyboard[3]?.[0];
    const declinedAction = keyboard.inline_keyboard[4] ?? [];

    expect(approvedLabel?.text.startsWith("👍 1.")).toBe(true);
    expect(approvedAction).toHaveLength(1);
    expect(approvedAction[0]?.text).toBe("👎");
    expect(approvedAction[0] ? getInlineCallbackData(approvedAction[0])?.startsWith("ld:approved:") : false).toBe(
      true
    );

    expect(declinedLabel?.text.startsWith("👎 2.")).toBe(true);
    expect(declinedAction).toHaveLength(1);
    expect(declinedAction[0]?.text).toBe("👍");
    expect(declinedAction[0] ? getInlineCallbackData(declinedAction[0])?.startsWith("la:declined:") : false).toBe(
      true
    );
  });
});

describe("formatAttendanceResult", () => {
  test("includes debt warning when participant has debt", () => {
    const lesson = createLesson({
      id: "l1",
      startsAt: futureStartsAt(),
      hasDebt: true
    });

    const text = formatAttendanceResult(lesson, "s1", "declined", "Europe/Minsk");

    expect(text).toContain("не буду");
    expect(text).toContain("балансу");
  });
});
