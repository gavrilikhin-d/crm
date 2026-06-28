import { eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
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

export async function loadDatabase(): Promise<Database> {
  const [
    studentRows,
    packageRows,
    lessonRows,
    participantRows,
    scheduleRows,
    scheduleStudentRows,
    skippedRows,
    paymentRows,
    reminderRows,
    interactionRows,
    adjustmentRows,
    settingsRows
  ] = await Promise.all([
    db.select().from(students),
    db.select().from(lessonPackages),
    db.select().from(lessons),
    db.select().from(lessonParticipants),
    db.select().from(recurringSchedules),
    db.select().from(recurringScheduleStudents),
    db.select().from(recurringSkippedOccurrences),
    db.select().from(payments),
    db.select().from(reminders),
    db.select().from(telegramInteractions),
    db.select().from(balanceAdjustments),
    db.select().from(appSettings)
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

export async function ensureDefaults(): Promise<void> {
  const [settingsCount, packagesCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(appSettings),
    db.select({ count: sql<number>`count(*)` }).from(lessonPackages)
  ]);

  if (Number(settingsCount[0]?.count ?? 0) === 0) {
    const defaults = createDefaultSettings();
    await db.insert(appSettings).values({
      id: "default",
      lessonReminderMinutes: defaults.lessonReminderMinutes,
      individualDurationMinutes: defaults.individualDurationMinutes,
      groupDurationMinutes: defaults.groupDurationMinutes,
      defaultSingleLessonPrice: defaults.defaultSingleLessonPrice,
      currency: defaults.currency,
      cancellationPolicy: defaults.cancellationPolicy
    });
  }

  if (Number(packagesCount[0]?.count ?? 0) === 0) {
    const timestamp = new Date().toISOString();
    await db.insert(lessonPackages).values([
      {
        id: nanoid(),
        name: "Разовое занятие",
        lessonCount: 1,
        price: 3000,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: nanoid(),
        name: "Пакет 4 занятия",
        lessonCount: 4,
        price: 11000,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: nanoid(),
        name: "Пакет 8 занятий",
        lessonCount: 8,
        price: 20000,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]);
  }
}

export async function updateAppSettings(settings: AppSettings): Promise<void> {
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
    .where(eq(appSettings.id, "default"));
}

export async function insertStudent(student: Student): Promise<void> {
  await db.insert(students).values({
    id: student.id,
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

export async function insertLessonPackage(lessonPackage: LessonPackage): Promise<void> {
  await db.insert(lessonPackages).values({
    id: lessonPackage.id,
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

export async function insertRecurringSchedule(schedule: RecurringSchedule): Promise<void> {
  await db.insert(recurringSchedules).values({
    id: schedule.id,
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

export async function insertLessons(lessonList: Lesson[]): Promise<void> {
  if (!lessonList.length) {
    return;
  }

  await db.insert(lessons).values(lessonList.map(mapLessonInsert));
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

export async function insertPayment(payment: Payment): Promise<void> {
  await db.insert(payments).values({
    id: payment.id,
    studentId: payment.studentId,
    amount: payment.amount,
    paidAt: payment.paidAt,
    method: payment.method,
    packageId: payment.packageId ?? null,
    lessonCount: payment.lessonCount,
    createdAt: payment.createdAt
  });
}

export async function insertBalanceAdjustment(adjustment: BalanceAdjustment): Promise<void> {
  await db.insert(balanceAdjustments).values({
    id: adjustment.id,
    studentId: adjustment.studentId,
    lessonDelta: adjustment.lessonDelta,
    reason: adjustment.reason,
    createdAt: adjustment.createdAt
  });
}

export async function insertReminder(reminder: Reminder): Promise<void> {
  await db.insert(reminders).values({
    id: reminder.id,
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

export async function insertTelegramInteraction(interaction: TelegramInteraction): Promise<void> {
  await db.insert(telegramInteractions).values({
    id: interaction.id,
    lessonId: interaction.lessonId,
    studentId: interaction.studentId,
    action: interaction.action,
    createdAt: interaction.createdAt
  });
}

export async function replaceParticipantDebtFlags(
  studentId: string,
  flags: Array<{ lessonId: string; participantId: string; hasDebt: boolean }>
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

export async function importDatabase(snapshot: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(telegramInteractions);
    await tx.delete(reminders);
    await tx.delete(lessonParticipants);
    await tx.delete(lessons);
    await tx.delete(recurringSkippedOccurrences);
    await tx.delete(recurringScheduleStudents);
    await tx.delete(recurringSchedules);
    await tx.delete(payments);
    await tx.delete(balanceAdjustments);
    await tx.delete(students);
    await tx.delete(lessonPackages);
    await tx.delete(appSettings);

    await tx.insert(appSettings).values({
      id: "default",
      lessonReminderMinutes: snapshot.settings.lessonReminderMinutes,
      individualDurationMinutes: snapshot.settings.individualDurationMinutes,
      groupDurationMinutes: snapshot.settings.groupDurationMinutes,
      defaultSingleLessonPrice: snapshot.settings.defaultSingleLessonPrice,
      currency: snapshot.settings.currency,
      cancellationPolicy: snapshot.settings.cancellationPolicy
    });

    if (snapshot.students.length) {
      await tx.insert(students).values(snapshot.students.map((student) => ({
        id: student.id,
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
      })));
    }

    if (snapshot.lessonPackages.length) {
      await tx.insert(lessonPackages).values(snapshot.lessonPackages.map((item) => ({
        id: item.id,
        name: item.name,
        lessonCount: item.lessonCount,
        price: item.price,
        active: item.active,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })));
    }

    if (snapshot.recurringSchedules.length) {
      await tx.insert(recurringSchedules).values(
        snapshot.recurringSchedules.map((schedule) => ({
          id: schedule.id,
          weekday: schedule.weekday,
          time: schedule.time,
          durationMinutes: schedule.durationMinutes,
          lessonType: schedule.lessonType,
          activeFrom: schedule.activeFrom,
          activeTo: schedule.activeTo ?? null,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt
        }))
      );

      const scheduleStudents = snapshot.recurringSchedules.flatMap((schedule) =>
        schedule.studentIds.map((studentId) => ({
          scheduleId: schedule.id,
          studentId
        }))
      );
      if (scheduleStudents.length) {
        await tx.insert(recurringScheduleStudents).values(scheduleStudents);
      }

      const skipped = snapshot.recurringSchedules.flatMap((schedule) =>
        (schedule.skippedOccurrences ?? []).map((startsAt) => ({
          scheduleId: schedule.id,
          startsAt
        }))
      );
      if (skipped.length) {
        await tx.insert(recurringSkippedOccurrences).values(skipped);
      }
    }

    if (snapshot.lessons.length) {
      await tx.insert(lessons).values(snapshot.lessons.map(mapLessonInsert));
      const participants = snapshot.lessons.flatMap((lesson) =>
        lesson.participants.map((participant) => mapParticipantInsert(lesson.id, participant))
      );
      if (participants.length) {
        await tx.insert(lessonParticipants).values(participants);
      }
    }

    if (snapshot.payments.length) {
      await tx.insert(payments).values(snapshot.payments.map((payment) => ({
        id: payment.id,
        studentId: payment.studentId,
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
        packageId: payment.packageId ?? null,
        lessonCount: payment.lessonCount,
        createdAt: payment.createdAt
      })));
    }

    if (snapshot.balanceAdjustments.length) {
      await tx.insert(balanceAdjustments).values(snapshot.balanceAdjustments);
    }

    if (snapshot.reminders.length) {
      await tx.insert(reminders).values(
        snapshot.reminders.map((reminder) => ({
          id: reminder.id,
          type: reminder.type,
          lessonId: reminder.lessonId ?? null,
          studentId: reminder.studentId ?? null,
          scheduledFor: reminder.scheduledFor,
          status: reminder.status,
          sentAt: reminder.sentAt ?? null,
          error: reminder.error ?? null,
          dedupeKey: reminder.dedupeKey,
          createdAt: reminder.createdAt
        }))
      );
    }

    if (snapshot.telegramInteractions.length) {
      await tx.insert(telegramInteractions).values(snapshot.telegramInteractions);
    }
  });
}

export async function resetDatabase(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(telegramInteractions);
    await tx.delete(reminders);
    await tx.delete(lessonParticipants);
    await tx.delete(lessons);
    await tx.delete(recurringSkippedOccurrences);
    await tx.delete(recurringScheduleStudents);
    await tx.delete(recurringSchedules);
    await tx.delete(payments);
    await tx.delete(balanceAdjustments);
    await tx.delete(students);
    await tx.delete(lessonPackages);
    await tx.delete(appSettings);
  });
  await ensureDefaults();
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

function mapLesson(
  row: typeof lessons.$inferSelect,
  participants: LessonParticipant[]
): Lesson {
  return {
    id: row.id,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    originalType: row.originalType as Lesson["originalType"],
    effectiveType: row.effectiveType as Lesson["effectiveType"],
    status: row.status as Lesson["status"],
    participants,
    recurringScheduleId: row.recurringScheduleId ?? undefined,
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

function mapLessonInsert(lesson: Lesson) {
  return {
    id: lesson.id,
    startsAt: lesson.startsAt,
    durationMinutes: lesson.durationMinutes,
    originalType: lesson.originalType,
    effectiveType: lesson.effectiveType,
    status: lesson.status,
    recurringScheduleId: lesson.recurringScheduleId ?? null,
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
