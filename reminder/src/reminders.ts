import type { ClaimedLessonReminder } from "@crm/shared/lesson-reminder";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import {
  backfillLessonReminders,
  claimDueLessonReminders,
  getPaymentReminderContext,
  updateReminder,
  upsertReminder
} from "./backend-client";
import { isBackendUnreachableError } from "./fetch-retry";
import { shouldSendManualPaymentReminder } from "./reminder-logic";
import { sendLessonReminder, sendPaymentReminder } from "./telegram";
import { log } from "./logger";

const minuteMs = 60_000;
let backfillStarted = false;

function logTickFailure(error: unknown): void {
  if (isBackendUnreachableError(error)) {
    log.warn("Reminder scheduler tick skipped: backend unreachable", { err: error });
    return;
  }

  log.error("Reminder scheduler tick failed", { err: error });
}

export function startReminderScheduler(): void {
  log.info("Reminder scheduler started");
  void (async () => {
    try {
      await ensureBackfill();
    } catch (error) {
      logTickFailure(error);
    }
    await runReminderTick().catch(logTickFailure);
  })();
  setInterval(() => {
    void runReminderTick().catch(logTickFailure);
  }, minuteMs);
}

async function ensureBackfill(): Promise<void> {
  if (backfillStarted) {
    return;
  }
  backfillStarted = true;

  try {
    const result = await backfillLessonReminders();
    log.info("Lesson reminder backfill completed", result);
  } catch (error) {
    backfillStarted = false;
    throw error;
  }
}

export async function runReminderTick(): Promise<void> {
  return withSentrySpan(
    "reminder.evaluate_pending",
    "task",
    async () => {
      const claimed = await claimDueLessonReminders(50);

      log.debug("Reminder tick claimed", { claimed: claimed.length });

      for (const item of claimed) {
        await sendClaimedLessonReminder(item);
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
      const context = await getPaymentReminderContext(studentId);
      const { student, balance } = context;
      const decision = shouldSendManualPaymentReminder({
        balance,
        telegramChatId: student.telegramChatId
      });

      if (!decision.send) {
        log.info("Manual payment reminder skipped", { studentId, reason: decision.reason });
        return { sent: false, reason: decision.reason };
      }

      const unpaidLessons = balance.debtLessons ?? 0;
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

async function sendClaimedLessonReminder(item: ClaimedLessonReminder): Promise<void> {
  const lessonStartsAt = item.lesson.startsAt;
  const leadDuration = formatLeadDuration(item.leadMinutes);

  return withSentrySpan(
    "reminder.send_lesson",
    "task",
    async () => {
      try {
        await sendLessonReminder(
          {
            id: item.student.id,
            fullName: item.student.fullName,
            telegramChatId: item.student.telegramChatId,
            telegramBindToken: "",
            status: "active",
            defaultLessonPrice: 0,
            createdAt: "",
            updatedAt: ""
          },
          {
            id: item.lesson.id,
            startsAt: item.lesson.startsAt,
            durationMinutes: item.lesson.durationMinutes,
            originalType: item.lesson.effectiveType,
            effectiveType: item.lesson.effectiveType,
            status: "scheduled",
            participants: item.lesson.participants,
            createdAt: "",
            updatedAt: ""
          },
          item.timeZone
        );

        const status = item.student.telegramChatId ? "sent" : "skipped";
        await updateReminder(item.reminderId, {
          status,
          sentAt: item.student.telegramChatId ? new Date().toISOString() : undefined,
          telegramChatId: item.student.telegramChatId ?? null,
          leadMinutes: item.leadMinutes
        });
        log.info("Lesson reminder processed", {
          accountId: item.accountId,
          lessonId: item.lesson.id,
          studentId: item.student.id,
          reminderId: item.reminderId,
          lessonStartsAt,
          leadMinutes: item.leadMinutes,
          leadDuration,
          status
        });
      } catch (error) {
        await updateReminder(item.reminderId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          telegramChatId: item.student.telegramChatId ?? null,
          leadMinutes: item.leadMinutes
        });
        log.error("Lesson reminder failed", {
          accountId: item.accountId,
          lessonId: item.lesson.id,
          studentId: item.student.id,
          reminderId: item.reminderId,
          lessonStartsAt,
          leadMinutes: item.leadMinutes,
          leadDuration,
          err: error
        });
      }
    },
    {
      "account.id": item.accountId,
      "lesson.id": item.lesson.id,
      "student.id": item.student.id,
      "reminder.lead_minutes": item.leadMinutes
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
