import type { Database, Lesson, ParticipantStatus, Student } from "@crm/shared";
import { resolveNotificationTimeZone } from "@crm/shared/timezone";

const MINUTE_MS = 60_000;

type WorkerSnapshot = {
  accountId: string;
  snapshot: Database;
  settings: Database["settings"];
};

type PendingLessonReminder = {
  accountId: string;
  student: Student;
  lesson: Lesson;
  leadMinutes: number;
  scheduledFor: string;
  dedupeKey: string;
  timeZone: string;
};

function isSkippedLessonStatus(status: Lesson["status"]): boolean {
  return status === "cancelled_by_teacher" || status === "cancelled_by_student";
}

function isSkippedParticipantStatus(status: ParticipantStatus): boolean {
  return status === "declined";
}

function isLessonReminderDue(input: {
  nowMs: number;
  lessonStartsAtMs: number;
  leadMinutes: number;
}): boolean {
  const scheduledForMs = input.lessonStartsAtMs - input.leadMinutes * MINUTE_MS;
  return scheduledForMs <= input.nowMs && input.lessonStartsAtMs > input.nowMs;
}

function getStudentLessonReminderMinutes(student: Student, settings: Database["settings"]): number[] {
  return student.lessonReminderMinutes?.length ? student.lessonReminderMinutes : settings.lessonReminderMinutes;
}

function collectPendingLessonReminders(workerSnapshots: WorkerSnapshot[], nowMs: number): PendingLessonReminder[] {
  const results: PendingLessonReminder[] = [];

  for (const worker of workerSnapshots) {
    const db = worker.snapshot;

    for (const lesson of db.lessons) {
      if (isSkippedLessonStatus(lesson.status)) {
        continue;
      }

      const startsAtMs = new Date(lesson.startsAt).getTime();
      for (const participant of lesson.participants) {
        if (isSkippedParticipantStatus(participant.status)) {
          continue;
        }

        const student = db.students.find((candidate) => candidate.id === participant.studentId);
        if (!student) {
          continue;
        }

        for (const leadMinutes of getStudentLessonReminderMinutes(student, worker.settings)) {
          if (!isLessonReminderDue({ nowMs, lessonStartsAtMs: startsAtMs, leadMinutes })) {
            continue;
          }

          const scheduledFor = new Date(startsAtMs - leadMinutes * MINUTE_MS).toISOString();
          results.push({
            accountId: worker.accountId,
            student,
            lesson,
            leadMinutes,
            scheduledFor,
            dedupeKey: `lesson:${lesson.id}:${student.id}:${leadMinutes}`,
            timeZone: resolveNotificationTimeZone({
              studentTimeZone: student.timezone,
              teacherTimeZone: worker.settings.timezone
            })
          });
        }
      }
    }
  }

  return results;
}

function shouldSendManualPaymentReminder(input: {
  balance?: { remainingLessons: number; debtLessons: number };
  telegramChatId?: string;
}): { send: true } | { send: false; reason: string } {
  const balance = input.balance;
  const hasNoPaidLessons = (balance?.remainingLessons ?? 0) < 1;
  const unpaidLessons = balance?.debtLessons ?? 0;

  if (!balance || (!hasNoPaidLessons && unpaidLessons <= 0)) {
    return { send: false, reason: "У ученика есть оплаченные занятия на балансе." };
  }

  if (!input.telegramChatId) {
    return { send: false, reason: "У ученика не указан Telegram chat id." };
  }

  return { send: true };
}

export {
  MINUTE_MS,
  collectPendingLessonReminders,
  getStudentLessonReminderMinutes,
  isLessonReminderDue,
  isSkippedLessonStatus,
  isSkippedParticipantStatus,
  shouldSendManualPaymentReminder,
  type PendingLessonReminder,
  type WorkerSnapshot
};
