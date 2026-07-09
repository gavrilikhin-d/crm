import { describe, expect, test } from "bun:test";
import { getStudentBalance } from "./store-logic";
import { createTestAccount, isDatabaseAvailable, loadAccountDatabase } from "./test/fixtures";
import { store } from "./store";

const databaseAvailable = await isDatabaseAvailable();

describe.skipIf(!databaseAvailable)("payments integration", () => {
  test("deletes payment and updates student balance", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Payment Delete" });
      const payment = await store.createPayment(ctx, {
        studentId: alice.id,
        amount: 3000,
        currency: "BYN",
        method: "cash",
        lessonCount: 3
      });

      let db = await loadAccountDatabase(ctx.accountId);
      expect(db.payments.some((item) => item.id === payment.id)).toBe(true);
      expect(getStudentBalance(db, alice.id).remainingLessons).toBe(3);

      await store.deletePayment(ctx, payment.id);

      db = await loadAccountDatabase(ctx.accountId);
      expect(db.payments.some((item) => item.id === payment.id)).toBe(false);
      expect(getStudentBalance(db, alice.id).remainingLessons).toBe(0);
    } finally {
      await cleanup();
    }
  });

  test("clears debt flag on completed lessons when payment clears debt", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Debt Clear" });
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - 2);
      startedAt.setHours(18, 0, 0, 0);

      const lesson = await store.createLesson(ctx, {
        startsAt: startedAt.toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      let db = await loadAccountDatabase(ctx.accountId);
      const participant = db.lessons.find((item) => item.id === lesson.id)?.participants[0];
      expect(participant?.balanceCharged).toBe(true);
      expect(participant?.hasDebt).toBe(true);
      expect(getStudentBalance(db, alice.id).debtLessons).toBe(1);

      await store.createPayment(ctx, {
        studentId: alice.id,
        amount: 4000,
        currency: "BYN",
        method: "cash",
        lessonCount: 4
      });

      db = await loadAccountDatabase(ctx.accountId);
      const updatedParticipant = db.lessons.find((item) => item.id === lesson.id)?.participants[0];
      expect(updatedParticipant?.hasDebt).toBe(false);
      expect(getStudentBalance(db, alice.id).debtLessons).toBe(0);
    } finally {
      await cleanup();
    }
  });

  test("clears oldest debt flags first when payment only partially covers debt", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Partial Debt Clear" });
      const olderStartsAt = new Date();
      olderStartsAt.setDate(olderStartsAt.getDate() - 3);
      olderStartsAt.setHours(18, 0, 0, 0);
      const newerStartsAt = new Date();
      newerStartsAt.setDate(newerStartsAt.getDate() - 1);
      newerStartsAt.setHours(18, 0, 0, 0);

      const olderLesson = await store.createLesson(ctx, {
        startsAt: olderStartsAt.toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });
      const newerLesson = await store.createLesson(ctx, {
        startsAt: newerStartsAt.toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      let db = await loadAccountDatabase(ctx.accountId);
      expect(getStudentBalance(db, alice.id).debtLessons).toBe(2);

      await store.createPayment(ctx, {
        studentId: alice.id,
        amount: 2000,
        currency: "BYN",
        method: "cash",
        lessonCount: 1
      });

      db = await loadAccountDatabase(ctx.accountId);
      expect(getStudentBalance(db, alice.id).debtLessons).toBe(1);

      const olderParticipant = db.lessons.find((item) => item.id === olderLesson.id)?.participants[0];
      const newerParticipant = db.lessons.find((item) => item.id === newerLesson.id)?.participants[0];
      expect(olderParticipant?.hasDebt).toBe(false);
      expect(newerParticipant?.hasDebt).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("restores debt flags on lessons when payment is deleted", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const alice = await store.createStudent(ctx, { fullName: "Alice Debt Restore" });
      const olderStartsAt = new Date();
      olderStartsAt.setDate(olderStartsAt.getDate() - 3);
      olderStartsAt.setHours(18, 0, 0, 0);
      const newerStartsAt = new Date();
      newerStartsAt.setDate(newerStartsAt.getDate() - 1);
      newerStartsAt.setHours(18, 0, 0, 0);

      const olderLesson = await store.createLesson(ctx, {
        startsAt: olderStartsAt.toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });
      const newerLesson = await store.createLesson(ctx, {
        startsAt: newerStartsAt.toISOString(),
        lessonType: "individual",
        studentIds: [alice.id]
      });

      const payment = await store.createPayment(ctx, {
        studentId: alice.id,
        amount: 2000,
        currency: "BYN",
        method: "cash",
        lessonCount: 1
      });

      let db = await loadAccountDatabase(ctx.accountId);
      let olderParticipant = db.lessons.find((item) => item.id === olderLesson.id)?.participants[0];
      let newerParticipant = db.lessons.find((item) => item.id === newerLesson.id)?.participants[0];
      expect(olderParticipant?.hasDebt).toBe(false);
      expect(newerParticipant?.hasDebt).toBe(true);

      await store.deletePayment(ctx, payment.id);

      db = await loadAccountDatabase(ctx.accountId);
      expect(getStudentBalance(db, alice.id).debtLessons).toBe(2);
      olderParticipant = db.lessons.find((item) => item.id === olderLesson.id)?.participants[0];
      newerParticipant = db.lessons.find((item) => item.id === newerLesson.id)?.participants[0];
      expect(olderParticipant?.hasDebt).toBe(true);
      expect(newerParticipant?.hasDebt).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
