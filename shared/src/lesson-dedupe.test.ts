import { describe, expect, test } from "bun:test";
import { dedupeLessonsByOccurrence, lessonOccurrenceKey } from "./lesson-dedupe";
import type { Lesson } from "./types";

function createLesson(overrides: Partial<Lesson> & Pick<Lesson, "id" | "startsAt">): Lesson {
  return {
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "scheduled",
    participants: [{ id: "p1", studentId: "s1", status: "awaiting", balanceCharged: false, hasDebt: false }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("dedupeLessonsByOccurrence", () => {
  test("removes duplicate recurring lessons at the same instant", () => {
    const startsAt = "2026-07-07T13:30:00.000Z";
    const lessons = [
      createLesson({ id: "l1", startsAt, recurringScheduleId: "schedule-1", createdAt: "2026-01-01T00:00:00.000Z" }),
      createLesson({ id: "l2", startsAt, recurringScheduleId: "schedule-1", createdAt: "2026-01-02T00:00:00.000Z" })
    ];

    const deduped = dedupeLessonsByOccurrence(lessons);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("l1");
  });

  test("keeps the lesson linked to Google Calendar when duplicates exist", () => {
    const startsAt = "2026-07-10T13:30:00.000Z";
    const lessons = [
      createLesson({ id: "l1", startsAt, recurringScheduleId: "schedule-1" }),
      createLesson({
        id: "l2",
        startsAt,
        recurringScheduleId: "schedule-1",
        googleCalendarEventId: "event-1"
      })
    ];

    const deduped = dedupeLessonsByOccurrence(lessons);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("l2");
  });

  test("uses different keys for different schedules at the same instant", () => {
    const startsAt = "2026-07-07T13:30:00.000Z";
    const lessons = [
      createLesson({ id: "l1", startsAt, recurringScheduleId: "schedule-1" }),
      createLesson({ id: "l2", startsAt, recurringScheduleId: "schedule-2" })
    ];

    expect(lessonOccurrenceKey(lessons[0]!)).not.toBe(lessonOccurrenceKey(lessons[1]!));
    expect(dedupeLessonsByOccurrence(lessons)).toHaveLength(2);
  });

  test("keeps separate non-recurring lessons with the same occurrence details", () => {
    const startsAt = "2026-07-07T13:30:00.000Z";
    const lessons = [
      createLesson({ id: "l1", startsAt }),
      createLesson({ id: "l2", startsAt })
    ];

    expect(lessonOccurrenceKey(lessons[0]!)).not.toBe(lessonOccurrenceKey(lessons[1]!));
    expect(dedupeLessonsByOccurrence(lessons)).toHaveLength(2);
  });
});
