import { sendLessonReminder, sendPaymentReminder } from "./telegram";
import { getWorkerSnapshots, updateReminder, upsertReminder } from "./backend-client";
import { collectPendingLessonReminders, shouldSendManualPaymentReminder } from "./reminder-logic";
import { log } from "./logger";
import type { Lesson, Student } from "@crm/shared";

const minuteMs = 60_000;

export function startReminderScheduler(): void {
  log.info("Reminder scheduler started");
  void runReminderTick().catch((error) => {
    log.error("Reminder scheduler tick failed", { err: error });
  });
  setInterval(() => {
    void runReminderTick().catch((error) => {
      log.error("Reminder scheduler tick failed", { err: error });
    });
  }, minuteMs);
}

export async function runReminderTick(): Promise<void> {
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
      scheduledFor: item.scheduledFor,
      dedupeKey: item.dedupeKey
    });
  }
}

export async function sendManualPaymentReminder(studentId: string): Promise<{ sent: boolean; reason?: string }> {
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
      sentAt: new Date().toISOString()
    });
    log.info("Manual payment reminder sent", { studentId, reminderId: reminder.id, unpaidLessons });
    return { sent: true };
  } catch (error) {
    await updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    log.error("Manual payment reminder failed", { studentId, reminderId: reminder.id, err: error });
    throw error;
  }
}

async function sendReminderOnce(input: {
  accountId: string;
  student: Student;
  lesson: Lesson;
  scheduledFor: string;
  dedupeKey: string;
}): Promise<void> {
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
      dedupeKey: input.dedupeKey,
      status: reminder.status
    });
    return;
  }

  try {
    await sendLessonReminder(input.student, input.lesson);
    const status = input.student.telegramChatId ? "sent" : "skipped";
    await updateReminder(reminder.id, {
      status,
      sentAt: input.student.telegramChatId ? new Date().toISOString() : undefined
    });
    log.info("Lesson reminder processed", {
      accountId: input.accountId,
      lessonId: input.lesson.id,
      studentId: input.student.id,
      reminderId: reminder.id,
      status
    });
  } catch (error) {
    await updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    log.error("Lesson reminder failed", {
      accountId: input.accountId,
      lessonId: input.lesson.id,
      studentId: input.student.id,
      reminderId: reminder.id,
      err: error
    });
  }
}
