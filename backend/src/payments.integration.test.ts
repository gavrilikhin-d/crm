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
});
