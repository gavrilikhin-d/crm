import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";
import type { LessonParticipant, Payment } from "@crm/shared";
import {
  createEmptyDatabase,
  createLessonRecord,
  createParticipant,
  createRecurringSchedule,
  createStudentRecord,
  futureDate
} from "./test/fixtures";
import {
  applyLessonCompletionCharges,
  applyTeacherParticipantStatusUpdate,
  buildLesson,
  getStudentBalance,
  hasExactLessonDuplicate,
  hasRecurringLesson,
  isOccurrenceSkipped,
  materializeRecurringLessons,
  now,
  recalculateLesson,
  shouldChargeParticipant,
  skipRecurringOccurrence
} from "./store-logic";

function createPayment(studentId: string, lessonCount: number): Payment {
  const timestamp = now();
  return {
    id: nanoid(),
    studentId,
    amount: lessonCount * 1000,
    currency: "BYN",
    paidAt: timestamp,
    method: "cash",
    lessonCount,
    createdAt: timestamp
  };
}

describe("hasExactLessonDuplicate", () => {
  test("matches same time, duration, type, and students", () => {
    const alice = createStudentRecord("Alice");
    const bob = createStudentRecord("Bob");
    const db = createEmptyDatabase({ students: [alice, bob] });
    const startsAt = futureDate(7, 18, 0);
    db.lessons.push(createLessonRecord({ db, startsAt, studentIds: [alice.id, bob.id], lessonType: "group" }));

    expect(
      hasExactLessonDuplicate(db, {
        startsAt,
        durationMinutes: 90,
        lessonType: "group",
        studentIds: [bob.id, alice.id]
      })
    ).toBe(true);
  });

  test("does not match same time with different students", () => {
    const alice = createStudentRecord("Alice");
    const bob = createStudentRecord("Bob");
    const db = createEmptyDatabase({ students: [alice, bob] });
    const startsAt = futureDate(7, 18, 0);
    db.lessons.push(createLessonRecord({ db, startsAt, studentIds: [alice.id] }));

    expect(
      hasExactLessonDuplicate(db, {
        startsAt,
        durationMinutes: 60,
        lessonType: "individual",
        studentIds: [bob.id]
      })
    ).toBe(false);
  });

  test("ignores teacher-cancelled lessons", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const startsAt = futureDate(7, 18, 0);
    const cancelledLesson = createLessonRecord({ db, startsAt, studentIds: [alice.id] });
    cancelledLesson.status = "cancelled_by_teacher";
    db.lessons.push(cancelledLesson);

    expect(
      hasExactLessonDuplicate(db, {
        startsAt,
        durationMinutes: 60,
        lessonType: "individual",
        studentIds: [alice.id]
      })
    ).toBe(false);
  });
});

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

describe("teacher participant status and balance", () => {
  test("changing completed lesson attendance updates charged balance", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });
    const lesson = createLessonRecord({ db, studentIds: [alice.id] });
    lesson.status = "completed";
    const participant: LessonParticipant = lesson.participants[0]!;
    participant.status = "attended";
    participant.balanceCharged = true;
    db.lessons.push(lesson);

    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(3);

    applyTeacherParticipantStatusUpdate(db, lesson, participant, "declined");

    expect(participant.status as LessonParticipant["status"]).toBe("declined");
    expect(participant.balanceCharged).toBe(false);
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(4);

    applyTeacherParticipantStatusUpdate(db, lesson, participant, "confirmed");

    expect(participant.status).toBe("attended");
    expect(participant.balanceCharged).toBe(true);
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(3);
  });

  test("does not charge balance before lesson is completed", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });
    const lesson = createLessonRecord({ db, studentIds: [alice.id] });
    db.lessons.push(lesson);

    applyTeacherParticipantStatusUpdate(db, lesson, lesson.participants[0], "confirmed");

    expect(lesson.participants[0].status).toBe("confirmed");
    expect(lesson.participants[0].balanceCharged).toBe(false);
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(4);
  });

  test("shouldChargeParticipant respects cancellation policy", () => {
    expect(shouldChargeParticipant("attended", "free")).toBe(true);
    expect(shouldChargeParticipant("declined", "free")).toBe(false);
    expect(shouldChargeParticipant("declined", "paid")).toBe(true);
  });

  test("declined participant keeps balance unchanged after lesson completes", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });
    const lesson = createLessonRecord({ db, studentIds: [alice.id] });
    const participant: LessonParticipant = lesson.participants[0]!;
    db.lessons.push(lesson);

    applyTeacherParticipantStatusUpdate(db, lesson, participant, "declined");

    const balanceBeforeCompletion = getStudentBalance(db, alice.id);
    expect(balanceBeforeCompletion.remainingLessons).toBe(4);
    expect(participant.balanceCharged).toBe(false);

    applyLessonCompletionCharges(db, lesson);
    lesson.status = "completed";

    expect(participant.status as LessonParticipant["status"]).toBe("declined");
    expect(participant.balanceCharged).toBe(false);
    expect(getStudentBalance(db, alice.id)).toEqual(balanceBeforeCompletion);
  });

  test("awaiting participant is charged when lesson completes without response", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });
    const lesson = createLessonRecord({ db, studentIds: [alice.id] });
    const participant: LessonParticipant = lesson.participants[0]!;
    db.lessons.push(lesson);

    expect(participant.status).toBe("awaiting");

    const balanceBeforeCompletion = getStudentBalance(db, alice.id);
    expect(balanceBeforeCompletion.remainingLessons).toBe(4);
    expect(participant.balanceCharged).toBe(false);

    applyLessonCompletionCharges(db, lesson);
    lesson.status = "completed";

    expect(participant.status).toBe("attended");
    expect(participant.balanceCharged).toBe(true);
    expect(getStudentBalance(db, alice.id)).toEqual({
      ...balanceBeforeCompletion,
      chargedLessons: 1,
      remainingLessons: 3,
      debtLessons: 0
    });
  });
});

describe("past lesson creation", () => {
  const pastStartsAt = "2020-06-01T10:00:00.000Z";
  const futureStartsAt = futureDate(14, 18, 0);

  test("marks participants attended, completes lesson, and charges balance", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });

    const lesson = buildLesson(db, {
      startsAt: pastStartsAt,
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(lesson);

    expect(lesson.status).toBe("completed");
    expect(lesson.participants[0]?.status).toBe("attended");
    expect(lesson.participants[0]?.balanceCharged).toBe(true);
    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 4,
      chargedLessons: 1,
      remainingLessons: 3,
      debtLessons: 0
    });
  });

  test("leaves future lessons scheduled without charging balance", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });

    const lesson = buildLesson(db, {
      startsAt: futureStartsAt,
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(lesson);

    expect(lesson.status).toBe("scheduled");
    expect(lesson.participants[0]?.status).toBe("awaiting");
    expect(lesson.participants[0]?.balanceCharged).toBe(false);
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(4);
  });

  test("creates debt when past lesson is added without paid balance", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });

    const lesson = buildLesson(db, {
      startsAt: pastStartsAt,
      lessonType: "individual",
      studentIds: [alice.id]
    });

    expect(lesson.participants[0]?.balanceCharged).toBe(true);
    expect(lesson.participants[0]?.hasDebt).toBe(true);

    db.lessons.push(lesson);

    expect(getStudentBalance(db, alice.id)).toEqual({
      studentId: alice.id,
      paidLessons: 0,
      chargedLessons: 1,
      remainingLessons: 0,
      debtLessons: 1
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
