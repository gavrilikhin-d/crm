import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestAccount, isDatabaseAvailable } from "./test/fixtures";
import { store } from "./store";
import { db } from "./db/client";
import { reminders } from "./db/schema";
import { claimPendingLessonReminderRows } from "./db/repository";

const databaseAvailable = await isDatabaseAvailable();

describe.skipIf(!databaseAvailable)("write-time lesson reminders + claim", () => {
  test("createLesson inserts pending reminder rows for configured lead times", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      await store.updateSettings(ctx, { lessonReminderMinutes: [60, 120] });
      const student = await store.createStudent(ctx, { fullName: "Reminder Alice" });
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 2);
      startsAt.setHours(18, 0, 0, 0);

      const lesson = await store.createLesson(ctx, {
        startsAt: startsAt.toISOString(),
        lessonType: "individual",
        studentIds: [student.id]
      });

      const rows = await db.select().from(reminders).where(eq(reminders.accountId, ctx.accountId));
      const keys = rows.map((row) => row.dedupeKey).sort();

      expect(keys).toEqual([
        `lesson:${lesson.id}:${student.id}:120`,
        `lesson:${lesson.id}:${student.id}:60`
      ].sort());
      expect(rows.every((row) => row.status === "pending")).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("cancelLesson skips pending reminders", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      await store.updateSettings(ctx, { lessonReminderMinutes: [60] });
      const student = await store.createStudent(ctx, { fullName: "Reminder Bob" });
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 1);
      startsAt.setHours(12, 0, 0, 0);
      const lesson = await store.createLesson(ctx, {
        startsAt: startsAt.toISOString(),
        lessonType: "individual",
        studentIds: [student.id]
      });

      await store.cancelLesson(ctx, lesson.id);

      const rows = await db.select().from(reminders).where(eq(reminders.accountId, ctx.accountId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("skipped");
    } finally {
      await cleanup();
    }
  });

  test("claimDueLessonReminders returns due rows and SKIP LOCKED prevents double claim", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      await store.updateSettings(ctx, { lessonReminderMinutes: [60] });
      const student = await store.createStudent(ctx, {
        fullName: "Reminder Carol",
        telegramChatId: "1001"
      });
      const startsAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const lesson = await store.createLesson(ctx, {
        startsAt,
        lessonType: "individual",
        studentIds: [student.id]
      });

      const dueAt = new Date(Date.parse(startsAt) - 60 * 60_000).toISOString();
      const existing = await db.select().from(reminders).where(eq(reminders.accountId, ctx.accountId));
      expect(existing).toHaveLength(1);
      await db.update(reminders).set({ scheduledFor: dueAt }).where(eq(reminders.id, existing[0]!.id));

      const [first, second] = await Promise.all([
        claimPendingLessonReminderRows(10),
        claimPendingLessonReminderRows(10)
      ]);
      const claimedIds = new Set([...first, ...second].map((row) => row.id));
      expect(claimedIds.size).toBe(1);

      const payloads = await store.claimDueLessonReminders(10);
      // Already claimed with fresh claimed_at — lease not expired, so nothing else due for this account.
      expect(payloads.every((item) => item.lesson.id !== lesson.id)).toBe(true);

      // Clear claim to exercise store claim + payload path.
      await db.update(reminders).set({ claimedAt: null, scheduledFor: dueAt }).where(eq(reminders.id, existing[0]!.id));
      const claimed = await store.claimDueLessonReminders(10);
      const match = claimed.find((item) => item.lesson.id === lesson.id);
      expect(match).toBeTruthy();
      expect(match?.student.id).toBe(student.id);
      expect(match?.leadMinutes).toBe(60);
      expect(match?.student.telegramChatId).toBe("1001");
    } finally {
      await cleanup();
    }
  });

  test("claim marks invalid reminders as skipped", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      await store.updateSettings(ctx, { lessonReminderMinutes: [60] });
      const student = await store.createStudent(ctx, { fullName: "Reminder Dan" });
      const startsAt = new Date(Date.now() + 30 * 60_000).toISOString();
      const lesson = await store.createLesson(ctx, {
        startsAt,
        lessonType: "individual",
        studentIds: [student.id]
      });

      await store.setParticipantStatus(ctx, lesson.id, student.id, "declined");

      const rows = await db.select().from(reminders).where(eq(reminders.accountId, ctx.accountId));
      expect(rows[0]?.status).toBe("skipped");

      // Re-arm a stale pending row as if race occurred before sync.
      await db
        .update(reminders)
        .set({
          status: "pending",
          claimedAt: null,
          scheduledFor: new Date(Date.now() - 60_000).toISOString()
        })
        .where(eq(reminders.id, rows[0]!.id));

      const claimed = await store.claimDueLessonReminders(10);
      expect(claimed.some((item) => item.reminderId === rows[0]!.id)).toBe(false);

      const after = await db.select().from(reminders).where(eq(reminders.id, rows[0]!.id));
      expect(after[0]?.status).toBe("skipped");
    } finally {
      await cleanup();
    }
  });

  test("backfill is idempotent", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      await store.updateSettings(ctx, { lessonReminderMinutes: [60] });
      const student = await store.createStudent(ctx, { fullName: "Reminder Eve" });
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 3);
      await store.createLesson(ctx, {
        startsAt: startsAt.toISOString(),
        lessonType: "individual",
        studentIds: [student.id]
      });

      const first = await store.backfillLessonReminders();
      const second = await store.backfillLessonReminders();
      expect(first.accounts).toBeGreaterThanOrEqual(1);
      expect(second.accounts).toBe(first.accounts);

      const rows = await db.select().from(reminders).where(eq(reminders.accountId, ctx.accountId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
    } finally {
      await cleanup();
    }
  });

  test("getPaymentReminderContext returns lean student + balance", async () => {
    const { ctx, cleanup } = await createTestAccount();

    try {
      const student = await store.createStudent(ctx, {
        fullName: "Pay Fran",
        telegramChatId: "42"
      });
      const context = await store.getPaymentReminderContext(student.id);
      expect(context.accountId).toBe(ctx.accountId);
      expect(context.student.id).toBe(student.id);
      expect(context.balance.studentId).toBe(student.id);
      expect(context.student.telegramChatId).toBe("42");
    } finally {
      await cleanup();
    }
  });
});
