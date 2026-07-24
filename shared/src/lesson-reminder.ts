import type { AppSettings, Lesson, ParticipantStatus, Reminder, Student } from "./types";
import { resolveNotificationTimeZone } from "./timezone";

export const LESSON_REMINDER_MINUTE_MS = 60_000;

export type DesiredLessonReminder = {
  lessonId: string;
  studentId: string;
  leadMinutes: number;
  scheduledFor: string;
  timeZone: string;
};

export type ReminderSyncAction =
  | { type: "insert"; desired: DesiredLessonReminder }
  | { type: "update"; reminderId: string; desired: DesiredLessonReminder; reArm: boolean }
  | { type: "skip"; reminderId: string };

export type ClaimedLessonReminder = {
  reminderId: string;
  accountId: string;
  leadMinutes: number;
  scheduledFor: string;
  timeZone: string;
  student: Pick<Student, "id" | "fullName" | "telegramChatId">;
  lesson: Pick<Lesson, "id" | "startsAt" | "durationMinutes" | "effectiveType" | "participants">;
};

export type PaymentReminderContext = {
  accountId: string;
  student: Student;
  balance: {
    studentId: string;
    remainingLessons: number;
    debtLessons: number;
  };
};

export function isSkippedLessonStatus(status: Lesson["status"]): boolean {
  return status === "cancelled_by_teacher" || status === "cancelled_by_student";
}

export function isSkippedParticipantStatus(status: ParticipantStatus): boolean {
  return status === "declined";
}

export function getStudentLessonReminderMinutes(
  student: Pick<Student, "lessonReminderMinutes">,
  settings: Pick<AppSettings, "lessonReminderMinutes">
): number[] {
  return student.lessonReminderMinutes?.length ? student.lessonReminderMinutes : settings.lessonReminderMinutes;
}

export function lessonReminderIdentityKey(lessonId: string, studentId: string, leadMinutes: number): string {
  return `${lessonId}:${studentId}:${leadMinutes}`;
}

export function utcDateKey(isoTimestamp: string): string {
  return new Date(isoTimestamp).toISOString().slice(0, 10);
}

export function isLessonReminderStillValid(input: {
  lesson: Lesson;
  studentId: string;
  nowMs?: number;
}): boolean {
  if (isSkippedLessonStatus(input.lesson.status)) {
    return false;
  }

  const nowMs = input.nowMs ?? Date.now();
  if (new Date(input.lesson.startsAt).getTime() <= nowMs) {
    return false;
  }

  const participant = input.lesson.participants.find((item) => item.studentId === input.studentId);
  if (!participant || isSkippedParticipantStatus(participant.status)) {
    return false;
  }

  return true;
}

/**
 * When several lead-time reminders for the same lesson/student are due together
 * (e.g. after worker downtime), keep only the closest-to-lesson one.
 */
export function coalesceLessonReminderDeliveries<
  T extends { lesson: { id: string }; student: { id: string }; leadMinutes: number }
>(items: T[]): { deliver: T[]; skip: T[] } {
  const bestByKey = new Map<string, T>();
  const skip: T[] = [];

  for (const item of items) {
    const key = `${item.lesson.id}:${item.student.id}`;
    const existing = bestByKey.get(key);
    if (!existing || item.leadMinutes < existing.leadMinutes) {
      if (existing) {
        skip.push(existing);
      }
      bestByKey.set(key, item);
      continue;
    }
    skip.push(item);
  }

  return { deliver: [...bestByKey.values()], skip };
}

export function desiredLessonReminders(input: {
  lesson: Lesson;
  studentsById: Map<string, Student> | Record<string, Student>;
  settings: Pick<AppSettings, "lessonReminderMinutes" | "timezone">;
  nowMs?: number;
}): DesiredLessonReminder[] {
  const { lesson, settings } = input;
  if (isSkippedLessonStatus(lesson.status)) {
    return [];
  }

  const nowMs = input.nowMs ?? Date.now();
  const startsAtMs = new Date(lesson.startsAt).getTime();
  if (startsAtMs <= nowMs) {
    return [];
  }

  const studentsById = input.studentsById;
  const results: DesiredLessonReminder[] = [];

  for (const participant of lesson.participants) {
    if (isSkippedParticipantStatus(participant.status)) {
      continue;
    }

    const student =
      studentsById instanceof Map ? studentsById.get(participant.studentId) : studentsById[participant.studentId];
    if (!student) {
      continue;
    }

    for (const leadMinutes of getStudentLessonReminderMinutes(student, settings)) {
      results.push({
        lessonId: lesson.id,
        studentId: student.id,
        leadMinutes,
        scheduledFor: new Date(startsAtMs - leadMinutes * LESSON_REMINDER_MINUTE_MS).toISOString(),
        timeZone: resolveNotificationTimeZone({
          studentTimeZone: student.timezone,
          teacherTimeZone: settings.timezone
        })
      });
    }
  }

  return results;
}

export function planLessonReminderSync(input: {
  existing: Reminder[];
  desired: DesiredLessonReminder[];
  lessonId: string;
}): ReminderSyncAction[] {
  const desiredByKey = new Map(
    input.desired.map((item) => [lessonReminderIdentityKey(item.lessonId, item.studentId, item.leadMinutes), item])
  );
  const existingForLesson = input.existing.filter(
    (item) => item.type === "lesson" && item.lessonId === input.lessonId
  );
  const existingByKey = new Map(
    existingForLesson
      .filter((item) => item.studentId != null && item.leadMinutes != null)
      .map((item) => [lessonReminderIdentityKey(item.lessonId!, item.studentId!, item.leadMinutes!), item])
  );
  const actions: ReminderSyncAction[] = [];

  for (const desired of input.desired) {
    const key = lessonReminderIdentityKey(desired.lessonId, desired.studentId, desired.leadMinutes);
    const existing = existingByKey.get(key);
    if (!existing) {
      actions.push({ type: "insert", desired });
      continue;
    }

    if (existing.status === "pending") {
      if (existing.scheduledFor !== desired.scheduledFor || existing.claimedAt) {
        actions.push({ type: "update", reminderId: existing.id, desired, reArm: false });
      }
      continue;
    }

    // Terminal row: re-arm only when the schedule moved and the new fire time is still before start.
    if (existing.scheduledFor !== desired.scheduledFor) {
      const startsAtMs =
        new Date(desired.scheduledFor).getTime() + desired.leadMinutes * LESSON_REMINDER_MINUTE_MS;
      if (new Date(desired.scheduledFor).getTime() < startsAtMs) {
        actions.push({ type: "update", reminderId: existing.id, desired, reArm: true });
      }
    }
  }

  for (const existing of existingForLesson) {
    if (existing.status !== "pending" || existing.studentId == null || existing.leadMinutes == null) {
      continue;
    }
    const key = lessonReminderIdentityKey(existing.lessonId!, existing.studentId, existing.leadMinutes);
    if (!desiredByKey.has(key)) {
      actions.push({ type: "skip", reminderId: existing.id });
    }
  }

  return actions;
}
