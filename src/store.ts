import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import type {
  BalanceAdjustment,
  Database,
  Lesson,
  LessonPackage,
  LessonParticipant,
  LessonStatus,
  ParticipantStatus,
  Payment,
  PaymentMethod,
  Reminder,
  Student,
  StudentBalance,
  TelegramInteraction
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "db.json");

const now = () => new Date().toISOString();

const defaultDatabase = (): Database => ({
  students: [],
  lessonPackages: [
    {
      id: nanoid(),
      name: "Разовое занятие",
      lessonCount: 1,
      price: 3000,
      active: true,
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: nanoid(),
      name: "Пакет 4 занятия",
      lessonCount: 4,
      price: 11000,
      active: true,
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: nanoid(),
      name: "Пакет 8 занятий",
      lessonCount: 8,
      price: 20000,
      active: true,
      createdAt: now(),
      updatedAt: now()
    }
  ],
  lessons: [],
  recurringSchedules: [],
  payments: [],
  reminders: [],
  telegramInteractions: [],
  balanceAdjustments: [],
  settings: {
    lessonReminderMinutes: parseReminderMinutes(process.env.LESSON_REMINDER_MINUTES),
    individualDurationMinutes: 60,
    groupDurationMinutes: 90,
    defaultSingleLessonPrice: 3000,
    currency: "RUB",
    cancellationPolicy: "free"
  }
});

export function parseReminderMinutes(value?: string): number[] {
  if (!value) {
    return [1440, 120];
  }

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return parsed.length > 0 ? parsed : [1440, 120];
}

export class Store {
  private db: Database | null = null;
  private loadedMtimeMs = 0;

  async load(): Promise<Database> {
    if (this.db && !(await this.hasExternalUpdate())) {
      return this.db;
    }

    try {
      const raw = await readFile(dbPath, "utf8");
      this.db = JSON.parse(raw) as Database;
      this.loadedMtimeMs = await this.getDbMtimeMs();
    } catch {
      this.db = defaultDatabase();
      await this.save();
    }

    return this.db;
  }

  async save(): Promise<void> {
    if (!this.db) {
      return;
    }

    await mkdir(dirname(dbPath), { recursive: true });
    const tmpPath = `${dbPath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(this.db, null, 2));
    await rename(tmpPath, dbPath);
    this.loadedMtimeMs = await this.getDbMtimeMs();
  }

  async getSnapshot(): Promise<Database> {
    const db = await this.load();
    return structuredClone(db);
  }

  async createStudent(input: {
    fullName: string;
    phone: string;
    telegramUsername?: string;
    telegramChatId?: string;
    defaultLessonPrice?: number;
  }): Promise<Student> {
    const db = await this.load();
    const timestamp = now();
    const student: Student = {
      id: nanoid(),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      telegramUsername: optional(input.telegramUsername),
      telegramChatId: optional(input.telegramChatId),
      status: "active",
      defaultLessonPrice: input.defaultLessonPrice ?? db.settings.defaultSingleLessonPrice,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.students.push(student);
    await this.save();
    return student;
  }

  async updateStudent(id: string, input: Partial<Omit<Student, "id" | "createdAt">>): Promise<Student> {
    const db = await this.load();
    const student = mustFind(db.students, id, "Student");
    Object.assign(student, {
      ...input,
      telegramUsername: input.telegramUsername === "" ? undefined : input.telegramUsername,
      telegramChatId: input.telegramChatId === "" ? undefined : input.telegramChatId,
      updatedAt: now()
    });
    await this.save();
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const db = await this.load();
    mustFind(db.students, id, "Student");

    db.students = db.students.filter((student) => student.id !== id);
    db.payments = db.payments.filter((payment) => payment.studentId !== id);
    db.balanceAdjustments = db.balanceAdjustments.filter((adjustment) => adjustment.studentId !== id);
    db.reminders = db.reminders.filter((reminder) => reminder.studentId !== id);
    db.telegramInteractions = db.telegramInteractions.filter((interaction) => interaction.studentId !== id);

    db.lessons = db.lessons
      .map((lesson) => {
        lesson.participants = lesson.participants.filter((participant) => participant.studentId !== id);
        lesson.updatedAt = now();
        return recalculateLesson(lesson, db.settings.individualDurationMinutes);
      })
      .filter((lesson) => lesson.participants.length > 0);

    await this.save();
  }

  async createLessonPackage(input: { name: string; lessonCount: number; price: number }): Promise<LessonPackage> {
    const db = await this.load();
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
    db.lessonPackages.push(lessonPackage);
    await this.save();
    return lessonPackage;
  }

  async deleteLessonPackage(id: string): Promise<void> {
    const db = await this.load();
    mustFind(db.lessonPackages, id, "LessonPackage");
    db.lessonPackages = db.lessonPackages.filter((lessonPackage) => lessonPackage.id !== id);
    await this.save();
  }

  async createLesson(input: {
    startsAt: string;
    durationMinutes?: number;
    lessonType: "individual" | "group";
    studentIds: string[];
  }): Promise<Lesson> {
    const db = await this.load();
    const uniqueStudentIds = [...new Set(input.studentIds)].filter(Boolean);
    if (uniqueStudentIds.length === 0) {
      throw new Error("Lesson requires at least one student");
    }

    uniqueStudentIds.forEach((studentId) => mustFind(db.students, studentId, "Student"));

    const timestamp = now();
    const participants: LessonParticipant[] = uniqueStudentIds.map((studentId) => ({
      id: nanoid(),
      studentId,
      status: "awaiting",
      balanceCharged: false,
      hasDebt: this.calculateBalanceFor(db, studentId).remainingLessons < 1
    }));

    const lesson: Lesson = {
      id: nanoid(),
      startsAt: new Date(input.startsAt).toISOString(),
      durationMinutes:
        input.durationMinutes ??
        (input.lessonType === "group" ? db.settings.groupDurationMinutes : db.settings.individualDurationMinutes),
      originalType: input.lessonType,
      effectiveType: input.lessonType,
      status: "scheduled",
      participants,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    db.lessons.push(recalculateLesson(lesson, db.settings.individualDurationMinutes));
    await this.save();
    return lesson;
  }

  async setParticipantStatus(
    lessonId: string,
    studentId: string,
    status: ParticipantStatus,
    action?: TelegramInteraction["action"]
  ): Promise<Lesson> {
    const db = await this.load();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    const participant = lesson.participants.find((item) => item.studentId === studentId);
    if (!participant) {
      throw new Error("Student is not a participant of this lesson");
    }

    participant.status = status;
    participant.hasDebt = this.calculateBalanceFor(db, studentId).remainingLessons < 1;
    lesson.updatedAt = now();

    if (action) {
      db.telegramInteractions.push({
        id: nanoid(),
        lessonId,
        studentId,
        action,
        createdAt: now()
      });
    }

    recalculateLesson(lesson, db.settings.individualDurationMinutes);
    await this.save();
    return lesson;
  }

  async completeLesson(lessonId: string): Promise<Lesson> {
    const db = await this.load();
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

      participant.hasDebt = this.calculateBalanceFor(db, participant.studentId).remainingLessons < 0;
    }

    lesson.status = "completed";
    lesson.updatedAt = now();
    recalculateLesson(lesson, db.settings.individualDurationMinutes);
    await this.save();
    return lesson;
  }

  async cancelLesson(lessonId: string): Promise<Lesson> {
    const db = await this.load();
    const lesson = mustFind(db.lessons, lessonId, "Lesson");
    lesson.status = "cancelled_by_teacher";
    lesson.participants.forEach((participant) => {
      if (participant.status === "awaiting" || participant.status === "confirmed") {
        participant.status = "declined";
      }
    });
    lesson.updatedAt = now();
    await this.save();
    return lesson;
  }

  async deleteLesson(lessonId: string): Promise<void> {
    const db = await this.load();
    mustFind(db.lessons, lessonId, "Lesson");
    db.lessons = db.lessons.filter((lesson) => lesson.id !== lessonId);
    db.reminders = db.reminders.filter((reminder) => reminder.lessonId !== lessonId);
    db.telegramInteractions = db.telegramInteractions.filter((interaction) => interaction.lessonId !== lessonId);
    await this.save();
  }

  async createPayment(input: {
    studentId: string;
    amount?: number;
    paidAt?: string;
    method: PaymentMethod;
    packageId?: string;
    lessonCount?: number;
  }): Promise<Payment> {
    const db = await this.load();
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

    db.payments.push(payment);
    refreshParticipantDebtFlags(db, input.studentId, this.calculateBalanceFor(db, input.studentId));
    await this.save();
    return payment;
  }

  async createAdjustment(input: { studentId: string; lessonDelta: number; reason: string }): Promise<BalanceAdjustment> {
    const db = await this.load();
    mustFind(db.students, input.studentId, "Student");
    const adjustment: BalanceAdjustment = {
      id: nanoid(),
      studentId: input.studentId,
      lessonDelta: Math.trunc(input.lessonDelta),
      reason: input.reason.trim(),
      createdAt: now()
    };
    db.balanceAdjustments.push(adjustment);
    refreshParticipantDebtFlags(db, input.studentId, this.calculateBalanceFor(db, input.studentId));
    await this.save();
    return adjustment;
  }

  async upsertReminder(reminder: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
    const db = await this.load();
    const existing = db.reminders.find((item) => item.dedupeKey === reminder.dedupeKey);
    if (existing) {
      return existing;
    }

    const created: Reminder = {
      ...reminder,
      id: nanoid(),
      createdAt: now()
    };
    db.reminders.push(created);
    await this.save();
    return created;
  }

  async updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
    const db = await this.load();
    const reminder = mustFind(db.reminders, id, "Reminder");
    Object.assign(reminder, patch);
    await this.save();
    return reminder;
  }

  async getBalances(): Promise<StudentBalance[]> {
    const db = await this.load();
    return db.students.map((student) => this.calculateBalanceFor(db, student.id));
  }

  async getDashboard() {
    const db = await this.load();
    const balances = db.students.map((student) => ({
      student,
      balance: this.calculateBalanceFor(db, student.id)
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
    const paidLessons = db.payments
      .filter((payment) => payment.studentId === studentId)
      .reduce((sum, payment) => sum + payment.lessonCount, 0);

    const adjustedLessons = db.balanceAdjustments
      .filter((adjustment) => adjustment.studentId === studentId)
      .reduce((sum, adjustment) => sum + adjustment.lessonDelta, 0);

    const chargedLessons = db.lessons.reduce((sum, lesson) => {
      return (
        sum +
        lesson.participants.filter(
          (participant) => participant.studentId === studentId && participant.balanceCharged
        ).length
      );
    }, 0);

    const available = paidLessons + adjustedLessons - chargedLessons;

    return {
      studentId,
      paidLessons: paidLessons + adjustedLessons,
      chargedLessons,
      remainingLessons: Math.max(0, available),
      debtLessons: Math.max(0, -available)
    };
  }

  private async hasExternalUpdate(): Promise<boolean> {
    const mtimeMs = await this.getDbMtimeMs();
    return mtimeMs > this.loadedMtimeMs;
  }

  private async getDbMtimeMs(): Promise<number> {
    try {
      const stats = await stat(dbPath);
      return stats.mtimeMs;
    } catch {
      return 0;
    }
  }
}

function optional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function mustFind<T extends { id: string }>(items: T[], id: string, entityName: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`${entityName} not found`);
  }
  return item;
}

function recalculateLesson(lesson: Lesson, individualDurationMinutes: number): Lesson {
  if (lesson.status === "cancelled_by_teacher" || lesson.status === "completed") {
    return lesson;
  }

  const activeParticipants = lesson.participants.filter((participant) =>
    ["awaiting", "confirmed", "attended"].includes(participant.status)
  );
  const confirmedParticipants = lesson.participants.filter((participant) => participant.status === "confirmed");

  if (lesson.originalType === "group" && confirmedParticipants.length === 1) {
    lesson.effectiveType = "individual";
    lesson.durationMinutes = individualDurationMinutes;
  } else {
    lesson.effectiveType = lesson.originalType;
  }

  if (activeParticipants.length === 0) {
    lesson.status = "cancelled_by_student";
  } else if (confirmedParticipants.length > 0 && confirmedParticipants.length === activeParticipants.length) {
    lesson.status = "confirmed";
  } else {
    lesson.status = "scheduled";
  }

  return lesson;
}

function refreshParticipantDebtFlags(db: Database, studentId: string, balance: StudentBalance): void {
  for (const lesson of db.lessons) {
    for (const participant of lesson.participants) {
      if (participant.studentId === studentId && !participant.balanceCharged) {
        participant.hasDebt = balance.remainingLessons < 1;
      }
    }
  }
}

export const store = new Store();
