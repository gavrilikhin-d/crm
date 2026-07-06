import { afterEach, describe, expect, mock, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import {
  accounts,
  appSettings,
  balanceAdjustments,
  lessonPackages,
  lessonParticipants,
  lessons,
  payments,
  recurringScheduleStudents,
  recurringSchedules,
  reminders,
  students,
  telegramInteractions,
  vacationPeriods
} from "./db/schema";
import { isAvatarStorageConfigured, readStudentAvatar } from "./avatars";
import { db } from "./db/client";
import { findStudentByTelegramUser, getAccountById } from "./db/repository";
import { futureDate, createTestAccount, isDatabaseAvailable } from "./test/fixtures";
import { store } from "./store";

const databaseAvailable = await isDatabaseAvailable();
const originalFetch = globalThis.fetch;
const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalTelegramToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
  }
});

describe.skipIf(!databaseAvailable)("account deletion integration", () => {
  test("deletes the account, cascades related data, disconnects Telegram, and removes avatars", async () => {
    const { ctx, cleanup } = await createTestAccount();
    const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";

    try {
      const alice = await store.createStudent(ctx, {
        fullName: "Alice Account Delete",
        ...(canRunAvatarStorageIntegrationTests() ? { avatarDataUrl: tinyPngDataUrl() } : {})
      });
      const bob = await store.createStudent(ctx, { fullName: "Bob Account Delete" });
      const linked = await store.bindTelegramChat(alice.telegramBindToken, "chat-1", "user-1", "alice");
      const lessonPackage = await store.createLessonPackage(ctx, {
        name: "Account Delete Package",
        lessonCount: 4,
        price: 12000
      });
      const lesson = await store.createLesson(ctx, {
        startsAt: futureDate(14, 18, 0),
        lessonType: "group",
        studentIds: [alice.id, bob.id],
        repeatWeekly: true
      });

      await store.createPayment(ctx, {
        studentId: alice.id,
        packageId: lessonPackage.id,
        method: "cash"
      });
      await store.createAdjustment(ctx, {
        studentId: alice.id,
        lessonDelta: 1,
        reason: "Account deletion test"
      });
      await store.upsertReminder(ctx.accountId, {
        type: "lesson",
        lessonId: lesson.id,
        studentId: alice.id,
        scheduledFor: futureDate(13, 18, 0),
        status: "pending",
        dedupeKey: `account-delete-${ctx.accountId}`
      });
      await store.setParticipantStatus(ctx, lesson.id, alice.id, "confirmed", "attend");
      await store.createVacationPeriod(ctx, {
        startsOn: "2099-01-01",
        endsOn: "2099-01-02",
        label: "Account deletion test"
      });

      const snapshotBeforeDelete = await store.getSnapshot(ctx);
      const scheduleId = snapshotBeforeDelete.recurringSchedules[0]?.id;
      expect(scheduleId).toBeDefined();
      if (canRunAvatarStorageIntegrationTests()) {
        expect(await readStudentAvatar(alice.id)).not.toBeNull();
      }
      expect(await findStudentByTelegramUser(linked.telegramUserId!)).not.toBeNull();

      await store.deleteAccount(ctx);

      expect(await getAccountById(ctx.accountId)).toBeNull();
      if (canRunAvatarStorageIntegrationTests()) {
        expect(await readStudentAvatar(alice.id)).toBeNull();
      }
      expect(await findStudentByTelegramUser(linked.telegramUserId!)).toBeNull();
      await expect(store.getTelegramStudentProfile(linked.telegramUserId!)).rejects.toThrow("Student not found");

      await expectAccountRowsDeleted(ctx.accountId);
      expect(await countRows(lessonParticipants, eq(lessonParticipants.lessonId, lesson.id))).toBe(0);
      expect(await countRows(recurringScheduleStudents, eq(recurringScheduleStudents.scheduleId, scheduleId!))).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await fetchRequestBody(fetchMock.mock.calls[0]![1])).toMatchObject({
        chat_id: "chat-1"
      });
    } finally {
      await cleanup();
    }
  });

  test("deletes the account even when Telegram disconnect notification fails", async () => {
    const { ctx, cleanup } = await createTestAccount();
    globalThis.fetch = mock(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: false }), { status: 500 })
    ) as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";

    try {
      const student = await store.createStudent(ctx, { fullName: "Telegram Failure Delete" });
      await store.bindTelegramChat(student.telegramBindToken, "chat-fail", "user-fail");

      await store.deleteAccount(ctx);

      expect(await getAccountById(ctx.accountId)).toBeNull();
      expect(await findStudentByTelegramUser("user-fail")).toBeNull();
    } finally {
      await cleanup();
    }
  });
});

async function expectAccountRowsDeleted(accountId: string): Promise<void> {
  const accountRows = await db.select({ count: sql<number>`count(*)` }).from(accounts).where(eq(accounts.id, accountId));
  const settingsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appSettings)
    .where(eq(appSettings.accountId, accountId));
  const studentRows = await db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.accountId, accountId));
  const packageRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessonPackages)
    .where(eq(lessonPackages.accountId, accountId));
  const scheduleRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(recurringSchedules)
    .where(eq(recurringSchedules.accountId, accountId));
  const lessonRows = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.accountId, accountId));
  const paymentRows = await db.select({ count: sql<number>`count(*)` }).from(payments).where(eq(payments.accountId, accountId));
  const reminderRows = await db.select({ count: sql<number>`count(*)` }).from(reminders).where(eq(reminders.accountId, accountId));
  const interactionRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(telegramInteractions)
    .where(eq(telegramInteractions.accountId, accountId));
  const adjustmentRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(balanceAdjustments)
    .where(eq(balanceAdjustments.accountId, accountId));
  const vacationRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(vacationPeriods)
    .where(eq(vacationPeriods.accountId, accountId));

  expect(Number(accountRows[0]?.count ?? 0)).toBe(0);
  expect(Number(settingsRows[0]?.count ?? 0)).toBe(0);
  expect(Number(studentRows[0]?.count ?? 0)).toBe(0);
  expect(Number(packageRows[0]?.count ?? 0)).toBe(0);
  expect(Number(scheduleRows[0]?.count ?? 0)).toBe(0);
  expect(Number(lessonRows[0]?.count ?? 0)).toBe(0);
  expect(Number(paymentRows[0]?.count ?? 0)).toBe(0);
  expect(Number(reminderRows[0]?.count ?? 0)).toBe(0);
  expect(Number(interactionRows[0]?.count ?? 0)).toBe(0);
  expect(Number(adjustmentRows[0]?.count ?? 0)).toBe(0);
  expect(Number(vacationRows[0]?.count ?? 0)).toBe(0);
}

async function countRows(
  table: typeof lessonParticipants | typeof recurringScheduleStudents,
  where: ReturnType<typeof eq>
): Promise<number> {
  const rows = table === lessonParticipants
    ? await db.select({ count: sql<number>`count(*)` }).from(lessonParticipants).where(where)
    : await db.select({ count: sql<number>`count(*)` }).from(recurringScheduleStudents).where(where);
  return Number(rows[0]?.count ?? 0);
}

async function fetchRequestBody(init: RequestInit | undefined): Promise<Record<string, unknown>> {
  if (!init || typeof init.body !== "string") {
    return {};
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function tinyPngDataUrl(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
}

function canRunAvatarStorageIntegrationTests(): boolean {
  if (!isAvatarStorageConfigured()) {
    return false;
  }

  // CI may expose S3_BUCKET without AWS credentials; skip live S3 checks unless creds exist.
  return Boolean(process.env.AWS_ACCESS_KEY_ID?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim());
}
