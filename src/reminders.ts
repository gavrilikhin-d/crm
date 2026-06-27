import { sendLessonReminder, sendPaymentReminder } from "./telegram";
import { store } from "./store";
import type { Lesson, Student } from "./types";

const minuteMs = 60_000;

export function startReminderScheduler(): void {
  void runReminderTick();
  setInterval(() => {
    void runReminderTick();
  }, minuteMs);
}

export async function runReminderTick(): Promise<void> {
  const db = await store.getSnapshot();
  const now = Date.now();

  for (const lesson of db.lessons) {
    if (lesson.status === "cancelled_by_teacher" || lesson.status === "cancelled_by_student") {
      continue;
    }

    const startsAt = new Date(lesson.startsAt).getTime();
    for (const leadMinutes of db.settings.lessonReminderMinutes) {
      const scheduledFor = startsAt - leadMinutes * minuteMs;
      const shouldSend = scheduledFor <= now && startsAt > now;
      if (!shouldSend) {
        continue;
      }

      for (const participant of lesson.participants) {
        if (participant.status === "declined") {
          continue;
        }

        const student = db.students.find((candidate) => candidate.id === participant.studentId);
        if (!student) {
          continue;
        }

        await sendReminderOnce({
          student,
          lesson,
          scheduledFor: new Date(scheduledFor).toISOString(),
          dedupeKey: `lesson:${lesson.id}:${student.id}:${leadMinutes}`
        });
      }
    }
  }
}

export async function sendManualPaymentReminder(studentId: string): Promise<{ sent: boolean; reason?: string }> {
  const db = await store.getSnapshot();
  const student = db.students.find((candidate) => candidate.id === studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  const balances = await store.getBalances();
  const balance = balances.find((candidate) => candidate.studentId === studentId);
  const unpaidLessons = balance?.debtLessons ?? 0;
  const hasNoPaidLessons = (balance?.remainingLessons ?? 0) < 1;

  if (!balance || (!hasNoPaidLessons && unpaidLessons <= 0)) {
    return { sent: false, reason: "У ученика есть оплаченные занятия на балансе." };
  }

  if (!student.telegramChatId) {
    return { sent: false, reason: "У ученика не указан Telegram chat id." };
  }

  const reminder = await store.upsertReminder({
    type: "payment",
    studentId,
    scheduledFor: new Date().toISOString(),
    status: "pending",
    dedupeKey: `payment:${studentId}:${new Date().toISOString().slice(0, 10)}`
  });

  try {
    await sendPaymentReminder(student, unpaidLessons);
    await store.updateReminder(reminder.id, {
      status: "sent",
      sentAt: new Date().toISOString()
    });
    return { sent: true };
  } catch (error) {
    await store.updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
}

async function sendReminderOnce(input: {
  student: Student;
  lesson: Lesson;
  scheduledFor: string;
  dedupeKey: string;
}): Promise<void> {
  const reminder = await store.upsertReminder({
    type: "lesson",
    lessonId: input.lesson.id,
    studentId: input.student.id,
    scheduledFor: input.scheduledFor,
    status: "pending",
    dedupeKey: input.dedupeKey
  });

  if (reminder.status !== "pending") {
    return;
  }

  try {
    await sendLessonReminder(input.student, input.lesson);
    await store.updateReminder(reminder.id, {
      status: input.student.telegramChatId ? "sent" : "skipped",
      sentAt: input.student.telegramChatId ? new Date().toISOString() : undefined
    });
  } catch (error) {
    await store.updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
