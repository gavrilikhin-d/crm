import { describe, expect, test } from "bun:test";
import { and, eq, type SQL } from "drizzle-orm";
import { createTestAccount, isDatabaseAvailable, loadAccountDatabase } from "./test/fixtures";
import { store } from "./store";
import { db } from "./db/client";
import { activityEvents, notificationDeliveries } from "./db/schema";

const databaseAvailable = await isDatabaseAvailable();

async function waitForActivity(where: SQL, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await db.select().from(activityEvents).where(where);
    if (rows.length > 0) {
      return rows;
    }
    await Bun.sleep(20);
  }
  return db.select().from(activityEvents).where(where);
}

describe.skipIf(!databaseAvailable)("activity events + notification deliveries", () => {
  test("createStudent records teacher activity and snapshot stays free of events", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, { fullName: "Activity Alice" });
      const snapshot = await store.getSnapshot(ctx);

      expect("activityEvents" in snapshot).toBe(false);
      expect("notificationDeliveries" in snapshot).toBe(false);

      const rows = await waitForActivity(
        and(eq(activityEvents.accountId, ctx.accountId), eq(activityEvents.action, "student.create"))!
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorType).toBe("teacher");
      expect(rows[0]?.entityType).toBe("student");
      expect(rows[0]?.entityId).toBe(student.id);
    } finally {
      await cleanup();
    }
  });

  test("RSVP dual-writes telegram_interactions and student activity event", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, { fullName: "RSVP Bob" });
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 2);
      startsAt.setHours(18, 0, 0, 0);
      const lesson = await store.createLesson(ctx, {
        startsAt: startsAt.toISOString(),
        lessonType: "individual",
        studentIds: [student.id]
      });

      await store.setParticipantStatus(ctx, lesson.id, student.id, "confirmed", "attend");

      const dbSnapshot = await loadAccountDatabase(ctx.accountId);
      expect(dbSnapshot.telegramInteractions.some((item) => item.action === "attend")).toBe(true);

      const rows = await waitForActivity(
        and(eq(activityEvents.accountId, ctx.accountId), eq(activityEvents.action, "lesson.rsvp.attend"))!
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorType).toBe("student");
      expect(rows[0]?.actorStudentId).toBe(student.id);
      expect(rows[0]?.entityId).toBe(lesson.id);
    } finally {
      await cleanup();
    }
  });

  test("createPayment records payment.create activity", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, { fullName: "Pay Carol" });
      const payment = await store.createPayment(ctx, {
        studentId: student.id,
        amount: 3000,
        currency: "BYN",
        method: "cash",
        lessonCount: 2
      });

      const rows = await waitForActivity(
        and(eq(activityEvents.accountId, ctx.accountId), eq(activityEvents.action, "payment.create"))!
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(payment.id);
      expect(rows[0]?.metadata).toMatchObject({ studentId: student.id, lessonCount: 2, amount: 3000 });
    } finally {
      await cleanup();
    }
  });

  test("updateReminder sent creates notification delivery with lead minutes and lesson id", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, {
        fullName: "Remind Dan",
        telegramChatId: "12345"
      });
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 1);
      startsAt.setHours(18, 0, 0, 0);
      const lesson = await store.createLesson(ctx, {
        startsAt: startsAt.toISOString(),
        lessonType: "individual",
        studentIds: [student.id]
      });

      const reminder = await store.upsertReminder(ctx.accountId, {
        type: "lesson",
        lessonId: lesson.id,
        studentId: student.id,
        scheduledFor: new Date().toISOString(),
        status: "pending",
        dedupeKey: `lesson:${lesson.id}:${student.id}:60:test`
      });

      await store.updateReminder(ctx.accountId, reminder.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        telegramChatId: "12345",
        leadMinutes: 60
      });

      const deliveries = await db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.reminderId, reminder.id));

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        accountId: ctx.accountId,
        studentId: student.id,
        lessonId: lesson.id,
        channel: "telegram",
        type: "lesson_reminder",
        status: "sent",
        leadMinutes: 60,
        telegramChatId: "12345"
      });
    } finally {
      await cleanup();
    }
  });

  test("payment reminder delivery records notification and payment.reminder.send activity", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, {
        fullName: "Pay Rem Eve",
        telegramChatId: "67890"
      });

      const reminder = await store.upsertReminder(ctx.accountId, {
        type: "payment",
        studentId: student.id,
        scheduledFor: new Date().toISOString(),
        status: "pending",
        dedupeKey: `payment:${student.id}:test-activity`
      });

      await store.updateReminder(ctx.accountId, reminder.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        telegramChatId: "67890"
      });

      const deliveries = await db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.reminderId, reminder.id));

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]?.type).toBe("payment_reminder");
      expect(deliveries[0]?.lessonId).toBeNull();
      expect(deliveries[0]?.leadMinutes).toBeNull();

      const events = await waitForActivity(
        and(eq(activityEvents.accountId, ctx.accountId), eq(activityEvents.action, "payment.reminder.send"))!
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.actorType).toBe("teacher");
      expect(events[0]?.entityId).toBe(student.id);
    } finally {
      await cleanup();
    }
  });
});
