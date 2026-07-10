import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";
import type { LessonParticipant, ParticipantStatus, Payment } from "@crm/shared";
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
  collectParticipantDebtFlagUpdates,
  getStudentBalance,
  hasExactLessonDuplicate,
  hasRecurringLesson,
  isOccurrenceSkipped,
  materializeRecurringLessons,
  now,
  recalculateLesson,
  refreshParticipantDebtFlags,
  shouldChargeParticipant,
  skipRecurringOccurrence,
  syncLessonCompletionWithSchedule
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

  test("does not complete lesson until end time has passed", () => {
    const referenceNow = new Date("2025-06-01T10:30:00.000Z").getTime();
    const startsAt = "2025-06-01T10:00:00.000Z";
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = createLessonRecord({ db, startsAt: futureStartsAt, studentIds: [alice.id] });
    lesson.startsAt = startsAt;
    lesson.durationMinutes = 60;
    db.lessons.push(lesson);

    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("scheduled");
    expect(lesson.participants[0]?.status).toBe("awaiting");
    expect(lesson.participants[0]?.balanceCharged).toBe(false);

    syncLessonCompletionWithSchedule(db, lesson, new Date("2025-06-01T11:00:00.000Z").getTime());

    expect(lesson.status).toBe("completed");
    expect(lesson.participants[0]?.status).toBe("attended");
  });
});

describe("refreshParticipantDebtFlags", () => {
  const pastStartsAt = "2020-06-01T10:00:00.000Z";

  test("clears debt flag on charged lessons when payment clears debt", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = buildLesson(db, {
      startsAt: pastStartsAt,
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(lesson);

    expect(lesson.participants[0]?.balanceCharged).toBe(true);
    expect(lesson.participants[0]?.hasDebt).toBe(true);

    db.payments.push(createPayment(alice.id, 4));
    const balance = getStudentBalance(db, alice.id);
    expect(balance.debtLessons).toBe(0);

    refreshParticipantDebtFlags(db, alice.id, balance);

    expect(lesson.participants[0]?.hasDebt).toBe(false);
    expect(collectParticipantDebtFlagUpdates(db, alice.id)).toEqual([
      { participantId: lesson.participants[0]!.id, hasDebt: false }
    ]);
  });

  test("clears oldest debt flags first when payment only partially covers debt", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });

    const olderLesson = buildLesson(db, {
      startsAt: "2020-06-01T10:00:00.000Z",
      lessonType: "individual",
      studentIds: [alice.id]
    });
    const newerLesson = buildLesson(db, {
      startsAt: "2020-06-02T10:00:00.000Z",
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(olderLesson, newerLesson);

    expect(olderLesson.participants[0]?.hasDebt).toBe(true);
    expect(newerLesson.participants[0]?.hasDebt).toBe(true);

    db.payments.push(createPayment(alice.id, 1));
    const balance = getStudentBalance(db, alice.id);
    expect(balance.debtLessons).toBe(1);

    refreshParticipantDebtFlags(db, alice.id, balance);

    expect(olderLesson.participants[0]?.hasDebt).toBe(false);
    expect(newerLesson.participants[0]?.hasDebt).toBe(true);
  });

  test("restores debt flags on newest charged lessons when payment is removed", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });

    const olderLesson = buildLesson(db, {
      startsAt: "2020-06-01T10:00:00.000Z",
      lessonType: "individual",
      studentIds: [alice.id]
    });
    const newerLesson = buildLesson(db, {
      startsAt: "2020-06-02T10:00:00.000Z",
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(olderLesson, newerLesson);

    const payment = createPayment(alice.id, 1);
    db.payments.push(payment);

    let balance = getStudentBalance(db, alice.id);
    refreshParticipantDebtFlags(db, alice.id, balance);
    expect(olderLesson.participants[0]?.hasDebt).toBe(false);
    expect(newerLesson.participants[0]?.hasDebt).toBe(true);

    db.payments = db.payments.filter((item) => item.id !== payment.id);
    balance = getStudentBalance(db, alice.id);
    expect(balance.debtLessons).toBe(2);

    refreshParticipantDebtFlags(db, alice.id, balance);

    expect(olderLesson.participants[0]?.hasDebt).toBe(true);
    expect(newerLesson.participants[0]?.hasDebt).toBe(true);
  });
});

describe("syncLessonCompletionWithSchedule", () => {
  const pastStartsAt = "2020-06-01T10:00:00.000Z";
  const futureStartsAt = futureDate(14, 18, 0);
  const referenceNow = new Date("2025-01-01T12:00:00.000Z").getTime();

  test("completes future lesson when moved to the past", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = createLessonRecord({ db, startsAt: futureStartsAt, studentIds: [alice.id] });
    lesson.startsAt = pastStartsAt;
    db.lessons.push(lesson);

    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("completed");
    expect(lesson.participants[0]?.status).toBe("attended");
  });

  test("reopens completed lesson when moved to the future", () => {
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
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(3);

    lesson.startsAt = futureStartsAt;
    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("scheduled");
    expect(lesson.participants[0]?.status).toBe("awaiting");
    expect(lesson.participants[0]?.balanceCharged).toBe(false);
    expect(getStudentBalance(db, alice.id).remainingLessons).toBe(4);
  });

  test("resets confirmed participant to awaiting when completed lesson is moved to the future", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({
      students: [alice],
      payments: [createPayment(alice.id, 4)]
    });
    const lesson = createLessonRecord({ db, startsAt: futureStartsAt, studentIds: [alice.id] });
    lesson.participants[0]!.status = "confirmed";
    db.lessons.push(lesson);

    lesson.startsAt = pastStartsAt;
    syncLessonCompletionWithSchedule(db, lesson, referenceNow);
    expect(lesson.status).toBe("completed");
    expect(lesson.participants[0]?.status as ParticipantStatus).toBe("attended");

    lesson.startsAt = futureStartsAt;
    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("scheduled");
    expect(lesson.participants[0]?.status as ParticipantStatus).toBe("awaiting");
  });

  test("keeps completed lesson completed when rescheduled within the past", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = buildLesson(db, {
      startsAt: pastStartsAt,
      lessonType: "individual",
      studentIds: [alice.id]
    });
    db.lessons.push(lesson);

    lesson.startsAt = "2019-06-01T10:00:00.000Z";
    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("completed");
    expect(lesson.participants[0]?.status).toBe("attended");
  });

  test("leaves future lesson scheduled when still in the future", () => {
    const alice = createStudentRecord("Alice");
    const db = createEmptyDatabase({ students: [alice] });
    const lesson = createLessonRecord({ db, startsAt: futureStartsAt, studentIds: [alice.id] });
    db.lessons.push(lesson);

    syncLessonCompletionWithSchedule(db, lesson, referenceNow);

    expect(lesson.status).toBe("scheduled");
    expect(lesson.participants[0]?.status).toBe("awaiting");
    expect(lesson.participants[0]?.balanceCharged).toBe(false);
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
