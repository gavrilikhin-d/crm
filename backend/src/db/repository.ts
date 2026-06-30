import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  Account,
  AccountPlan,
  AppSettings,
  BalanceAdjustment,
  Database,
  Lesson,
  LessonPackage,
  LessonParticipant,
  Payment,
  RecurringSchedule,
  Reminder,
  Student,
  TelegramInteraction
} from "@crm/shared";
import { db } from "./client";
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
  recurringSkippedOccurrences,
  reminders,
  students,
  telegramInteractions
} from "./schema";
import { createDefaultSettings } from "../store-logic";

export async function getReminderAccountId(id: string): Promise<string | null> {
  const rows = await db.select({ accountId: reminders.accountId }).from(reminders).where(eq(reminders.id, id)).limit(1);
  return rows[0]?.accountId ?? null;
}

export async function listAccountIds(): Promise<string[]> {
  const rows = await db.select({ id: accounts.id }).from(accounts);
  return rows.map((row) => row.id);
}

export async function findStudentById(studentId: string): Promise<(Student & { accountId: string }) | null> {
  const rows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!rows[0]) {
    return null;
  }
  return { ...mapStudent(rows[0]), accountId: rows[0].accountId };
}

export async function upsertAccountByGoogle(input: {
  googleSub: string;
  email: string;
  name: string;
  image?: string;
}): Promise<Account> {
  const existing = await getAccountByGoogleSub(input.googleSub);
  const timestamp = new Date().toISOString();

  if (existing) {
    await db
      .update(accounts)
      .set({
        email: input.email,
        name: input.name,
        image: input.image ?? null,
        updatedAt: timestamp
      })
      .where(eq(accounts.id, existing.id));

    return {
      ...existing,
      email: input.email,
      name: input.name,
      image: input.image,
      updatedAt: timestamp
    };
  }

  const account: Account = {
    id: nanoid(),
    email: input.email,
    name: input.name,
    image: input.image,
    plan: "free",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.insert(accounts).values({
    id: account.id,
    email: account.email,
    name: account.name,
    image: account.image ?? null,
    googleSub: input.googleSub,
    plan: account.plan,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  });

  await ensureAccountDefaults(account.id);
  return account;
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function getAccountByGoogleSub(googleSub: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.googleSub, googleSub)).limit(1);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export type GoogleCalendarCredentials = {
  refreshToken: string | null;
  accessToken: string | null;
  tokenExpiresAt: string | null;
  calendarId: string;
  syncEnabled: boolean;
};

export async function getAccountGoogleCalendar(accountId: string): Promise<GoogleCalendarCredentials | null> {
  const rows = await db
    .select({
      refreshToken: accounts.googleCalendarRefreshToken,
      accessToken: accounts.googleCalendarAccessToken,
      tokenExpiresAt: accounts.googleCalendarTokenExpiresAt,
      calendarId: accounts.googleCalendarId,
      syncEnabled: accounts.googleCalendarSyncEnabled
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    refreshToken: row.refreshToken,
    accessToken: row.accessToken,
    tokenExpiresAt: row.tokenExpiresAt,
    calendarId: row.calendarId,
    syncEnabled: row.syncEnabled
  };
}

export async function updateAccountGoogleCalendarTokens(
  accountId: string,
  input: {
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: string | null;
    calendarId?: string;
    syncEnabled?: boolean;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  };

  if ("accessToken" in input) {
    patch.googleCalendarAccessToken = input.accessToken ?? null;
  }
  if ("refreshToken" in input) {
    patch.googleCalendarRefreshToken = input.refreshToken ?? null;
  }
  if ("tokenExpiresAt" in input) {
    patch.googleCalendarTokenExpiresAt = input.tokenExpiresAt ?? null;
  }
  if (input.calendarId !== undefined) {
    patch.googleCalendarId = input.calendarId;
  }
  if (input.syncEnabled !== undefined) {
    patch.googleCalendarSyncEnabled = input.syncEnabled;
  }

  await db.update(accounts).set(patch).where(eq(accounts.id, accountId));
}

export async function setAccountGoogleCalendarSyncEnabled(accountId: string, enabled: boolean): Promise<void> {
  await db
    .update(accounts)
    .set({
      googleCalendarSyncEnabled: enabled,
      updatedAt: new Date().toISOString()
    })
    .where(eq(accounts.id, accountId));
}

export async function clearAccountGoogleCalendar(accountId: string): Promise<void> {
  await db
    .update(accounts)
    .set({
      googleCalendarRefreshToken: null,
      googleCalendarAccessToken: null,
      googleCalendarTokenExpiresAt: null,
      googleCalendarSyncEnabled: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(accounts.id, accountId));
}

export async function updateLessonGoogleEventId(lessonId: string, eventId: string | null): Promise<void> {
  await db.update(lessons).set({ googleCalendarEventId: eventId }).where(eq(lessons.id, lessonId));
}

export async function loadAccountDatabase(accountId: string): Promise<Database> {
  const [
    studentRows,
    packageRows,
    lessonRows,
    scheduleRows,
    paymentRows,
    reminderRows,
    interactionRows,
    adjustmentRows,
    settingsRows
  ] = await Promise.all([
    db.select().from(students).where(eq(students.accountId, accountId)),
    db.select().from(lessonPackages).where(eq(lessonPackages.accountId, accountId)),
    db.select().from(lessons).where(eq(lessons.accountId, accountId)),
    db.select().from(recurringSchedules).where(eq(recurringSchedules.accountId, accountId)),
    db.select().from(payments).where(eq(payments.accountId, accountId)),
    db.select().from(reminders).where(eq(reminders.accountId, accountId)),
    db.select().from(telegramInteractions).where(eq(telegramInteractions.accountId, accountId)),
    db.select().from(balanceAdjustments).where(eq(balanceAdjustments.accountId, accountId)),
    db.select().from(appSettings).where(eq(appSettings.accountId, accountId))
  ]);

  const lessonIds = lessonRows.map((row) => row.id);
  const scheduleIds = scheduleRows.map((row) => row.id);

  const [participantRows, scheduleStudentRows, skippedRows] = await Promise.all([
    lessonIds.length
      ? db.select().from(lessonParticipants).where(inArray(lessonParticipants.lessonId, lessonIds))
      : Promise.resolve([]),
    scheduleIds.length
      ? db
          .select()
          .from(recurringScheduleStudents)
          .where(inArray(recurringScheduleStudents.scheduleId, scheduleIds))
      : Promise.resolve([]),
    scheduleIds.length
      ? db
          .select()
          .from(recurringSkippedOccurrences)
          .where(inArray(recurringSkippedOccurrences.scheduleId, scheduleIds))
      : Promise.resolve([])
  ]);

  const participantsByLesson = new Map<string, LessonParticipant[]>();
  for (const row of participantRows) {
    const list = participantsByLesson.get(row.lessonId) ?? [];
    list.push({
      id: row.id,
      studentId: row.studentId,
      status: row.status as LessonParticipant["status"],
      balanceCharged: row.balanceCharged,
      hasDebt: row.hasDebt
    });
    participantsByLesson.set(row.lessonId, list);
  }

  const scheduleStudentsBySchedule = new Map<string, string[]>();
  for (const row of scheduleStudentRows) {
    const list = scheduleStudentsBySchedule.get(row.scheduleId) ?? [];
    list.push(row.studentId);
    scheduleStudentsBySchedule.set(row.scheduleId, list);
  }

  const skippedBySchedule = new Map<string, string[]>();
  for (const row of skippedRows) {
    const list = skippedBySchedule.get(row.scheduleId) ?? [];
    list.push(row.startsAt);
    skippedBySchedule.set(row.scheduleId, list);
  }

  return {
    students: studentRows.map(mapStudent),
    lessonPackages: packageRows.map(mapLessonPackage),
    lessons: lessonRows.map((row) => mapLesson(row, participantsByLesson.get(row.id) ?? [])),
    recurringSchedules: scheduleRows.map((row) =>
      mapRecurringSchedule(
        row,
        scheduleStudentsBySchedule.get(row.id) ?? [],
        skippedBySchedule.get(row.id) ?? []
      )
    ),
    payments: paymentRows.map(mapPayment),
    reminders: reminderRows.map(mapReminder),
    telegramInteractions: interactionRows.map(mapTelegramInteraction),
    balanceAdjustments: adjustmentRows.map(mapBalanceAdjustment),
    settings: settingsRows[0] ? mapSettings(settingsRows[0]) : createDefaultSettings()
  };
}

export async function countActiveStudents(accountId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(and(eq(students.accountId, accountId), eq(students.status, "active")));
  return Number(rows[0]?.count ?? 0);
}

export async function countLessonsInMonth(accountId: string, monthStart: Date, monthEnd: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(
      and(
        eq(lessons.accountId, accountId),
        gte(lessons.startsAt, monthStart.toISOString()),
        lt(lessons.startsAt, monthEnd.toISOString())
      )
    );
  return Number(rows[0]?.count ?? 0);
}

export async function countPackages(accountId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessonPackages)
    .where(eq(lessonPackages.accountId, accountId));
  return Number(rows[0]?.count ?? 0);
}

export async function countRecurringSchedules(accountId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(recurringSchedules)
    .where(eq(recurringSchedules.accountId, accountId));
  return Number(rows[0]?.count ?? 0);
}

export async function ensureAccountDefaults(accountId: string): Promise<void> {
  const [settingsCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(appSettings).where(eq(appSettings.accountId, accountId)),
  ]);

  if (Number(settingsCount[0]?.count ?? 0) === 0) {
    const defaults = createDefaultSettings();
    await db.insert(appSettings).values({
      accountId,
      lessonReminderMinutes: defaults.lessonReminderMinutes,
      individualDurationMinutes: defaults.individualDurationMinutes,
      groupDurationMinutes: defaults.groupDurationMinutes,
      defaultSingleLessonPrice: defaults.defaultSingleLessonPrice,
      currency: defaults.currency,
      cancellationPolicy: defaults.cancellationPolicy
    });
  }
}

export async function updateAppSettings(accountId: string, settings: AppSettings): Promise<void> {
  await db
    .update(appSettings)
    .set({
      lessonReminderMinutes: settings.lessonReminderMinutes,
      individualDurationMinutes: settings.individualDurationMinutes,
      groupDurationMinutes: settings.groupDurationMinutes,
      defaultSingleLessonPrice: settings.defaultSingleLessonPrice,
      currency: settings.currency,
      cancellationPolicy: settings.cancellationPolicy
    })
    .where(eq(appSettings.accountId, accountId));
}

export async function insertStudent(accountId: string, student: Student): Promise<void> {
  await db.insert(students).values({
    id: student.id,
    accountId,
    fullName: student.fullName,
    avatarUrl: student.avatarUrl ?? null,
    telegramUsername: student.telegramUsername ?? null,
    telegramUserId: student.telegramUserId ?? null,
    telegramChatId: student.telegramChatId ?? null,
    telegramBindToken: student.telegramBindToken,
    status: student.status,
    defaultLessonPrice: student.defaultLessonPrice,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt
  });
}

export async function findStudentByBindToken(token: string): Promise<(Student & { accountId: string }) | null> {
  const rows = await db.select().from(students).where(eq(students.telegramBindToken, token)).limit(1);
  if (!rows[0]) {
    return null;
  }
  return { ...mapStudent(rows[0]), accountId: rows[0].accountId };
}

export async function findStudentByTelegramUser(userId: string): Promise<(Student & { accountId: string }) | null> {
  const rows = await db.select().from(students).where(eq(students.telegramUserId, userId)).limit(1);
  if (!rows[0]) {
    return null;
  }
  return { ...mapStudent(rows[0]), accountId: rows[0].accountId };
}

export async function updateStudentRecord(student: Student): Promise<void> {
  await db
    .update(students)
    .set({
      fullName: student.fullName,
      avatarUrl: student.avatarUrl ?? null,
      telegramUsername: student.telegramUsername ?? null,
      telegramUserId: student.telegramUserId ?? null,
      telegramChatId: student.telegramChatId ?? null,
      telegramBindToken: student.telegramBindToken,
      status: student.status,
      defaultLessonPrice: student.defaultLessonPrice,
      updatedAt: student.updatedAt
    })
    .where(eq(students.id, student.id));
}

export async function deleteStudentRecords(studentId: string): Promise<void> {
  await db.delete(students).where(eq(students.id, studentId));
}

export async function insertLessonPackage(accountId: string, lessonPackage: LessonPackage): Promise<void> {
  await db.insert(lessonPackages).values({
    id: lessonPackage.id,
    accountId,
    name: lessonPackage.name,
    lessonCount: lessonPackage.lessonCount,
    price: lessonPackage.price,
    active: lessonPackage.active,
    createdAt: lessonPackage.createdAt,
    updatedAt: lessonPackage.updatedAt
  });
}

export async function deleteLessonPackageRecord(id: string): Promise<void> {
  await db.delete(lessonPackages).where(eq(lessonPackages.id, id));
}

export async function insertRecurringSchedule(accountId: string, schedule: RecurringSchedule): Promise<void> {
  await db.insert(recurringSchedules).values({
    id: schedule.id,
    accountId,
    weekday: schedule.weekday,
    time: schedule.time,
    durationMinutes: schedule.durationMinutes,
    lessonType: schedule.lessonType,
    activeFrom: schedule.activeFrom,
    activeTo: schedule.activeTo ?? null,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt
  });

  if (schedule.studentIds.length) {
    await db.insert(recurringScheduleStudents).values(
      schedule.studentIds.map((studentId) => ({
        scheduleId: schedule.id,
        studentId
      }))
    );
  }
}

export async function updateRecurringScheduleRecord(schedule: RecurringSchedule): Promise<void> {
  await db
    .update(recurringSchedules)
    .set({
      weekday: schedule.weekday,
      time: schedule.time,
      durationMinutes: schedule.durationMinutes,
      lessonType: schedule.lessonType,
      activeFrom: schedule.activeFrom,
      activeTo: schedule.activeTo ?? null,
      updatedAt: schedule.updatedAt
    })
    .where(eq(recurringSchedules.id, schedule.id));

  await db.delete(recurringScheduleStudents).where(eq(recurringScheduleStudents.scheduleId, schedule.id));
  if (schedule.studentIds.length) {
    await db.insert(recurringScheduleStudents).values(
      schedule.studentIds.map((studentId) => ({
        scheduleId: schedule.id,
        studentId
      }))
    );
  }

  await db.delete(recurringSkippedOccurrences).where(eq(recurringSkippedOccurrences.scheduleId, schedule.id));
  if (schedule.skippedOccurrences?.length) {
    await db.insert(recurringSkippedOccurrences).values(
      schedule.skippedOccurrences.map((startsAt) => ({
        scheduleId: schedule.id,
        startsAt
      }))
    );
  }
}

export async function deleteRecurringScheduleRecord(id: string): Promise<void> {
  await db.delete(recurringSchedules).where(eq(recurringSchedules.id, id));
}

export async function insertLessons(accountId: string, lessonList: Lesson[]): Promise<void> {
  if (!lessonList.length) {
    return;
  }

  await db.insert(lessons).values(lessonList.map((lesson) => mapLessonInsert(accountId, lesson)));
  const participantRows = lessonList.flatMap((lesson) =>
    lesson.participants.map((participant) => mapParticipantInsert(lesson.id, participant))
  );
  if (participantRows.length) {
    await db.insert(lessonParticipants).values(participantRows);
  }
}

export async function replaceLesson(lesson: Lesson): Promise<void> {
  await db
    .update(lessons)
    .set({
      startsAt: lesson.startsAt,
      durationMinutes: lesson.durationMinutes,
      originalType: lesson.originalType,
      effectiveType: lesson.effectiveType,
      status: lesson.status,
      recurringScheduleId: lesson.recurringScheduleId ?? null,
      googleCalendarEventId: lesson.googleCalendarEventId ?? null,
      updatedAt: lesson.updatedAt
    })
    .where(eq(lessons.id, lesson.id));

  await db.delete(lessonParticipants).where(eq(lessonParticipants.lessonId, lesson.id));
  if (lesson.participants.length) {
    await db.insert(lessonParticipants).values(
      lesson.participants.map((participant) => mapParticipantInsert(lesson.id, participant))
    );
  }
}

export async function deleteLessonsByIds(ids: string[]): Promise<void> {
  if (!ids.length) {
    return;
  }
  await db.delete(lessons).where(inArray(lessons.id, ids));
}

export async function insertPayment(accountId: string, payment: Payment): Promise<void> {
  await db.insert(payments).values({
    id: payment.id,
    accountId,
    studentId: payment.studentId,
    amount: payment.amount,
    paidAt: payment.paidAt,
    method: payment.method,
    packageId: payment.packageId ?? null,
    lessonCount: payment.lessonCount,
    createdAt: payment.createdAt
  });
}

export async function insertBalanceAdjustment(accountId: string, adjustment: BalanceAdjustment): Promise<void> {
  await db.insert(balanceAdjustments).values({
    id: adjustment.id,
    accountId,
    studentId: adjustment.studentId,
    lessonDelta: adjustment.lessonDelta,
    reason: adjustment.reason,
    createdAt: adjustment.createdAt
  });
}

export async function insertReminder(accountId: string, reminder: Reminder): Promise<void> {
  await db.insert(reminders).values({
    id: reminder.id,
    accountId,
    type: reminder.type,
    lessonId: reminder.lessonId ?? null,
    studentId: reminder.studentId ?? null,
    scheduledFor: reminder.scheduledFor,
    status: reminder.status,
    sentAt: reminder.sentAt ?? null,
    error: reminder.error ?? null,
    dedupeKey: reminder.dedupeKey,
    createdAt: reminder.createdAt
  });
}

export async function updateReminderRecord(reminder: Reminder): Promise<void> {
  await db
    .update(reminders)
    .set({
      type: reminder.type,
      lessonId: reminder.lessonId ?? null,
      studentId: reminder.studentId ?? null,
      scheduledFor: reminder.scheduledFor,
      status: reminder.status,
      sentAt: reminder.sentAt ?? null,
      error: reminder.error ?? null,
      dedupeKey: reminder.dedupeKey
    })
    .where(eq(reminders.id, reminder.id));
}

export async function insertTelegramInteraction(accountId: string, interaction: TelegramInteraction): Promise<void> {
  await db.insert(telegramInteractions).values({
    id: interaction.id,
    accountId,
    lessonId: interaction.lessonId,
    studentId: interaction.studentId,
    action: interaction.action,
    createdAt: interaction.createdAt
  });
}

export async function replaceParticipantDebtFlags(
  flags: Array<{ participantId: string; hasDebt: boolean }>
): Promise<void> {
  await Promise.all(
    flags.map((flag) =>
      db
        .update(lessonParticipants)
        .set({ hasDebt: flag.hasDebt })
        .where(eq(lessonParticipants.id, flag.participantId))
    )
  );
}

export async function getLessonAccountId(lessonId: string): Promise<string | null> {
  const rows = await db.select({ accountId: lessons.accountId }).from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  return rows[0]?.accountId ?? null;
}

export async function assignLegacyDataToAccount(accountId: string): Promise<void> {
  await db.update(students).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(lessonPackages).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(recurringSchedules).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(lessons).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(payments).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(reminders).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(telegramInteractions).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);
  await db.update(balanceAdjustments).set({ accountId }).where(sql`account_id IS NULL OR account_id = ''`);

  const legacySettings = await db.select().from(appSettings).where(sql`account_id = 'default'`).limit(1);
  if (legacySettings[0]) {
    const row = legacySettings[0];
    await db
      .insert(appSettings)
      .values({
        accountId,
        lessonReminderMinutes: row.lessonReminderMinutes,
        individualDurationMinutes: row.individualDurationMinutes,
        groupDurationMinutes: row.groupDurationMinutes,
        defaultSingleLessonPrice: row.defaultSingleLessonPrice,
        currency: row.currency,
        cancellationPolicy: row.cancellationPolicy
      })
      .onConflictDoNothing();
    await db.delete(appSettings).where(eq(appSettings.accountId, "default" as never));
  } else {
    await ensureAccountDefaults(accountId);
  }
}

function mapAccount(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image ?? undefined,
    plan: row.plan as AccountPlan,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapStudent(row: typeof students.$inferSelect): Student {
  return {
    id: row.id,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl ?? undefined,
    telegramUsername: row.telegramUsername ?? undefined,
    telegramUserId: row.telegramUserId ?? undefined,
    telegramChatId: row.telegramChatId ?? undefined,
    telegramBindToken: row.telegramBindToken,
    status: row.status as Student["status"],
    defaultLessonPrice: row.defaultLessonPrice,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapLessonPackage(row: typeof lessonPackages.$inferSelect): LessonPackage {
  return {
    id: row.id,
    name: row.name,
    lessonCount: row.lessonCount,
    price: row.price,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapLesson(row: typeof lessons.$inferSelect, participants: LessonParticipant[]): Lesson {
  return {
    id: row.id,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    originalType: row.originalType as Lesson["originalType"],
    effectiveType: row.effectiveType as Lesson["effectiveType"],
    status: row.status as Lesson["status"],
    participants,
    recurringScheduleId: row.recurringScheduleId ?? undefined,
    googleCalendarEventId: row.googleCalendarEventId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapRecurringSchedule(
  row: typeof recurringSchedules.$inferSelect,
  studentIds: string[],
  skippedOccurrences: string[]
): RecurringSchedule {
  return {
    id: row.id,
    weekday: row.weekday,
    time: row.time,
    durationMinutes: row.durationMinutes,
    lessonType: row.lessonType as RecurringSchedule["lessonType"],
    studentIds,
    activeFrom: row.activeFrom,
    activeTo: row.activeTo ?? undefined,
    skippedOccurrences,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapPayment(row: typeof payments.$inferSelect): Payment {
  return {
    id: row.id,
    studentId: row.studentId,
    amount: row.amount,
    paidAt: row.paidAt,
    method: row.method as Payment["method"],
    packageId: row.packageId ?? undefined,
    lessonCount: row.lessonCount,
    createdAt: row.createdAt
  };
}

function mapReminder(row: typeof reminders.$inferSelect): Reminder {
  return {
    id: row.id,
    type: row.type as Reminder["type"],
    lessonId: row.lessonId ?? undefined,
    studentId: row.studentId ?? undefined,
    scheduledFor: row.scheduledFor,
    status: row.status as Reminder["status"],
    sentAt: row.sentAt ?? undefined,
    error: row.error ?? undefined,
    dedupeKey: row.dedupeKey,
    createdAt: row.createdAt
  };
}

function mapTelegramInteraction(row: typeof telegramInteractions.$inferSelect): TelegramInteraction {
  return {
    id: row.id,
    lessonId: row.lessonId,
    studentId: row.studentId,
    action: row.action as TelegramInteraction["action"],
    createdAt: row.createdAt
  };
}

function mapBalanceAdjustment(row: typeof balanceAdjustments.$inferSelect): BalanceAdjustment {
  return {
    id: row.id,
    studentId: row.studentId,
    lessonDelta: row.lessonDelta,
    reason: row.reason,
    createdAt: row.createdAt
  };
}

function mapSettings(row: typeof appSettings.$inferSelect): AppSettings {
  return {
    lessonReminderMinutes: row.lessonReminderMinutes,
    individualDurationMinutes: row.individualDurationMinutes,
    groupDurationMinutes: row.groupDurationMinutes,
    defaultSingleLessonPrice: row.defaultSingleLessonPrice,
    currency: row.currency,
    cancellationPolicy: row.cancellationPolicy as AppSettings["cancellationPolicy"]
  };
}

function mapLessonInsert(accountId: string, lesson: Lesson) {
  return {
    id: lesson.id,
    accountId,
    startsAt: lesson.startsAt,
    durationMinutes: lesson.durationMinutes,
    originalType: lesson.originalType,
    effectiveType: lesson.effectiveType,
    status: lesson.status,
    recurringScheduleId: lesson.recurringScheduleId ?? null,
    googleCalendarEventId: lesson.googleCalendarEventId ?? null,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt
  };
}

function mapParticipantInsert(lessonId: string, participant: LessonParticipant) {
  return {
    id: participant.id,
    lessonId,
    studentId: participant.studentId,
    status: participant.status,
    balanceCharged: participant.balanceCharged,
    hasDebt: participant.hasDebt
  };
}
