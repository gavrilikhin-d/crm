import { sendLessonReminder, sendPaymentReminder } from "./telegram";
import { getWorkerSnapshots, updateReminder, upsertReminder } from "./backend-client";
import { isBackendUnreachableError } from "./fetch-retry";
import { collectPendingLessonReminders, shouldSendManualPaymentReminder } from "./reminder-logic";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import { log } from "./logger";
import type { Lesson, Student } from "@crm/shared";

const minuteMs = 60_000;

function logTickFailure(error: unknown): void {
  if (isBackendUnreachableError(error)) {
    log.warn("Reminder scheduler tick skipped: backend unreachable", { err: error });
    return;
  }

  log.error("Reminder scheduler tick failed", { err: error });
}

export function startReminderScheduler(): void {
  log.info("Reminder scheduler started");
  void runReminderTick().catch(logTickFailure);
  setInterval(() => {
    void runReminderTick().catch(logTickFailure);
  }, minuteMs);
}

export async function runReminderTick(): Promise<void> {
  return withSentrySpan(
    "reminder.evaluate_pending",
    "task",
    async () => {
      const workerSnapshots = await getWorkerSnapshots();
      const pending = collectPendingLessonReminders(workerSnapshots, Date.now());

      log.debug("Reminder tick evaluated", {
        accounts: workerSnapshots.length,
        pending: pending.length
      });

      for (const item of pending) {
        await sendReminderOnce({
          accountId: item.accountId,
          student: item.student,
          lesson: item.lesson,
          leadMinutes: item.leadMinutes,
          scheduledFor: item.scheduledFor,
          dedupeKey: item.dedupeKey,
          timeZone: item.timeZone
        });
      }
    },
    undefined
  );
}

export async function sendManualPaymentReminder(studentId: string): Promise<{ sent: boolean; reason?: string }> {
  return withSentrySpan(
    "reminder.manual_payment",
    "task",
    async () => {
      const workerSnapshots = await getWorkerSnapshots();
      const worker = workerSnapshots.find((item) => item.snapshot.students.some((student) => student.id === studentId));
      if (!worker) {
        throw new Error("Student not found");
      }

      const db = worker.snapshot;
      const student = db.students.find((candidate) => candidate.id === studentId);
      if (!student) {
        throw new Error("Student not found");
      }

      const balance = worker.balances.find((candidate) => candidate.studentId === studentId);
      const decision = shouldSendManualPaymentReminder({
        balance,
        telegramChatId: student.telegramChatId
      });

      if (!decision.send) {
        log.info("Manual payment reminder skipped", { studentId, reason: decision.reason });
        return { sent: false, reason: decision.reason };
      }

      const unpaidLessons = balance?.debtLessons ?? 0;
      const reminder = await upsertReminder({
        type: "payment",
        studentId,
        scheduledFor: new Date().toISOString(),
        status: "pending",
        dedupeKey: `payment:${studentId}:${new Date().toISOString().slice(0, 10)}`
      });

      try {
        await sendPaymentReminder(student, unpaidLessons);
        await updateReminder(reminder.id, {
          status: "sent",
          sentAt: new Date().toISOString(),
          telegramChatId: student.telegramChatId ?? null
        });
        log.info("Manual payment reminder sent", { studentId, reminderId: reminder.id, unpaidLessons });
        return { sent: true };
      } catch (error) {
        await updateReminder(reminder.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          telegramChatId: student.telegramChatId ?? null
        });
        log.error("Manual payment reminder failed", { studentId, reminderId: reminder.id, err: error });
        throw error;
      }
    },
    { "student.id": studentId }
  );
}

async function sendReminderOnce(input: {
  accountId: string;
  student: Student;
  lesson: Lesson;
  leadMinutes: number;
  scheduledFor: string;
  dedupeKey: string;
  timeZone: string;
}): Promise<void> {
  const lessonStartsAt = input.lesson.startsAt;
  const leadDuration = formatLeadDuration(input.leadMinutes);

  return withSentrySpan(
    "reminder.send_lesson",
    "task",
    async () => {
      const reminder = await upsertReminder({
        type: "lesson",
        lessonId: input.lesson.id,
        studentId: input.student.id,
        scheduledFor: input.scheduledFor,
        status: "pending",
        dedupeKey: input.dedupeKey
      });

      if (reminder.status !== "pending") {
        log.debug("Lesson reminder skipped as duplicate", {
          accountId: input.accountId,
          lessonId: input.lesson.id,
          studentId: input.student.id,
          lessonStartsAt,
          leadMinutes: input.leadMinutes,
          leadDuration,
          dedupeKey: input.dedupeKey,
          status: reminder.status
        });
        return;
      }

      try {
        await sendLessonReminder(input.student, input.lesson, input.timeZone);
        const status = input.student.telegramChatId ? "sent" : "skipped";
        await updateReminder(reminder.id, {
          status,
          sentAt: input.student.telegramChatId ? new Date().toISOString() : undefined,
          telegramChatId: input.student.telegramChatId ?? null,
          leadMinutes: input.leadMinutes
        });
        log.info("Lesson reminder processed", {
          accountId: input.accountId,
          lessonId: input.lesson.id,
          studentId: input.student.id,
          reminderId: reminder.id,
          lessonStartsAt,
          leadMinutes: input.leadMinutes,
          leadDuration,
          status
        });
      } catch (error) {
        await updateReminder(reminder.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          telegramChatId: input.student.telegramChatId ?? null,
          leadMinutes: input.leadMinutes
        });
        log.error("Lesson reminder failed", {
          accountId: input.accountId,
          lessonId: input.lesson.id,
          studentId: input.student.id,
          reminderId: reminder.id,
          lessonStartsAt,
          leadMinutes: input.leadMinutes,
          leadDuration,
          err: error
        });
      }
    },
    {
      "account.id": input.accountId,
      "lesson.id": input.lesson.id,
      "student.id": input.student.id,
      "reminder.lead_minutes": input.leadMinutes
    }
  );
}

function formatLeadDuration(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1d" : `${days}d`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}min`;
}
