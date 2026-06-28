import { nanoid } from "nanoid";
import type {
  AppSettings,
  BalanceAdjustment,
  Database,
  Lesson,
  LessonPackage,
  ParticipantStatus,
  Payment,
  PaymentMethod,
  RecurringDeleteScope,
  Reminder,
  Student,
  StudentBalance,
  TelegramInteraction
} from "@crm/shared";
import { isSupportedCurrency } from "@crm/shared/currency";
import {
  deleteLessonsByIds,
  deleteLessonPackageRecord,
  deleteRecurringScheduleRecord,
  deleteStudentRecords,
  ensureDefaults,
  insertBalanceAdjustment,
  insertLessonPackage,
  insertLessons,
  insertPayment,
  insertRecurringSchedule,
  insertReminder,
  insertStudent,
  insertTelegramInteraction,
  loadDatabase,
  replaceLesson,
  replaceParticipantDebtFlags,
  updateRecurringScheduleRecord,
  updateReminderRecord,
  updateStudentRecord,
  updateAppSettings
} from "./db/repository";
import {
  buildLesson,
  buildRecurringSchedule,
  createTelegramBindToken,
  getStudentBalance,
  materializeRecurringLessons,
  mustFind,
  now,
  optional,
  parseReminderMinutes,
  recalculateLesson,
  refreshParticipantDebtFlags
} from "./store-logic";

export { parseReminderMinutes };

export class Store {
  async initialize(): Promise<void> {
    await ensureDefaults();
  }

  async getSnapshot(): Promise<Database> {
    const db = await loadDatabase();
    const created = materializeRecurringLessons(db);
    if (created.length) {
      await insertLessons(created);
    }
    return structuredClone(db);
  }

  async createStudent(input: {
    fullName: string;
    telegramUsername?: string;
    telegramChatId?: string;
    defaultLessonPrice?: number;
  }): Promise<Student> {
    const db = await loadDatabase();
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
    await insertStudent(student);
    return student;
  }

  async bindTelegramChat(token: string, chatId: number | string, username?: string): Promise<Student> {
    const db = await loadDatabase();
    const student = db.students.find((item) => item.telegramBindToken === token);
    if (!student) {
      throw new Error("Telegram binding token is invalid");
    }

    student.telegramChatId = String(chatId);
    student.telegramUsername = optional(username) ?? student.telegramUsername;
    student.updatedAt = now();
    await updateStudentRecord(student);
    return student;
  }

  async updateStudent(id: string, input: Partial<Omit<Student, "id" | "createdAt">>): Promise<Student> {
    const db = await loadDatabase();
    const student = mustFind(db.students, id, "Student");
    Object.assign(student, {
      ...input,
      telegramUsername: input.telegramUsername === "" ? undefined : input.telegramUsername,
      telegramChatId: input.telegramChatId === "" ? undefined : input.telegramChatId,
      updatedAt: now()
    });
    await updateStudentRecord(student);
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const db = await loadDatabase();
    mustFind(db.students, id, "Student");

    for (const lesson of db.lessons) {
      lesson.participants = lesson.participants.filter((participant) => participant.studentId !== id);
      lesson.updatedAt = now();
      recalculateLesson(lesson, db.settings.individualDurationMinutes);
    }

    const emptyLessons = db.lessons.filter((lesson) => lesson.participants.length === 0).map((lesson) => lesson.id);
    const updatedLessons = db.lessons.filter((lesson) => lesson.participants.length > 0);

    await Promise.all([
      deleteStudentRecords(id),
      deleteLessonsByIds(emptyLessons),
      ...updatedLessons.map((lesson) => replaceLesson(lesson))
    ]);
  }

  async createLessonPackage(input: { name: string; lessonCount: number; price: number }): Promise<LessonPackage> {
    const timestamp = now();
    const lessonPackage: LessonPackage = {
      id: nanoid(),
      name: input.name.trim(),
      lessonCount: Math.max(1, Math.trunc(input.lessonCount)),
      price: Math.max(0, input.price),
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await insertLessonPackage(lessonPackage);
    return lessonPackage;
  }

  async deleteLessonPackage(id: string): Promise<void> {
    const db = await loadDatabase();
    mustFind(db.lessonPackages, id, "LessonPackage");
    await deleteLessonPackageRecord(id);
  }

  async updateSettings(input: Partial<Pick<AppSettings, "currency">>): Promise<AppSettings> {
    const db = await loadDatabase();
    if (input.currency !== undefined && !isSupportedCurrency(input.currency)) {
      throw new Error("Unsupported currency");
    }

    const settings: AppSettings = {
      ...db.settings,
      ...input
    };
    await updateAppSettings(settings);
    return settings;
  }

  async createLesson(input: {
    startsAt: string;
    durationMinutes?: number;
    lessonType: "individual" | "group";
    studentIds: string[];
    repeatWeekly?: boolean;
  }): Promise<Lesson> {
    const db = await loadDatabase();
    const uniqueStudentIds = [...new Set(input.studentIds)].filter(Boolean);
    if (uniqueStudentIds.length === 0) {
      throw new Error("Lesson requires at least one student");
    }

    uniqueStudentIds.forEach((studentId) => mustFind(db.students, studentId, "Student"));

    const startsAt = new Date(input.startsAt).toISOString();
    const durationMinutes =
      input.durationMinutes ??
      (input.lessonType === "group" ? db.settings.groupDurationMinutes : db.settings.individualDurationMinutes);

    let recurringScheduleId: string | undefined;
    const toInsert: Lesson[] = [];

    if (input.repeatWeekly) {
      const schedule = buildRecurringSchedule({
        startsAt,
        durationMinutes,
        lessonType: input.lessonType,
        studentIds: uniqueStudentIds
      });
      await insertRecurringSchedule(schedule);
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
    toInsert.push(...materializeRecurringLessons(db));

    await insertLessons(toInsert);
    return lesson;
  }

  async setParticipantStatus(
    lessonId: string,
    studentId: string,
    status: ParticipantStatus,
    action?: TelegramInteraction["action"]
  ): Promise<Lesson> {
    const db = await loadDatabase();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    const participant = lesson.participants.find((item) => item.studentId === studentId);
    if (!participant) {
      throw new Error("Student is not a participant of this lesson");
    }

    participant.status = status;
    participant.hasDebt = getStudentBalance(db, studentId).remainingLessons < 1;
    lesson.updatedAt = now();

    if (action) {
      await insertTelegramInteraction({
        id: nanoid(),
        lessonId,
        studentId,
        action,
        createdAt: now()
      });
    }

    recalculateLesson(lesson, db.settings.individualDurationMinutes);
    await replaceLesson(lesson);
    return lesson;
  }

  async completeLesson(lessonId: string): Promise<Lesson> {
    const db = await loadDatabase();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    for (const participant of lesson.participants) {
      if (participant.status === "confirmed" || participant.status === "awaiting") {
        participant.status = "attended";
      }

      const shouldCharge =
        participant.status === "attended" ||
        participant.status === "missed" ||
        (participant.status === "declined" && db.settings.cancellationPolicy === "paid");

      if (shouldCharge && !participant.balanceCharged) {
        participant.balanceCharged = true;
      }

      participant.hasDebt = getStudentBalance(db, participant.studentId).remainingLessons < 0;
    }

    lesson.status = "completed";
    lesson.updatedAt = now();
    recalculateLesson(lesson, db.settings.individualDurationMinutes);
    await replaceLesson(lesson);
    return lesson;
  }

  async cancelLesson(lessonId: string): Promise<Lesson> {
    const db = await loadDatabase();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    lesson.status = "cancelled_by_teacher";
    lesson.participants.forEach((participant) => {
      if (participant.status === "awaiting" || participant.status === "confirmed") {
        participant.status = "declined";
      }
    });
    lesson.updatedAt = now();
    await replaceLesson(lesson);
    return lesson;
  }

  async deleteLesson(lessonId: string, scope: RecurringDeleteScope = "single"): Promise<void> {
    const db = await loadDatabase();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");

    if (!lesson.recurringScheduleId) {
      await deleteLessonsByIds([lessonId]);
      return;
    }

    const schedule = mustFind(db.recurringSchedules, lesson.recurringScheduleId, "RecurringSchedule");
    const lessonTime = new Date(lesson.startsAt).getTime();

    if (scope === "single") {
      schedule.skippedOccurrences = [...(schedule.skippedOccurrences ?? []), lesson.startsAt];
      schedule.updatedAt = now();
      await updateRecurringScheduleRecord(schedule);
      await deleteLessonsByIds([lessonId]);
      return;
    }

    if (scope === "following") {
      const activeTo = new Date(lesson.startsAt);
      activeTo.setMilliseconds(activeTo.getMilliseconds() - 1);
      schedule.activeTo = activeTo.toISOString();
      schedule.updatedAt = now();
      await updateRecurringScheduleRecord(schedule);

      const lessonIds = db.lessons
        .filter(
          (item) =>
            item.recurringScheduleId === schedule.id && new Date(item.startsAt).getTime() >= lessonTime
        )
        .map((item) => item.id);
      await deleteLessonsByIds(lessonIds);
      return;
    }

    const lessonIds = db.lessons
      .filter((item) => item.recurringScheduleId === schedule.id)
      .map((item) => item.id);
    await deleteLessonsByIds(lessonIds);
    await deleteRecurringScheduleRecord(schedule.id);
  }

  async createPayment(input: {
    studentId: string;
    amount?: number;
    paidAt?: string;
    method: PaymentMethod;
    packageId?: string;
    lessonCount?: number;
  }): Promise<Payment> {
    const db = await loadDatabase();
    mustFind(db.students, input.studentId, "Student");

    const lessonPackage = input.packageId
      ? mustFind(db.lessonPackages, input.packageId, "LessonPackage")
      : undefined;

    const lessonCount = lessonPackage?.lessonCount ?? Math.max(1, Math.trunc(input.lessonCount ?? 1));
    const amount =
      input.amount ??
      lessonPackage?.price ??
      db.students.find((student) => student.id === input.studentId)!.defaultLessonPrice * lessonCount;

    const payment: Payment = {
      id: nanoid(),
      studentId: input.studentId,
      amount,
      paidAt: input.paidAt ? new Date(input.paidAt).toISOString() : now(),
      method: input.method,
      packageId: lessonPackage?.id,
      lessonCount,
      createdAt: now()
    };

    await insertPayment(payment);

    const balance = getStudentBalance({ ...db, payments: [...db.payments, payment] }, input.studentId);
    refreshParticipantDebtFlags(db, input.studentId, balance);
    const flags = db.lessons.flatMap((lesson) =>
      lesson.participants
        .filter((participant) => participant.studentId === input.studentId && !participant.balanceCharged)
        .map((participant) => ({
          lessonId: lesson.id,
          participantId: participant.id,
          hasDebt: participant.hasDebt
        }))
    );
    await replaceParticipantDebtFlags(input.studentId, flags);
    await Promise.all(
      db.lessons
        .filter((lesson) => lesson.participants.some((participant) => participant.studentId === input.studentId))
        .map((lesson) => replaceLesson(lesson))
    );

    return payment;
  }

  async createAdjustment(input: { studentId: string; lessonDelta: number; reason: string }): Promise<BalanceAdjustment> {
    const db = await loadDatabase();
    mustFind(db.students, input.studentId, "Student");
    const adjustment: BalanceAdjustment = {
      id: nanoid(),
      studentId: input.studentId,
      lessonDelta: Math.trunc(input.lessonDelta),
      reason: input.reason.trim(),
      createdAt: now()
    };
    await insertBalanceAdjustment(adjustment);

    const balance = getStudentBalance(
      { ...db, balanceAdjustments: [...db.balanceAdjustments, adjustment] },
      input.studentId
    );
    refreshParticipantDebtFlags(db, input.studentId, balance);
    const flags = db.lessons.flatMap((lesson) =>
      lesson.participants
        .filter((participant) => participant.studentId === input.studentId && !participant.balanceCharged)
        .map((participant) => ({
          lessonId: lesson.id,
          participantId: participant.id,
          hasDebt: participant.hasDebt
        }))
    );
    await replaceParticipantDebtFlags(input.studentId, flags);
    await Promise.all(
      db.lessons
        .filter((lesson) => lesson.participants.some((participant) => participant.studentId === input.studentId))
        .map((lesson) => replaceLesson(lesson))
    );

    return adjustment;
  }

  async upsertReminder(reminder: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
    const db = await loadDatabase();
    const existing = db.reminders.find((item) => item.dedupeKey === reminder.dedupeKey);
    if (existing) {
      return existing;
    }

    const created: Reminder = {
      ...reminder,
      id: nanoid(),
      createdAt: now()
    };
    await insertReminder(created);
    return created;
  }

  async updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
    const db = await loadDatabase();
    const reminder = mustFind(db.reminders, id, "Reminder");
    Object.assign(reminder, patch);
    await updateReminderRecord(reminder);
    return reminder;
  }

  async getBalances(): Promise<StudentBalance[]> {
    const db = await loadDatabase();
    return db.students.map((student) => getStudentBalance(db, student.id));
  }

  async getDashboard() {
    const db = await this.getSnapshot();
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

export const store = new Store();
