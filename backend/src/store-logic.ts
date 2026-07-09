import { nanoid } from "nanoid";
import type {
  AppSettings,
  Database,
  Lesson,
  LessonParticipant,
  ParticipantStatus,
  RecurringSchedule,
  Student,
  StudentBalance
} from "@crm/shared";
import {
  assertTeacherParticipantStatus,
  normalizeTeacherParticipantStatus,
  type TeacherParticipantStatus
} from "@crm/shared/lesson-attendance";
import { lessonOverlapsVacation } from "@crm/shared/vacation";

export const RECURRING_HORIZON_WEEKS = 52;

export const now = () => new Date().toISOString();

export function normalizeReminderMinutes(value: unknown, fallback?: number[]): number[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/).map((item) => Number(item.trim()))
      : [];
  const normalized = [...new Set(values.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))]
    .sort((a, b) => b - a)
    .slice(0, 8);

  if (normalized.length > 0) {
    return normalized;
  }

  return fallback ?? [1440, 120];
}

export function parseReminderMinutes(value?: string): number[] {
  return normalizeReminderMinutes(value);
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

function normalizeStudentIds(studentIds: string[]): string {
  return [...new Set(studentIds)].filter(Boolean).sort().join(",");
}

export function hasExactLessonDuplicate(
  db: Database,
  input: {
    startsAt: string;
    durationMinutes: number;
    lessonType: Lesson["originalType"];
    studentIds: string[];
    excludeLessonId?: string;
  }
): boolean {
  const startsAt = new Date(input.startsAt).getTime();
  const studentIds = normalizeStudentIds(input.studentIds);

  return db.lessons.some((lesson) => {
    if (lesson.id === input.excludeLessonId) {
      return false;
    }

    if (lesson.status === "cancelled_by_teacher") {
      return false;
    }

    return (
      new Date(lesson.startsAt).getTime() === startsAt &&
      lesson.durationMinutes === input.durationMinutes &&
      lesson.originalType === input.lessonType &&
      normalizeStudentIds(lesson.participants.map((participant) => participant.studentId)) === studentIds
    );
  });
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

  if (activeParticipants.length === 1) {
    lesson.effectiveType = "individual";
    lesson.durationMinutes = individualDurationMinutes;
  } else if (activeParticipants.length >= 2) {
    lesson.effectiveType = "group";
    lesson.durationMinutes = groupDurationMinutes;
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

export function shouldChargeParticipant(
  status: ParticipantStatus,
  cancellationPolicy: AppSettings["cancellationPolicy"]
): boolean {
  return (
    status === "attended" ||
    status === "missed" ||
    (status === "declined" && cancellationPolicy === "paid")
  );
}

export function applyTeacherParticipantStatusUpdate(
  db: Database,
  lesson: Lesson,
  participant: LessonParticipant,
  status: TeacherParticipantStatus
): void {
  assertTeacherParticipantStatus(status);

  participant.status = normalizeTeacherParticipantStatus(lesson, status);

  if (lesson.status === "completed") {
    participant.balanceCharged = shouldChargeParticipant(participant.status, db.settings.cancellationPolicy);
  }

  const balance = getStudentBalance(db, participant.studentId);
  participant.hasDebt = balance.remainingLessons < 1;
}

export function applyLessonCompletionCharges(db: Database, lesson: Lesson): void {
  for (const participant of lesson.participants) {
    if (participant.status === "confirmed" || participant.status === "awaiting") {
      participant.status = "attended";
    }

    if (shouldChargeParticipant(participant.status, db.settings.cancellationPolicy) && !participant.balanceCharged) {
      participant.balanceCharged = true;
    }

    participant.hasDebt = getStudentBalance(db, participant.studentId, [lesson]).remainingLessons < 1;
  }
}

export function getLessonEndTime(lesson: Pick<Lesson, "startsAt" | "durationMinutes">): number {
  return new Date(lesson.startsAt).getTime() + lesson.durationMinutes * 60_000;
}

export function isPastLessonEnd(
  lesson: Pick<Lesson, "startsAt" | "durationMinutes">,
  referenceNow = Date.now()
): boolean {
  return getLessonEndTime(lesson) <= referenceNow;
}

export function finalizePastLesson(db: Database, lesson: Lesson, referenceNow = Date.now()): void {
  if (!isPastLessonEnd(lesson, referenceNow)) {
    return;
  }

  for (const participant of lesson.participants) {
    participant.status = "attended";
  }

  applyLessonCompletionCharges(db, lesson);
  lesson.status = "completed";
  lesson.updatedAt = now();
}

function reopenFutureLesson(db: Database, lesson: Lesson): void {
  for (const participant of lesson.participants) {
    if (participant.status === "attended") {
      participant.status = "awaiting";
    }
    participant.balanceCharged = false;
  }

  lesson.status = "scheduled";
  recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);

  for (const participant of lesson.participants) {
    participant.hasDebt = getStudentBalance(db, participant.studentId).remainingLessons < 1;
  }

  lesson.updatedAt = now();
}

export function syncLessonCompletionWithSchedule(
  db: Database,
  lesson: Lesson,
  referenceNow = Date.now()
): void {
  if (lesson.status === "cancelled_by_teacher" || lesson.status === "cancelled_by_student") {
    return;
  }

  if (isPastLessonEnd(lesson, referenceNow)) {
    if (lesson.status !== "completed") {
      finalizePastLesson(db, lesson, referenceNow);
    }
    return;
  }

  if (lesson.status === "completed") {
    reopenFutureLesson(db, lesson);
  }
}

function lessonsForBalance(db: Database, extraLessons: Lesson[] = []): Lesson[] {
  if (!extraLessons.length) {
    return db.lessons;
  }

  const lessons = [...db.lessons];
  for (const lesson of extraLessons) {
    if (!lessons.some((item) => item.id === lesson.id)) {
      lessons.push(lesson);
    }
  }

  return lessons;
}

export function getStudentBalance(db: Database, studentId: string, extraLessons: Lesson[] = []): StudentBalance {
  const paidLessons = db.payments
    .filter((payment) => payment.studentId === studentId)
    .reduce((sum, payment) => sum + payment.lessonCount, 0);

  const adjustedLessons = db.balanceAdjustments
    .filter((adjustment) => adjustment.studentId === studentId)
    .reduce((sum, adjustment) => sum + adjustment.lessonDelta, 0);

  const chargedLessons = lessonsForBalance(db, extraLessons).reduce((sum, lesson) => {
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

  recalculateLesson(lesson, db.settings.individualDurationMinutes, db.settings.groupDurationMinutes);
  finalizePastLesson(db, lesson);
  return lesson;
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

      if (
        !lessonOverlapsVacation(startsAt, schedule.durationMinutes, db.vacationPeriods) &&
        !skipped.has(new Date(startsAt).getTime()) &&
        !hasRecurringLesson(db, schedule.id, startsAt)
      ) {
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
