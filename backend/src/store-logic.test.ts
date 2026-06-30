import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";
import type { Payment } from "@crm/shared";
import {
  createEmptyDatabase,
  createLessonRecord,
  createParticipant,
  createRecurringSchedule,
  createStudentRecord,
  futureDate
} from "./test/fixtures";
import {
  getStudentBalance,
  hasRecurringLesson,
  isOccurrenceSkipped,
  materializeRecurringLessons,
  now,
  recalculateLesson,
  skipRecurringOccurrence
} from "./store-logic";

function createPayment(studentId: string, lessonCount: number): Payment {
  const timestamp = now();
  return {
    id: nanoid(),
    studentId,
    amount: lessonCount * 1000,
    paidAt: timestamp,
    method: "cash",
    lessonCount,
    createdAt: timestamp
  };
}

describe("getStudentBalance", () => {
  test("adds new payment to remaining balance when previous lessons are not used up", () => {
    const alice = createStudentRecord("Alice");
    const firstPayment = createPayment(alice.id, 4);
    const db = createEmptyDatabase({
      students: [alice],
      payments: [firstPayment]
    });

    const completedLesson = createLessonRecord({ db, studentIds: [alice.id] });
    completedLesson.status = "completed";
    completedLesson.participants[0].status = "attended";
    completedLesson.participants[0].balanceCharged = true;
    db.lessons.push(completedLesson);

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 4,
      chargedLessons: 1,
      remainingLessons: 3,
      debtLessons: 0
    });

    db.payments.push(createPayment(alice.id, 5));

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 9,
      chargedLessons: 1,
      remainingLessons: 8,
      debtLessons: 0
    });
  });

  test("covers debt from payment first and reduces debt by deducted lessons", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });

    for (let index = 0; index < 3; index += 1) {
      const lesson = createLessonRecord({ db, studentIds: [alice.id] });
      lesson.status = "completed";
      lesson.participants[0].status = "attended";
      lesson.participants[0].balanceCharged = true;
      db.lessons.push(lesson);
    }

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 0,
      chargedLessons: 3,
      remainingLessons: 0,
      debtLessons: 3
    });

    db.payments.push(createPayment(alice.id, 2));

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 2,
      chargedLessons: 3,
      remainingLessons: 0,
      debtLessons: 1
    });

    db.payments.push(createPayment(alice.id, 4));

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 6,
      chargedLessons: 3,
      remainingLessons: 3,
      debtLessons: 0
    });
  });
});

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

  test("does not materialize lessons during vacation periods", () => {
    const startsAt = futureDate(7, 18, 0);
    const alice = createStudentRecord("Alice");
    const schedule = createRecurringSchedule({
      startsAt,
      studentIds: [alice.id],
      lessonType: "individual"
    });
    const vacationDate = new Date(startsAt);
    const pad = (value: number) => String(value).padStart(2, "0");
    const startsOn = `${vacationDate.getFullYear()}-${pad(vacationDate.getMonth() + 1)}-${pad(vacationDate.getDate())}`;
    const db = createEmptyDatabase({
      students: [alice],
      recurringSchedules: [schedule],
      vacationPeriods: [
        {
          id: "vacation-1",
          startsOn,
          endsOn: startsOn,
          createdAt: now(),
          updatedAt: now()
        }
      ]
    });

    const created = materializeRecurringLessons(db);
    const skippedInstant = new Date(startsAt).getTime();

    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === skippedInstant)).toBe(false);
    expect(created.length).toBeGreaterThan(0);
  });

  test("materializes lessons outside timed vacation window on start and end dates", () => {
    const morningOnStartDate = futureDate(7, 10, 0);
    const afternoonOnStartDate = futureDate(7, 15, 0);
    const afternoonOnEndDate = futureDate(8, 14, 0);
    const alice = createStudentRecord("Alice");
    const pad = (value: number) => String(value).padStart(2, "0");
    const startDate = new Date(morningOnStartDate);
    const startsOn = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const endDate = new Date(afternoonOnEndDate);
    const endsOn = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

    const db = createEmptyDatabase({
      students: [alice],
      recurringSchedules: [
        createRecurringSchedule({
          startsAt: morningOnStartDate,
          studentIds: [alice.id],
          lessonType: "individual"
        }),
        createRecurringSchedule({
          startsAt: afternoonOnStartDate,
          studentIds: [alice.id],
          lessonType: "individual"
        }),
        createRecurringSchedule({
          startsAt: afternoonOnEndDate,
          studentIds: [alice.id],
          lessonType: "individual"
        })
      ],
      vacationPeriods: [
        {
          id: "vacation-1",
          startsOn,
          endsOn,
          startsAtTime: "14:00",
          endsAtTime: "12:00",
          createdAt: now(),
          updatedAt: now()
        }
      ]
    });

    const created = materializeRecurringLessons(db);
    const morningInstant = new Date(morningOnStartDate).getTime();
    const afternoonOnStartInstant = new Date(afternoonOnStartDate).getTime();
    const afternoonOnEndInstant = new Date(afternoonOnEndDate).getTime();

    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === morningInstant)).toBe(true);
    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === afternoonOnStartInstant)).toBe(false);
    expect(created.some((lesson) => new Date(lesson.startsAt).getTime() === afternoonOnEndInstant)).toBe(true);
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
