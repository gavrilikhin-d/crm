import { describe, expect, test } from "bun:test";
import {
  createEmptyDatabase,
  createLessonRecord,
  createParticipant,
  createRecurringSchedule,
  createStudentRecord,
  futureDate
} from "./test/fixtures";
import {
  hasRecurringLesson,
  isOccurrenceSkipped,
  materializeRecurringLessons,
  recalculateLesson,
  skipRecurringOccurrence
} from "./store-logic";

describe("recalculateLesson", () => {
  test("converts group lesson to individual when one active participant remains", () => {
    const alice = createStudentRecord("Alice");
    const bob = createStudentRecord("Bob");
    const db = createEmptyDatabase({ students: [alice, bob] });
    const lesson = createLessonRecord({
      db,
      studentIds: [alice.id, bob.id],
      lessonType: "group"
    });

    lesson.participants = lesson.participants.filter((participant) => participant.studentId === alice.id);
    recalculateLesson(lesson, 60, 90);

    expect(lesson.effectiveType).toBe("individual");
    expect(lesson.durationMinutes).toBe(60);
    expect(lesson.originalType).toBe("group");
  });

  test("converts individual lesson to group when a second active participant is added", () => {
    const alice = createStudentRecord("Alice");
    const bob = createStudentRecord("Bob");
    const db = createEmptyDatabase({ students: [alice, bob] });
    const lesson = createLessonRecord({
      db,
      studentIds: [alice.id],
      lessonType: "individual"
    });

    lesson.participants.push(createParticipant(bob.id));
    recalculateLesson(lesson, 60, 90);

    expect(lesson.originalType).toBe("group");
    expect(lesson.effectiveType).toBe("group");
    expect(lesson.durationMinutes).toBe(90);
  });

  test("marks lesson cancelled when no active participants remain", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = createLessonRecord({
      db,
      studentIds: [alice.id],
      lessonType: "individual"
    });

    lesson.participants[0].status = "declined";
    recalculateLesson(lesson, 60, 90);

    expect(lesson.status).toBe("cancelled_by_student");
  });
});

describe("skipRecurringOccurrence", () => {
  test("stores normalized instant so equivalent timestamps match", () => {
    const startsAt = futureDate(14, 18, 0);
    const alice = createStudentRecord("Alice");
    const schedule = createRecurringSchedule({
      startsAt,
      studentIds: [alice.id],
      lessonType: "group"
    });
    const db = createEmptyDatabase({
      students: [alice],
      recurringSchedules: [schedule]
    });
    const lesson = createLessonRecord({
      db,
      studentIds: [alice.id],
      lessonType: "group",
      startsAt: new Date(startsAt).toISOString(),
      recurringScheduleId: schedule.id
    });

    skipRecurringOccurrence(db, lesson);

    const equivalent = new Date(startsAt);
    equivalent.setMilliseconds(0);
    expect(isOccurrenceSkipped(schedule, equivalent.toISOString())).toBe(true);
  });
});

describe("materializeRecurringLessons", () => {
  test("does not recreate skipped occurrences", () => {
    const startsAt = futureDate(7, 18, 0);
    const alice = createStudentRecord("Alice");
    const bob = createStudentRecord("Bob");
    const schedule = createRecurringSchedule({
      startsAt,
      studentIds: [alice.id, bob.id],
      lessonType: "group"
    });
    schedule.skippedOccurrences = [new Date(startsAt).toISOString()];
    const db = createEmptyDatabase({
      students: [alice, bob],
      recurringSchedules: [schedule]
    });

    const created = materializeRecurringLessons(db);
    const skippedInstant = new Date(startsAt).getTime();

    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === skippedInstant)).toBe(false);
    expect(created.length).toBeGreaterThan(0);
  });

  test("does not duplicate existing recurring lessons", () => {
    const startsAt = futureDate(7, 18, 0);
    const alice = createStudentRecord("Alice");
    const schedule = createRecurringSchedule({
      startsAt,
      studentIds: [alice.id],
      lessonType: "individual"
    });
    const db = createEmptyDatabase({
      students: [alice],
      recurringSchedules: [schedule]
    });
    const existing = createLessonRecord({
      db,
      studentIds: [alice.id],
      lessonType: "individual",
      startsAt,
      recurringScheduleId: schedule.id
    });
    db.lessons.push(existing);

    const created = materializeRecurringLessons(db);

    expect(hasRecurringLesson(db, schedule.id, startsAt)).toBe(true);
    expect(created.some((lesson) => lesson.id === existing.id)).toBe(false);
    expect(db.lessons.filter((lesson) => lesson.id === existing.id)).toHaveLength(1);
  });

  test("materializes other weeks while one occurrence is skipped", () => {
    const startsAt = futureDate(7, 18, 0);
    const alice = createStudentRecord("Alice");
    const schedule = createRecurringSchedule({
      startsAt,
      studentIds: [alice.id],
      lessonType: "individual"
    });
    schedule.skippedOccurrences = [new Date(startsAt).toISOString()];
    const db = createEmptyDatabase({
      students: [alice],
      recurringSchedules: [schedule]
    });

    const created = materializeRecurringLessons(db);
    const skippedInstant = new Date(startsAt).getTime();

    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === skippedInstant)).toBe(false);
    expect(created.length).toBeGreaterThan(0);
  });
});
