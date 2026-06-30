import { nanoid } from "nanoid";
import type {
  AppSettings,
  Database,
  Lesson,
  LessonParticipant,
  LessonStatus,
  ParticipantStatus,
  RecurringSchedule,
  Student,
  StudentBalance
} from "@crm/shared";

export const RECURRING_HORIZON_WEEKS = 52;

export const now = () => new Date().toISOString();

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

export function createDefaultSettings(): AppSettings {
  return {
    lessonReminderMinutes: parseReminderMinutes(process.env.LESSON_REMINDER_MINUTES),
    individualDurationMinutes: 60,
    groupDurationMinutes: 90,
    defaultSingleLessonPrice: 3000,
    currency: "BYN",
    cancellationPolicy: "free"
  };
}

export function optional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isStudentTelegramLinked(student: Student): boolean {
  return Boolean(student.telegramUserId ?? student.telegramChatId);
}

export function findStudentByTelegramUser(students: Student[], userId: string | number): Student | undefined {
  const id = String(userId);
  const byUserId = students.find((item) => item.telegramUserId === id);
  if (byUserId) {
    return byUserId;
  }

  return students.find((item) => !item.telegramUserId && item.telegramChatId === id);
}

export function mustFind<T extends { id: string }>(items: T[], id: string, entityName: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`${entityName} not found`);
  }
  return item;
}

export function createTelegramBindToken(db: Database): string {
  const existingTokens = new Set(db.students.map((student) => student.telegramBindToken).filter(Boolean));
  let token = nanoid();

  while (existingTokens.has(token)) {
    token = nanoid();
  }

  return token;
}

export function recalculateLesson(
  lesson: Lesson,
  individualDurationMinutes: number,
  groupDurationMinutes: number
): Lesson {
  if (lesson.status === "cancelled_by_teacher" || lesson.status === "completed") {
    return lesson;
  }

  const activeParticipants = lesson.participants.filter((participant) =>
    ["awaiting", "confirmed", "attended"].includes(participant.status)
  );
  const confirmedParticipants = lesson.participants.filter((participant) => participant.status === "confirmed");

  if (activeParticipants.length >= 2 && lesson.originalType === "individual") {
    lesson.originalType = "group";
  }

  const shouldBeIndividual =
    lesson.originalType === "group" &&
    activeParticipants.length === 1 &&
    confirmedParticipants.length === 1;

  if (shouldBeIndividual) {
    lesson.effectiveType = "individual";
    lesson.durationMinutes = individualDurationMinutes;
  } else {
    lesson.effectiveType = lesson.originalType;
    lesson.durationMinutes =
      lesson.originalType === "group" ? groupDurationMinutes : individualDurationMinutes;
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

export function getStudentBalance(db: Database, studentId: string): StudentBalance {
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

export function refreshParticipantDebtFlags(db: Database, studentId: string, balance: StudentBalance): void {
  for (const lesson of db.lessons) {
    for (const participant of lesson.participants) {
      if (participant.studentId === studentId && !participant.balanceCharged) {
        participant.hasDebt = balance.remainingLessons < 1;
      }
    }
  }
}

export function buildLesson(
  db: Database,
  input: {
    startsAt: string;
    durationMinutes?: number;
    lessonType: "individual" | "group";
    studentIds: string[];
    recurringScheduleId?: string;
  }
): Lesson {
  const timestamp = now();
  const participants: LessonParticipant[] = input.studentIds.map((studentId) => ({
    id: nanoid(),
    studentId,
    status: "awaiting",
    balanceCharged: false,
    hasDebt: getStudentBalance(db, studentId).remainingLessons < 1
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
    recurringScheduleId: input.recurringScheduleId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return recalculateLesson(
    lesson,
    db.settings.individualDurationMinutes,
    db.settings.groupDurationMinutes
  );
}

export function hasRecurringLesson(db: Database, scheduleId: string, startsAt: string): boolean {
  const target = new Date(startsAt).getTime();
  return db.lessons.some(
    (lesson) => lesson.recurringScheduleId === scheduleId && new Date(lesson.startsAt).getTime() === target
  );
}

export function addWeeks(value: Date, weeks: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

export function formatScheduleTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function normalizeInstant(value: string): string {
  return new Date(value).toISOString();
}

export function isSameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

export function isOccurrenceSkipped(schedule: RecurringSchedule, startsAt: string): boolean {
  return (schedule.skippedOccurrences ?? []).some((item) => isSameInstant(item, startsAt));
}

export function skipRecurringOccurrence(db: Database, lesson: Lesson): RecurringSchedule | null {
  if (!lesson.recurringScheduleId) {
    return null;
  }

  const schedule = db.recurringSchedules.find((item) => item.id === lesson.recurringScheduleId);
  if (!schedule) {
    return null;
  }

  const normalizedStartsAt = normalizeInstant(lesson.startsAt);
  if (isOccurrenceSkipped(schedule, normalizedStartsAt)) {
    return schedule;
  }

  schedule.skippedOccurrences = [...(schedule.skippedOccurrences ?? []), normalizedStartsAt];
  schedule.updatedAt = now();
  return schedule;
}

export function materializeRecurringLessons(db: Database): Lesson[] {
  const created: Lesson[] = [];
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + RECURRING_HORIZON_WEEKS * 7);

  for (const schedule of db.recurringSchedules) {
    const activeToTime = schedule.activeTo ? new Date(schedule.activeTo).getTime() : undefined;
    const skipped = new Set((schedule.skippedOccurrences ?? []).map((item) => new Date(item).getTime()));
    let occurrence = new Date(schedule.activeFrom);

    while (occurrence.getTime() <= horizonEnd.getTime()) {
      if (activeToTime !== undefined && occurrence.getTime() > activeToTime) {
        break;
      }

      const startsAt = normalizeInstant(occurrence.toISOString());

      if (!skipped.has(new Date(startsAt).getTime()) && !hasRecurringLesson(db, schedule.id, startsAt)) {
        const lesson = buildLesson(db, {
          startsAt,
          durationMinutes: schedule.durationMinutes,
          lessonType: schedule.lessonType,
          studentIds: schedule.studentIds,
          recurringScheduleId: schedule.id
        });
        db.lessons.push(lesson);
        created.push(lesson);
      }

      occurrence = addWeeks(occurrence, 1);
    }
  }

  return created;
}

export function buildRecurringSchedule(input: {
  startsAt: string;
  durationMinutes: number;
  lessonType: "individual" | "group";
  studentIds: string[];
}): RecurringSchedule {
  const timestamp = now();
  const startDate = new Date(input.startsAt);
  return {
    id: nanoid(),
    weekday: startDate.getDay(),
    time: formatScheduleTime(startDate),
    durationMinutes: input.durationMinutes,
    lessonType: input.lessonType,
    studentIds: input.studentIds,
    activeFrom: new Date(input.startsAt).toISOString(),
    skippedOccurrences: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
