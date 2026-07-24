import { nanoid } from "nanoid";
import type {
  Account,
  AccountInfo,
  AccountPlan,
  AppSettings,
  BalanceAdjustment,
  Database,
  GoogleCalendarStatus,
  Lesson,
  LessonPackage,
  ParticipantStatus,
  Payment,
  PaymentMethod,
  RecurringDeleteScope,
  Reminder,
  RecurringSchedule,
  Student,
  StudentBalance,
  TelegramInteraction,
  TelegramStudentProfile,
  VacationPeriod
} from "@crm/shared";
import { assertStudentCanChangeParticipantStatus, assertTeacherParticipantStatus } from "@crm/shared/lesson-attendance";
import { dedupeLessonsByOccurrence } from "@crm/shared/lesson-dedupe";
import {
  coalesceLessonReminderDeliveries,
  desiredLessonReminders,
  isLessonReminderStillValid,
  planLessonReminderSync,
  utcDateKey,
  type ClaimedLessonReminder,
  type PaymentReminderContext
} from "@crm/shared/lesson-reminder";
import { lessonOverlapsVacation, normalizeVacationPeriod } from "@crm/shared/vacation";
import { getPlanLimits } from "@crm/shared/plans";
import { isSupportedCurrency } from "@crm/shared/currency";
import { isValidTimeZone, resolveNotificationTimeZone } from "@crm/shared/timezone";
import type { AuthContext } from "./auth";
import {
  deleteStudentAvatar,
  deleteStudentAvatars,
  ensureAvatarsDir,
  readStudentAvatar,
  saveStudentAvatar,
  studentAvatarPath
} from "./avatars";
import {
  claimPendingLessonReminderRows,
  deleteLessonsByIds,
  deleteAccountRecord,
  deleteLessonPackageRecord,
  deletePaymentRecord,
  deleteRecurringScheduleRecord,
  deleteStudentRecords,
  deleteVacationPeriodById,
  findStudentByBindToken,
  findStudentById,
  findStudentByTelegramUser,
  getAccountById,
  insertActivityEvent,
  insertBalanceAdjustment,
  insertLessonPackage,
  insertLessons,
  insertNotificationDelivery,
  insertPayment,
  insertRecurringSchedule,
  insertReminder,
  insertStudent,
  insertTelegramInteraction,
  insertVacationPeriod,
  listAccountIds,
  loadAccountDatabase,
  replaceLesson,
  replaceParticipantDebtFlags,
  updateRecurringScheduleRecord,
  updateReminderRecord,
  updateStudentTelegramPreferences,
  updateStudentRecord,
  updateAppSettings,
  upsertAccountByGoogle,
  type ActivityActorType
} from "./db/repository";

import {
  assertCanCreateLesson,
  assertCanCreatePackage,
  assertCanCreateStudent,
  getAccountUsage,
  PlanLimitError
} from "./plan-limits";
import {
  createGoogleCalendarConnectUrl,
  disconnectGoogleCalendar,
  exchangeGoogleCalendarCode,
  getGoogleCalendarStatus as readGoogleCalendarStatus,
  saveGoogleCalendarTokens
} from "./google-calendar/client";
import {
  removeLessonFromGoogleCalendar,
  scheduleGoogleCalendarSync,
  setGoogleCalendarSyncEnabled,
  syncAllLessonsToGoogleCalendar
} from "./google-calendar/sync";
import { notifyTelegramDisconnects } from "./telegram-disconnect";
import {
  applyLessonCompletionCharges,
  applyTeacherParticipantStatusUpdate,
  buildLesson,
  buildRecurringSchedule,
  createTelegramBindToken,
  syncLessonCompletionWithSchedule,
  getStudentBalance,
  hasExactLessonDuplicate,
  materializeRecurringLessons,
  mustFind,
  normalizeReminderMinutes,
  now,
  optional,
  parseReminderMinutes,
  recalculateLesson,
  refreshParticipantDebtFlags,
  collectParticipantDebtFlagUpdates,
  skipRecurringOccurrence
} from "./store-logic";

export type ReminderUpdatePatch = Partial<Reminder> & {
  telegramChatId?: string | null;
  leadMinutes?: number | null;
};

function recordActivity(
  accountId: string,
  action: string,
  options: {
    actorType: ActivityActorType;
    actorStudentId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): void {
  void insertActivityEvent({
    accountId,
    action,
    actorType: options.actorType,
    actorStudentId: options.actorStudentId,
    entityType: options.entityType,
    entityId: options.entityId,
    metadata: options.metadata
  }).catch((error) => {
    console.warn("[activity] Failed to record activity", { accountId, action, err: error });
  });
}

export { parseReminderMinutes, PlanLimitError };

export class StoreValidationError extends Error {
  code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "StoreValidationError";
    this.code = code;
  }
}

export class Store {
  async initialize(): Promise<void> {
    await ensureAvatarsDir();
  }

  async syncAccount(input: {
    googleSub: string;
    email: string;
    name: string;
    image?: string;
    plan?: AccountPlan;
  }): Promise<Account> {
    return upsertAccountByGoogle(input);
  }

  async getAccountInfo(ctx: AuthContext): Promise<AccountInfo> {
    const account = await getAccountById(ctx.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const usage = await getAccountUsage(ctx.accountId);
    return {
      account,
      usage,
      limits: getPlanLimits(account.plan)
    };
  }

  async deleteAccount(ctx: AuthContext): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    const studentIds = db.students.map((student) => student.id);
    const telegramTargets = db.students.flatMap((student) =>
      student.telegramChatId ? [{ chatId: student.telegramChatId }] : []
    );

    await deleteAccountRecord(ctx.accountId);
    await notifyTelegramDisconnects(telegramTargets);
    await deleteStudentAvatars(studentIds);
  }

  async getSnapshot(ctx: AuthContext): Promise<Database> {
    const db = await loadAccountDatabase(ctx.accountId);
    const created = materializeRecurringLessons(db);
    if (created.length) {
      await insertLessons(ctx.accountId, created);
      scheduleGoogleCalendarSync(ctx.accountId, created);
      await this.syncLessonReminders(ctx.accountId, created, db);
    }

    db.lessons = dedupeLessonsByOccurrence(db.lessons);

    return structuredClone(db);
  }

  async createStudent(
    ctx: AuthContext,
    input: {
      fullName: string;
      avatarDataUrl?: string;
      telegramUsername?: string;
      telegramUserId?: string;
      telegramChatId?: string;
      defaultLessonPrice?: number;
    }
  ): Promise<Student> {
    await assertCanCreateStudent(ctx.accountId, ctx.plan);
    const db = await loadAccountDatabase(ctx.accountId);
    const timestamp = now();
    const student: Student = {
      id: nanoid(),
      fullName: input.fullName.trim(),
      telegramUsername: optional(input.telegramUsername),
      telegramChatId: optional(input.telegramChatId),
      telegramBindToken: createTelegramBindToken(db),
      status: "active",
      defaultLessonPrice: input.defaultLessonPrice ?? db.settings.defaultSingleLessonPrice,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (input.avatarDataUrl) {
      await saveStudentAvatar(student.id, input.avatarDataUrl);
      student.avatarUrl = studentAvatarPath(student.id);
    }

    await insertStudent(ctx.accountId, student);
    recordActivity(ctx.accountId, "student.create", {
      actorType: "teacher",
      entityType: "student",
      entityId: student.id,
      metadata: { fullName: student.fullName, status: student.status }
    });
    return student;
  }

  async bindTelegramChat(
    token: string,
    chatId: number | string,
    userId: number | string,
    username?: string
  ): Promise<Student> {
    const linked = await findStudentByBindToken(token);
    if (!linked) {
      throw new Error("Telegram binding token is invalid");
    }

    const db = await loadAccountDatabase(linked.accountId);
    const student = mustFind(db.students, linked.id, "Student");

    const telegramUserId = String(userId);
    const linkedToAnother = db.students.find(
      (item) => item.id !== student.id && item.telegramUserId === telegramUserId
    );
    if (linkedToAnother) {
      throw new Error("This Telegram account is already linked to another student");
    }

    student.telegramUserId = telegramUserId;
    student.telegramChatId = String(chatId);
    student.telegramUsername = optional(username) ?? student.telegramUsername;
    student.updatedAt = now();
    await updateStudentRecord(student);
    recordActivity(linked.accountId, "telegram.bind", {
      actorType: "student",
      actorStudentId: student.id,
      entityType: "student",
      entityId: student.id,
      metadata: { telegramUserId, telegramChatId: student.telegramChatId }
    });
    return student;
  }

  async getTelegramStudentProfile(
    userId: string | number,
    options?: { days?: number }
  ): Promise<TelegramStudentProfile> {
    const linked = await findStudentByTelegramUser(String(userId));
    if (!linked) {
      throw new Error("Student not found");
    }

    const db = await this.getSnapshot({ accountId: linked.accountId, email: "", plan: "free" });
    const student = mustFind(db.students, linked.id, "Student");

    const days = Math.min(90, Math.max(1, options?.days ?? 7));
    const currentTime = Date.now();
    const windowEnd = currentTime + days * 24 * 60 * 60 * 1000;
    const balance = getStudentBalance(db, student.id);
    const upcomingLessons = db.lessons
      .filter((lesson) => {
        const startsAt = new Date(lesson.startsAt).getTime();
        if (startsAt < currentTime || startsAt > windowEnd) {
          return false;
        }
        if (lesson.status === "cancelled_by_teacher") {
          return false;
        }
        return lesson.participants.some((participant) => participant.studentId === student.id);
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        lessonReminderMinutes: student.lessonReminderMinutes ?? null,
        timezone: student.timezone ?? null
      },
      settings: {
        lessonReminderMinutes: db.settings.lessonReminderMinutes,
        timezone: db.settings.timezone
      },
      balance,
      upcomingLessons,
      scheduleDays: days
    };
  }

  async updateTelegramStudentPreferences(
    userId: string | number,
    input: { lessonReminderMinutes?: unknown; timezone?: unknown }
  ): Promise<TelegramStudentProfile> {
    const linked = await findStudentByTelegramUser(String(userId));
    if (!linked) {
      throw new Error("Student not found");
    }

    const db = await loadAccountDatabase(linked.accountId);
    const patch: {
      lessonReminderMinutes?: number[] | null;
      timezone?: string | null;
    } = {};

    if ("lessonReminderMinutes" in input) {
      patch.lessonReminderMinutes =
        input.lessonReminderMinutes === null
          ? null
          : normalizeReminderMinutes(input.lessonReminderMinutes, db.settings.lessonReminderMinutes);
    }

    if ("timezone" in input) {
      if (input.timezone === null || input.timezone === "") {
        patch.timezone = null;
      } else if (typeof input.timezone === "string" && isValidTimeZone(input.timezone.trim())) {
        patch.timezone = input.timezone.trim();
      } else {
        throw new StoreValidationError("invalid_timezone", "Invalid timezone");
      }
    }

    if (!Object.keys(patch).length) {
      throw new StoreValidationError("invalid_preferences", "No preferences provided");
    }

    const updated = await updateStudentTelegramPreferences(linked.id, patch);
    if (!updated) {
      throw new Error("Student not found");
    }

    if ("lessonReminderMinutes" in patch) {
      recordActivity(linked.accountId, "student.reminder_minutes.update", {
        actorType: "student",
        actorStudentId: linked.id,
        entityType: "student",
        entityId: linked.id,
        metadata: { lessonReminderMinutes: patch.lessonReminderMinutes }
      });
    }
    if ("timezone" in patch) {
      recordActivity(linked.accountId, "student.timezone.update", {
        actorType: "student",
        actorStudentId: linked.id,
        entityType: "student",
        entityId: linked.id,
        metadata: { timezone: patch.timezone }
      });
    }

    if ("lessonReminderMinutes" in patch || "timezone" in patch) {
      await this.syncStudentLessonReminders(linked.accountId, linked.id);
    }

    return this.getTelegramStudentProfile(userId);
  }

  async updateStudent(
    ctx: AuthContext,
    id: string,
    input: Partial<Omit<Student, "id" | "createdAt">> & { avatarDataUrl?: string | null }
  ): Promise<Student> {
    const db = await loadAccountDatabase(ctx.accountId);
    const student = mustFind(db.students, id, "Student");

    if (input.avatarDataUrl !== undefined) {
      if (input.avatarDataUrl) {
        await saveStudentAvatar(student.id, input.avatarDataUrl);
        student.avatarUrl = studentAvatarPath(student.id);
      } else {
        await deleteStudentAvatar(student.id);
        student.avatarUrl = undefined;
      }
    }

    const { avatarDataUrl: _avatarDataUrl, ...rest } = input;
    Object.assign(student, {
      ...rest,
      fullName: input.fullName !== undefined ? input.fullName.trim() : student.fullName,
      telegramUsername: input.telegramUsername === "" ? undefined : input.telegramUsername,
      telegramUserId: input.telegramUserId === "" ? undefined : input.telegramUserId,
      telegramChatId: input.telegramChatId === "" ? undefined : input.telegramChatId,
      updatedAt: now()
    });

    if (!student.fullName) {
      throw new Error("Full name is required");
    }
    await updateStudentRecord(student);

    if ("lessonReminderMinutes" in rest || "timezone" in rest) {
      await this.syncStudentLessonReminders(ctx.accountId, student.id, db);
    }

    recordActivity(ctx.accountId, "student.update", {
      actorType: "teacher",
      entityType: "student",
      entityId: student.id,
      metadata: {
        fullName: student.fullName,
        status: student.status,
        telegramUserId: student.telegramUserId ?? null,
        telegramChatId: student.telegramChatId ?? null
      }
    });
    return student;
  }

  async getStudentAvatar(ctx: AuthContext, id: string): Promise<{ buffer: Buffer; mime: string } | null> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.students, id, "Student");
    return readStudentAvatar(id);
  }

  async deleteStudent(ctx: AuthContext, id: string): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.students, id, "Student");

    for (const lesson of db.lessons) {
      lesson.participants = lesson.participants.filter((participant) => participant.studentId !== id);
      lesson.updatedAt = now();
      recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
    }

    const emptyLessons = db.lessons.filter((lesson) => lesson.participants.length === 0);

    const avatarDelete = deleteStudentAvatar(id).catch((error) => {
      console.warn(`[student-delete] Failed to delete avatar for ${id}`, error);
    });

    const remainingLessons = db.lessons.filter((lesson) => lesson.participants.length > 0);

    await Promise.all([
      avatarDelete,
      deleteStudentRecords(id),
      ...emptyLessons.map((lesson) => this.purgeLesson(ctx.accountId, db, lesson)),
      ...remainingLessons.map((lesson) => replaceLesson(lesson))
    ]);

    if (remainingLessons.length) {
      await this.syncLessonReminders(ctx.accountId, remainingLessons, db);
    }

    recordActivity(ctx.accountId, "student.delete", {
      actorType: "teacher",
      entityType: "student",
      entityId: id
    });
  }

  private async purgeLesson(accountId: string, db: Database, lesson: Lesson): Promise<void> {
    await removeLessonFromGoogleCalendar(accountId, lesson);
    const schedule = skipRecurringOccurrence(db, lesson);
    if (schedule) {
      await updateRecurringScheduleRecord(schedule);
    }
    await deleteLessonsByIds([lesson.id]);
  }

  private async applyVacationCancellations(
    accountId: string,
    db: Database,
    period: VacationPeriod
  ): Promise<number> {
    const cancelledLessons: Lesson[] = [];
    const schedulesToUpdate = new Map<string, RecurringSchedule>();

    for (const lesson of db.lessons) {
      if (lesson.status !== "scheduled" && lesson.status !== "confirmed") {
        continue;
      }

      if (!lessonOverlapsVacation(lesson.startsAt, lesson.durationMinutes, [period])) {
        continue;
      }

      lesson.status = "cancelled_by_teacher";
      lesson.participants.forEach((participant) => {
        if (participant.status === "awaiting" || participant.status === "confirmed") {
          participant.status = "declined";
        }
      });
      lesson.updatedAt = now();
      await replaceLesson(lesson);
      cancelledLessons.push(lesson);

      const schedule = skipRecurringOccurrence(db, lesson);
      if (schedule) {
        schedulesToUpdate.set(schedule.id, schedule);
      }
    }

    await Promise.all([...schedulesToUpdate.values()].map((schedule) => updateRecurringScheduleRecord(schedule)));

    if (cancelledLessons.length) {
      scheduleGoogleCalendarSync(accountId, cancelledLessons);
      await this.syncLessonReminders(accountId, cancelledLessons, db);
    }

    return cancelledLessons.length;
  }

  async createLessonPackage(
    ctx: AuthContext,
    input: { name: string; lessonCount: number; price: number; currency?: string }
  ): Promise<LessonPackage> {
    await assertCanCreatePackage(ctx.accountId, ctx.plan);
    const db = await loadAccountDatabase(ctx.accountId);
    const currency = input.currency ?? db.settings.currency;
    if (!isSupportedCurrency(currency)) {
      throw new Error("Unsupported currency");
    }
    const timestamp = now();
    const lessonPackage: LessonPackage = {
      id: nanoid(),
      name: input.name.trim(),
      lessonCount: Math.max(1, Math.trunc(input.lessonCount)),
      price: Math.max(0, input.price),
      currency,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await insertLessonPackage(ctx.accountId, lessonPackage);
    recordActivity(ctx.accountId, "package.create", {
      actorType: "teacher",
      entityType: "package",
      entityId: lessonPackage.id,
      metadata: {
        name: lessonPackage.name,
        lessonCount: lessonPackage.lessonCount,
        price: lessonPackage.price,
        currency: lessonPackage.currency
      }
    });
    return lessonPackage;
  }

  async deleteLessonPackage(ctx: AuthContext, id: string): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.lessonPackages, id, "LessonPackage");
    await deleteLessonPackageRecord(id);
    recordActivity(ctx.accountId, "package.delete", {
      actorType: "teacher",
      entityType: "package",
      entityId: id
    });
  }

  async updateSettings(
    ctx: AuthContext,
    input: Partial<Pick<AppSettings, "currency" | "lessonReminderMinutes">> & {
      googleCalendarSyncEnabled?: boolean;
    }
  ): Promise<AppSettings> {
    const db = await loadAccountDatabase(ctx.accountId);
    if (input.currency !== undefined && !isSupportedCurrency(input.currency)) {
      throw new Error("Unsupported currency");
    }

    if (input.googleCalendarSyncEnabled !== undefined) {
      await setGoogleCalendarSyncEnabled(ctx.accountId, input.googleCalendarSyncEnabled);
    }

    const settings: AppSettings = {
      ...db.settings,
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.lessonReminderMinutes !== undefined
        ? { lessonReminderMinutes: normalizeReminderMinutes(input.lessonReminderMinutes) }
        : {})
    };
    await updateAppSettings(ctx.accountId, settings);
    db.settings = settings;

    if (input.lessonReminderMinutes !== undefined) {
      await this.syncLessonReminders(ctx.accountId, db.lessons, db);
    }

    recordActivity(ctx.accountId, "settings.update", {
      actorType: "teacher",
      entityType: "settings",
      entityId: ctx.accountId,
      metadata: {
        currency: settings.currency,
        lessonReminderMinutes: settings.lessonReminderMinutes,
        googleCalendarSyncEnabled: input.googleCalendarSyncEnabled
      }
    });
    return settings;
  }

  async createVacationPeriod(
    ctx: AuthContext,
    input: { startsOn: string; endsOn: string; startsAtTime?: string; endsAtTime?: string; label?: string }
  ): Promise<{ period: VacationPeriod; cancelledLessons: number }> {
    const normalized = normalizeVacationPeriod(input);
    const db = await loadAccountDatabase(ctx.accountId);
    const timestamp = now();
    const period: VacationPeriod = {
      id: nanoid(),
      ...normalized,
      label: optional(input.label),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await insertVacationPeriod(ctx.accountId, period);
    db.vacationPeriods.push(period);
    const cancelledLessons = await this.applyVacationCancellations(ctx.accountId, db, period);
    recordActivity(ctx.accountId, "vacation.create", {
      actorType: "teacher",
      entityType: "vacation",
      entityId: period.id,
      metadata: {
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        cancelledLessons
      }
    });

    return { period, cancelledLessons };
  }

  async deleteVacationPeriod(ctx: AuthContext, id: string): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.vacationPeriods, id, "VacationPeriod");
    await deleteVacationPeriodById(id);
    recordActivity(ctx.accountId, "vacation.delete", {
      actorType: "teacher",
      entityType: "vacation",
      entityId: id
    });
  }

  async getGoogleCalendarStatus(ctx: AuthContext): Promise<GoogleCalendarStatus> {
    return readGoogleCalendarStatus(ctx.accountId);
  }

  async getGoogleCalendarConnectUrl(ctx: AuthContext): Promise<string> {
    return createGoogleCalendarConnectUrl(ctx.accountId);
  }

  async completeGoogleCalendarConnect(accountId: string, code: string): Promise<void> {
    const tokens = await exchangeGoogleCalendarCode(code);
    await saveGoogleCalendarTokens(accountId, tokens);
    recordActivity(accountId, "gcal.connect", {
      actorType: "teacher",
      entityType: "account",
      entityId: accountId
    });
  }

  async disconnectGoogleCalendar(ctx: AuthContext): Promise<void> {
    await disconnectGoogleCalendar(ctx.accountId);
    recordActivity(ctx.accountId, "gcal.disconnect", {
      actorType: "teacher",
      entityType: "account",
      entityId: ctx.accountId
    });
  }

  async syncGoogleCalendar(ctx: AuthContext): Promise<{ synced: number; failed: number }> {
    return syncAllLessonsToGoogleCalendar(ctx);
  }

  async createLesson(
    ctx: AuthContext,
    input: {
      startsAt: string;
      durationMinutes?: number;
      lessonType: "individual" | "group";
      studentIds: string[];
      repeatWeekly?: boolean;
    }
  ): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const uniqueStudentIds = [...new Set(input.studentIds)].filter(Boolean);
    if (uniqueStudentIds.length === 0) {
      throw new Error("Lesson requires at least one student");
    }

    uniqueStudentIds.forEach((studentId) => mustFind(db.students, studentId, "Student"));

    const durationMinutes =
      input.durationMinutes ??
      (input.lessonType === "group" ? db.settings.groupDurationMinutes : db.settings.individualDurationMinutes);

    const startsAt = new Date(input.startsAt).toISOString();
    if (lessonOverlapsVacation(startsAt, durationMinutes, db.vacationPeriods)) {
      throw new Error("Cannot schedule a lesson during vacation");
    }
    if (
      hasExactLessonDuplicate(db, {
        startsAt,
        durationMinutes,
        lessonType: input.lessonType,
        studentIds: uniqueStudentIds
      })
    ) {
      throw new StoreValidationError("duplicate_lesson");
    }

    let recurringScheduleId: string | undefined;
    const toInsert: Lesson[] = [];

    if (input.repeatWeekly) {
      await assertCanCreateLesson(ctx.accountId, ctx.plan, { repeatWeekly: true, additionalLessonStartsAt: [] });
      const schedule = buildRecurringSchedule({
        startsAt,
        durationMinutes,
        lessonType: input.lessonType,
        studentIds: uniqueStudentIds
      });
      await insertRecurringSchedule(ctx.accountId, schedule);
      recurringScheduleId = schedule.id;
    }

    const lesson = buildLesson(db, {
      startsAt,
      durationMinutes,
      lessonType: input.lessonType,
      studentIds: uniqueStudentIds,
      recurringScheduleId
    });
    toInsert.push(lesson);

    db.lessons.push(lesson);
    const materialized = materializeRecurringLessons(db);
    toInsert.push(...materialized);

    await assertCanCreateLesson(ctx.accountId, ctx.plan, {
      additionalLessonStartsAt: toInsert
        .filter((item) => !item.recurringScheduleId)
        .map((item) => item.startsAt)
    });
    await insertLessons(ctx.accountId, toInsert);
    scheduleGoogleCalendarSync(ctx.accountId, toInsert);
    await this.syncLessonReminders(ctx.accountId, toInsert, db);
    recordActivity(ctx.accountId, "lesson.create", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lesson.id,
      metadata: {
        startsAt: lesson.startsAt,
        lessonType: lesson.effectiveType,
        studentIds: uniqueStudentIds,
        repeatWeekly: Boolean(input.repeatWeekly),
        recurringScheduleId: lesson.recurringScheduleId ?? null
      }
    });
    return lesson;
  }

  async updateLesson(
    ctx: AuthContext,
    lessonId: string,
    input: {
      startsAt?: string;
      durationMinutes?: number;
    }
  ): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    if (lesson.status === "cancelled_by_teacher") {
      throw new StoreValidationError("lesson_not_editable", "Cannot reschedule cancelled lesson");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date(lesson.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new StoreValidationError("invalid_lesson_time", "Invalid lesson start time");
    }
    const durationMinutes =
      input.durationMinutes === undefined ? lesson.durationMinutes : Math.trunc(input.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      throw new StoreValidationError("invalid_lesson_duration", "Invalid lesson duration");
    }

    const normalizedStartsAt = startsAt.toISOString();
    if (new Date(lesson.startsAt).getTime() === startsAt.getTime() && lesson.durationMinutes === durationMinutes) {
      return lesson;
    }

    if (lessonOverlapsVacation(normalizedStartsAt, durationMinutes, db.vacationPeriods)) {
      throw new Error("Cannot schedule a lesson during vacation");
    }

    if (
      hasExactLessonDuplicate(db, {
        startsAt: normalizedStartsAt,
        durationMinutes,
        lessonType: lesson.originalType,
        studentIds: lesson.participants.map((participant) => participant.studentId),
        excludeLessonId: lesson.id
      })
    ) {
      throw new StoreValidationError("duplicate_lesson");
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthEnd = new Date(currentMonthStart);
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);
    const nextTime = startsAt.getTime();
    const currentLessonTime = new Date(lesson.startsAt).getTime();
    const movesIntoCurrentMonth = nextTime >= currentMonthStart.getTime() && nextTime < currentMonthEnd.getTime();
    const currentlyCountsTowardCurrentMonth =
      !lesson.recurringScheduleId &&
      currentLessonTime >= currentMonthStart.getTime() &&
      currentLessonTime < currentMonthEnd.getTime();
    if (movesIntoCurrentMonth && !currentlyCountsTowardCurrentMonth) {
      await assertCanCreateLesson(ctx.accountId, ctx.plan, {
        additionalLessonStartsAt: [normalizedStartsAt]
      });
    }

    const schedule = lesson.recurringScheduleId ? skipRecurringOccurrence(db, lesson) : null;
    lesson.startsAt = normalizedStartsAt;
    lesson.durationMinutes = durationMinutes;
    lesson.recurringScheduleId = undefined;
    lesson.updatedAt = now();
    syncLessonCompletionWithSchedule(db, lesson);

    await Promise.all([
      replaceLesson(lesson),
      ...(schedule ? [updateRecurringScheduleRecord(schedule)] : [])
    ]);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    recordActivity(ctx.accountId, "lesson.update", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lesson.id,
      metadata: { startsAt: lesson.startsAt, durationMinutes: lesson.durationMinutes }
    });
    return lesson;
  }

  async setParticipantStatus(
    ctx: AuthContext,
    lessonId: string,
    studentId: string,
    status: ParticipantStatus,
    action?: TelegramInteraction["action"]
  ): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    const participant = lesson.participants.find((item) => item.studentId === studentId);
    if (!participant) {
      throw new Error("Student is not a participant of this lesson");
    }

    if (action) {
      assertStudentCanChangeParticipantStatus(lesson);
    } else {
      if (lesson.status === "cancelled_by_teacher") {
        throw new Error("Cannot change participant status on cancelled lesson");
      }
      assertTeacherParticipantStatus(status);
      applyTeacherParticipantStatusUpdate(db, lesson, participant, status);
      lesson.updatedAt = now();
      recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
      await replaceLesson(lesson);
      scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
      await this.syncLessonReminders(ctx.accountId, [lesson], db);
      recordActivity(ctx.accountId, "lesson.participant.status", {
        actorType: "teacher",
        entityType: "lesson",
        entityId: lessonId,
        metadata: { studentId, status }
      });
      return lesson;
    }

    participant.status = status;
    participant.hasDebt = getStudentBalance(db, studentId).remainingLessons < 1;
    lesson.updatedAt = now();

    if (action) {
      await insertTelegramInteraction(ctx.accountId, {
        id: nanoid(),
        lessonId,
        studentId,
        action,
        createdAt: now()
      });
      recordActivity(ctx.accountId, action === "attend" ? "lesson.rsvp.attend" : "lesson.rsvp.decline", {
        actorType: "student",
        actorStudentId: studentId,
        entityType: "lesson",
        entityId: lessonId,
        metadata: { studentId, status, action }
      });
    }

    recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
    await replaceLesson(lesson);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    return lesson;
  }

  async setParticipantStatusForAccount(
    accountId: string,
    lessonId: string,
    studentId: string,
    status: ParticipantStatus,
    action?: TelegramInteraction["action"]
  ): Promise<Lesson> {
    const account = await getAccountById(accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    return this.setParticipantStatus(
      { accountId, email: account.email, plan: account.plan },
      lessonId,
      studentId,
      status,
      action
    );
  }

  async addLessonParticipants(ctx: AuthContext, lessonId: string, studentIds: string[]): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    if (lesson.status === "completed") {
      throw new Error("Cannot add participant to completed lesson");
    }

    if (lesson.status === "cancelled_by_teacher") {
      throw new Error("Cannot add participant to cancelled lesson");
    }

    const uniqueStudentIds = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueStudentIds.length) {
      throw new Error("At least one student is required");
    }

    for (const studentId of uniqueStudentIds) {
      mustFind(db.students, studentId, "Student");

      if (lesson.participants.some((participant) => participant.studentId === studentId)) {
        throw new Error("Student is already a participant of this lesson");
      }

      lesson.participants.push({
        id: nanoid(),
        studentId,
        status: "awaiting",
        balanceCharged: false,
        hasDebt: getStudentBalance(db, studentId).remainingLessons < 1
      });
    }

    lesson.updatedAt = now();

    if (lesson.originalType === "individual" && lesson.participants.length >= 2) {
      lesson.originalType = "group";
    }

    recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
    await replaceLesson(lesson);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    recordActivity(ctx.accountId, "lesson.participant.add", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lessonId,
      metadata: { studentIds: uniqueStudentIds }
    });
    return lesson;
  }

  async addLessonParticipant(ctx: AuthContext, lessonId: string, studentId: string): Promise<Lesson> {
    return this.addLessonParticipants(ctx, lessonId, [studentId]);
  }

  async removeLessonParticipant(ctx: AuthContext, lessonId: string, studentId: string): Promise<Lesson | null> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    if (lesson.status === "completed") {
      throw new Error("Cannot remove participant from completed lesson");
    }

    if (!lesson.participants.some((participant) => participant.studentId === studentId)) {
      throw new Error("Student is not a participant of this lesson");
    }

    lesson.participants = lesson.participants.filter((participant) => participant.studentId !== studentId);

    if (!lesson.participants.length) {
      await this.purgeLesson(ctx.accountId, db, lesson);
      recordActivity(ctx.accountId, "lesson.participant.remove", {
        actorType: "teacher",
        entityType: "lesson",
        entityId: lessonId,
        metadata: { studentId, lessonDeleted: true }
      });
      return null;
    }

    lesson.updatedAt = now();
    recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
    await replaceLesson(lesson);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    recordActivity(ctx.accountId, "lesson.participant.remove", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lessonId,
      metadata: { studentId }
    });
    return lesson;
  }

  async completeLesson(ctx: AuthContext, lessonId: string): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    applyLessonCompletionCharges(db, lesson);

    lesson.status = "completed";
    lesson.updatedAt = now();
    recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
    await replaceLesson(lesson);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    recordActivity(ctx.accountId, "lesson.complete", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lessonId
    });
    return lesson;
  }

  async cancelLesson(ctx: AuthContext, lessonId: string): Promise<Lesson> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    lesson.status = "cancelled_by_teacher";
    lesson.participants.forEach((participant) => {
      if (participant.status === "awaiting" || participant.status === "confirmed") {
        participant.status = "declined";
      }
    });
    lesson.updatedAt = now();
    await replaceLesson(lesson);
    scheduleGoogleCalendarSync(ctx.accountId, [lesson]);
    await this.syncLessonReminders(ctx.accountId, [lesson], db);
    recordActivity(ctx.accountId, "lesson.cancel", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lessonId
    });
    return lesson;
  }

  async deleteLesson(ctx: AuthContext, lessonId: string, scope: RecurringDeleteScope = "single"): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    if (!lesson.recurringScheduleId) {
      await removeLessonFromGoogleCalendar(ctx.accountId, lesson);
      await deleteLessonsByIds([lessonId]);
      recordActivity(ctx.accountId, "lesson.delete", {
        actorType: "teacher",
        entityType: "lesson",
        entityId: lessonId,
        metadata: { scope: "single" }
      });
      return;
    }

    const schedule = mustFind(db.recurringSchedules, lesson.recurringScheduleId, "RecurringSchedule");
    const lessonTime = new Date(lesson.startsAt).getTime();

    if (scope === "single") {
      await this.purgeLesson(ctx.accountId, db, lesson);
      recordActivity(ctx.accountId, "lesson.delete", {
        actorType: "teacher",
        entityType: "lesson",
        entityId: lessonId,
        metadata: { scope: "single", recurringScheduleId: schedule.id }
      });
      return;
    }

    if (scope === "following") {
      const activeTo = new Date(lesson.startsAt);
      activeTo.setMilliseconds(activeTo.getMilliseconds() - 1);
      schedule.activeTo = activeTo.toISOString();
      schedule.updatedAt = now();
      await updateRecurringScheduleRecord(schedule);

      const lessonsToRemove = db.lessons.filter(
        (item) => item.recurringScheduleId === schedule.id && new Date(item.startsAt).getTime() >= lessonTime
      );
      for (const item of lessonsToRemove) {
        await removeLessonFromGoogleCalendar(ctx.accountId, item);
      }
      await deleteLessonsByIds(lessonsToRemove.map((item) => item.id));
      recordActivity(ctx.accountId, "lesson.delete", {
        actorType: "teacher",
        entityType: "lesson",
        entityId: lessonId,
        metadata: { scope: "following", recurringScheduleId: schedule.id, deletedCount: lessonsToRemove.length }
      });
      return;
    }

    const lessonsToRemove = db.lessons.filter((item) => item.recurringScheduleId === schedule.id);
    for (const item of lessonsToRemove) {
      await removeLessonFromGoogleCalendar(ctx.accountId, item);
    }
    await deleteLessonsByIds(lessonsToRemove.map((item) => item.id));
    await deleteRecurringScheduleRecord(schedule.id);
    recordActivity(ctx.accountId, "lesson.delete", {
      actorType: "teacher",
      entityType: "lesson",
      entityId: lessonId,
      metadata: { scope: "all", recurringScheduleId: schedule.id, deletedCount: lessonsToRemove.length }
    });
  }

  async createPayment(
    ctx: AuthContext,
    input: {
      studentId: string;
      amount?: number;
      currency?: string;
      paidAt?: string;
      method: PaymentMethod;
      packageId?: string;
      lessonCount?: number;
    }
  ): Promise<Payment> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.students, input.studentId, "Student");

    const lessonPackage = input.packageId
      ? mustFind(db.lessonPackages, input.packageId, "LessonPackage")
      : undefined;

    if (!lessonPackage) {
      if (
        input.lessonCount === undefined ||
        input.lessonCount === null ||
        input.amount === undefined ||
        input.amount === null
      ) {
        throw new Error("Lesson count and amount are required when no package is selected");
      }
    }

    const lessonCount = lessonPackage?.lessonCount ?? Math.max(1, Math.trunc(input.lessonCount ?? 1));
    const currency = lessonPackage?.currency ?? input.currency ?? db.settings.currency;
    if (!isSupportedCurrency(currency)) {
      throw new Error("Unsupported currency");
    }
    const amount =
      lessonPackage?.price ??
      input.amount ??
      db.students.find((student) => student.id === input.studentId)!.defaultLessonPrice * lessonCount;

    const payment: Payment = {
      id: nanoid(),
      studentId: input.studentId,
      amount,
      currency,
      paidAt: input.paidAt ? new Date(input.paidAt).toISOString() : now(),
      method: input.method,
      packageId: lessonPackage?.id,
      lessonCount,
      createdAt: now()
    };

    await insertPayment(ctx.accountId, payment);

    const balance = getStudentBalance({ ...db, payments: [...db.payments, payment] }, input.studentId);
    refreshParticipantDebtFlags({ ...db, payments: [...db.payments, payment] }, input.studentId, balance);
    const flags = collectParticipantDebtFlagUpdates({ ...db, payments: [...db.payments, payment] }, input.studentId);
    await replaceParticipantDebtFlags(flags);
    await Promise.all(
      db.lessons
        .filter((lesson) => lesson.participants.some((participant) => participant.studentId === input.studentId))
        .map((lesson) => replaceLesson(lesson))
    );

    recordActivity(ctx.accountId, "payment.create", {
      actorType: "teacher",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        studentId: payment.studentId,
        amount: payment.amount,
        currency: payment.currency,
        lessonCount: payment.lessonCount,
        method: payment.method,
        packageId: payment.packageId ?? null
      }
    });
    return payment;
  }

  async deletePayment(ctx: AuthContext, paymentId: string): Promise<void> {
    const db = await loadAccountDatabase(ctx.accountId);
    const payment = mustFind(db.payments, paymentId, "Payment");
    const studentId = payment.studentId;

    await deletePaymentRecord(payment.id);

    const updatedPayments = db.payments.filter((item) => item.id !== paymentId);
    const updatedDb = { ...db, payments: updatedPayments };
    const balance = getStudentBalance(updatedDb, studentId);
    refreshParticipantDebtFlags(updatedDb, studentId, balance);
    const flags = collectParticipantDebtFlagUpdates(updatedDb, studentId);
    await replaceParticipantDebtFlags(flags);
    await Promise.all(
      db.lessons
        .filter((lesson) => lesson.participants.some((participant) => participant.studentId === studentId))
        .map((lesson) => replaceLesson(lesson))
    );
    recordActivity(ctx.accountId, "payment.delete", {
      actorType: "teacher",
      entityType: "payment",
      entityId: paymentId,
      metadata: { studentId }
    });
  }

  async createAdjustment(
    ctx: AuthContext,
    input: { studentId: string; lessonDelta: number; reason: string }
  ): Promise<BalanceAdjustment> {
    const db = await loadAccountDatabase(ctx.accountId);
    mustFind(db.students, input.studentId, "Student");
    const adjustment: BalanceAdjustment = {
      id: nanoid(),
      studentId: input.studentId,
      lessonDelta: Math.trunc(input.lessonDelta),
      reason: input.reason.trim(),
      createdAt: now()
    };
    await insertBalanceAdjustment(ctx.accountId, adjustment);

    const updatedDb = {
      ...db,
      balanceAdjustments: [...db.balanceAdjustments, adjustment]
    };
    const balance = getStudentBalance(updatedDb, input.studentId);
    refreshParticipantDebtFlags(updatedDb, input.studentId, balance);
    const flags = collectParticipantDebtFlagUpdates(updatedDb, input.studentId);
    await replaceParticipantDebtFlags(flags);
    await Promise.all(
      db.lessons
        .filter((lesson) => lesson.participants.some((participant) => participant.studentId === input.studentId))
        .map((lesson) => replaceLesson(lesson))
    );

    recordActivity(ctx.accountId, "balance.adjust", {
      actorType: "teacher",
      entityType: "balance_adjustment",
      entityId: adjustment.id,
      metadata: {
        studentId: adjustment.studentId,
        lessonDelta: adjustment.lessonDelta,
        reason: adjustment.reason
      }
    });
    return adjustment;
  }

  async syncLessonReminders(accountId: string, lessons: Lesson[], dbInput?: Database): Promise<void> {
    if (!lessons.length) {
      return;
    }

    const db = dbInput ?? (await loadAccountDatabase(accountId));
    const studentsById = new Map(db.students.map((student) => [student.id, student]));

    for (const lesson of lessons) {
      const desired = desiredLessonReminders({
        lesson,
        studentsById,
        settings: db.settings
      });
      const actions = planLessonReminderSync({
        existing: db.reminders,
        desired,
        lessonId: lesson.id
      });

      for (const action of actions) {
        if (action.type === "insert") {
          const created: Reminder = {
            id: nanoid(),
            type: "lesson",
            lessonId: action.desired.lessonId,
            studentId: action.desired.studentId,
            scheduledFor: action.desired.scheduledFor,
            status: "pending",
            leadMinutes: action.desired.leadMinutes,
            createdAt: now()
          };
          await insertReminder(accountId, created);
          db.reminders.push(created);
          continue;
        }

        const reminder = db.reminders.find((item) => item.id === action.reminderId);
        if (!reminder) {
          continue;
        }

        if (action.type === "skip") {
          reminder.status = "skipped";
          reminder.claimedAt = undefined;
          reminder.error = undefined;
          await updateReminderRecord(reminder);
          continue;
        }

        reminder.scheduledFor = action.desired.scheduledFor;
        reminder.leadMinutes = action.desired.leadMinutes;
        reminder.claimedAt = undefined;
        if (action.reArm) {
          reminder.status = "pending";
          reminder.sentAt = undefined;
          reminder.error = undefined;
        }
        await updateReminderRecord(reminder);
      }
    }
  }

  async syncStudentLessonReminders(accountId: string, studentId: string, dbInput?: Database): Promise<void> {
    const db = dbInput ?? (await loadAccountDatabase(accountId));
    const lessons = db.lessons.filter((lesson) =>
      lesson.participants.some((participant) => participant.studentId === studentId)
    );
    await this.syncLessonReminders(accountId, lessons, db);
  }

  async backfillLessonReminders(): Promise<{ accounts: number; lessons: number }> {
    const accountIds = await listAccountIds();
    let lessons = 0;

    for (const accountId of accountIds) {
      const db = await loadAccountDatabase(accountId);
      const created = materializeRecurringLessons(db);
      if (created.length) {
        await insertLessons(accountId, created);
        db.lessons.push(...created);
      }
      await this.syncLessonReminders(accountId, db.lessons, db);
      lessons += db.lessons.length;
    }

    return { accounts: accountIds.length, lessons };
  }

  async claimDueLessonReminders(limit = 50): Promise<ClaimedLessonReminder[]> {
    const claimedRows = await claimPendingLessonReminderRows(limit);
    const payloads: ClaimedLessonReminder[] = [];
    const dbByAccount = new Map<string, Database>();

    for (const reminder of claimedRows) {
      if (!reminder.lessonId || !reminder.studentId) {
        await this.updateReminder(reminder.accountId, reminder.id, {
          status: "skipped",
          error: "Reminder missing lesson or student"
        });
        continue;
      }

      let db = dbByAccount.get(reminder.accountId);
      if (!db) {
        db = await loadAccountDatabase(reminder.accountId);
        dbByAccount.set(reminder.accountId, db);
      }

      const lesson = db.lessons.find((item) => item.id === reminder.lessonId);
      const student = db.students.find((item) => item.id === reminder.studentId);
      const leadMinutes = reminder.leadMinutes;

      if (!lesson || !student || leadMinutes == null || !isLessonReminderStillValid({ lesson, studentId: student.id })) {
        await this.updateReminder(reminder.accountId, reminder.id, {
          status: "skipped",
          error: "Reminder no longer valid",
          ...(leadMinutes != null ? { leadMinutes } : {}),
          telegramChatId: student?.telegramChatId ?? null
        });
        continue;
      }

      payloads.push({
        reminderId: reminder.id,
        accountId: reminder.accountId,
        leadMinutes,
        scheduledFor: reminder.scheduledFor,
        timeZone: resolveNotificationTimeZone({
          studentTimeZone: student.timezone,
          teacherTimeZone: db.settings.timezone
        }),
        student: {
          id: student.id,
          fullName: student.fullName,
          telegramChatId: student.telegramChatId
        },
        lesson: {
          id: lesson.id,
          startsAt: lesson.startsAt,
          durationMinutes: lesson.durationMinutes,
          effectiveType: lesson.effectiveType,
          participants: lesson.participants
        }
      });
    }

    const { deliver, skip } = coalesceLessonReminderDeliveries(payloads);
    for (const item of skip) {
      await this.updateReminder(item.accountId, item.reminderId, {
        status: "skipped",
        error: "Superseded by closer lesson reminder",
        leadMinutes: item.leadMinutes,
        telegramChatId: item.student.telegramChatId ?? null
      });
    }

    return deliver;
  }

  async getPaymentReminderContext(studentId: string): Promise<PaymentReminderContext> {
    const linked = await findStudentById(studentId);
    if (!linked) {
      throw new Error("Student not found");
    }

    const db = await loadAccountDatabase(linked.accountId);
    const student = mustFind(db.students, studentId, "Student");
    const balance = getStudentBalance(db, studentId);

    return {
      accountId: linked.accountId,
      student,
      balance: {
        studentId: balance.studentId,
        remainingLessons: balance.remainingLessons,
        debtLessons: balance.debtLessons
      }
    };
  }

  async upsertReminder(accountId: string, reminder: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
    const db = await loadAccountDatabase(accountId);
    const existing = findExistingReminder(db.reminders, reminder);
    if (existing) {
      return existing;
    }

    const created: Reminder = {
      ...reminder,
      id: nanoid(),
      createdAt: now()
    };
    await insertReminder(accountId, created);
    return created;
  }

  async updateReminder(accountId: string, id: string, patch: ReminderUpdatePatch): Promise<Reminder> {
    const db = await loadAccountDatabase(accountId);
    const reminder = mustFind(db.reminders, id, "Reminder");
    const { telegramChatId, leadMinutes, ...reminderPatch } = patch;
    Object.assign(reminder, reminderPatch);
    if (leadMinutes !== undefined) {
      reminder.leadMinutes = leadMinutes ?? undefined;
    }
    if (reminder.status === "sent" || reminder.status === "failed" || reminder.status === "skipped") {
      reminder.claimedAt = undefined;
    }
    await updateReminderRecord(reminder);

    if (reminder.status === "sent" || reminder.status === "failed" || reminder.status === "skipped") {
      const deliveryType = reminder.type === "payment" ? "payment_reminder" : "lesson_reminder";
      await insertNotificationDelivery({
        accountId,
        studentId: reminder.studentId,
        lessonId: reminder.lessonId,
        reminderId: reminder.id,
        channel: "telegram",
        type: deliveryType,
        status: reminder.status,
        leadMinutes:
          deliveryType === "lesson_reminder" ? (leadMinutes ?? reminder.leadMinutes ?? null) : null,
        telegramChatId: telegramChatId ?? null,
        error: reminder.error ?? null
      });

      if (deliveryType === "payment_reminder" && reminder.status === "sent") {
        recordActivity(accountId, "payment.reminder.send", {
          actorType: "teacher",
          entityType: "student",
          entityId: reminder.studentId ?? null,
          metadata: { reminderId: reminder.id, studentId: reminder.studentId ?? null }
        });
      }
    }

    return reminder;
  }

  async getBalances(ctx: AuthContext): Promise<StudentBalance[]> {
    const db = await loadAccountDatabase(ctx.accountId);
    return db.students.map((student) => getStudentBalance(db, student.id));
  }

  async getDashboard(ctx: AuthContext) {
    const db = await this.getSnapshot(ctx);
    const balances = db.students.map((student) => ({
      student,
      balance: getStudentBalance(db, student.id)
    }));

    const upcomingLessons = db.lessons
      .filter((lesson) => new Date(lesson.startsAt).getTime() >= Date.now() && lesson.status !== "cancelled_by_teacher")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 10);

    return {
      upcomingLessons,
      debtors: balances.filter((item) => item.balance.debtLessons > 0),
      studentsCount: db.students.filter((student) => student.status === "active").length,
      lessonsCount: db.lessons.length
    };
  }

  calculateBalanceFor(db: Database, studentId: string): StudentBalance {
    return getStudentBalance(db, studentId);
  }
}

function findExistingReminder(
  reminders: Reminder[],
  candidate: Omit<Reminder, "id" | "createdAt">
): Reminder | undefined {
  if (candidate.type === "lesson") {
    return reminders.find(
      (item) =>
        item.type === "lesson" &&
        item.lessonId === candidate.lessonId &&
        item.studentId === candidate.studentId &&
        item.leadMinutes === candidate.leadMinutes
    );
  }

  if (candidate.type === "payment") {
    const day = utcDateKey(candidate.scheduledFor);
    return reminders.find(
      (item) =>
        item.type === "payment" &&
        item.studentId === candidate.studentId &&
        utcDateKey(item.scheduledFor) === day
    );
  }

  return undefined;
}

export const store = new Store();
