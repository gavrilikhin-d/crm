import { sendLessonReminderToChat, sendPaymentReminder } from "./telegram";
import { getBalances, getSnapshot, updateReminder, upsertReminder } from "./backend-client";
import { isTelegramGroupChat } from "@crm/shared/lesson-reminder";
import type { Lesson, LessonParticipant, Student } from "@crm/shared";

const minuteMs = 60_000;

type ReminderMember = {
  student: Student;
  participant: LessonParticipant;
};

export function startReminderScheduler(): void {
  console.log("Reminder scheduler started");
  void runReminderTick().catch((error) => {
    console.error("Reminder scheduler tick failed:", error);
  });
  setInterval(() => {
    void runReminderTick().catch((error) => {
      console.error("Reminder scheduler tick failed:", error);
    });
  }, minuteMs);
}

export async function runReminderTick(): Promise<void> {
  const db = await getSnapshot();
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

      const chatGroups = groupReminderMembers(db.students, lesson);
      for (const [chatId, members] of chatGroups) {
        const isGroupChat = isTelegramGroupChat(chatId) || members.length > 1;
        const dedupeKey = isGroupChat
          ? `lesson:${lesson.id}:chat:${chatId}:${leadMinutes}`
          : `lesson:${lesson.id}:${members[0].student.id}:${leadMinutes}`;

        await sendReminderOnce({
          chatId,
          lesson,
          members,
          isGroupChat,
          scheduledFor: new Date(scheduledFor).toISOString(),
          dedupeKey
        });
      }
    }
  }
}

export async function sendManualPaymentReminder(studentId: string): Promise<{ sent: boolean; reason?: string }> {
  const db = await getSnapshot();
  const student = db.students.find((candidate) => candidate.id === studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  const balances = await getBalances();
  const balance = balances.find((candidate) => candidate.studentId === studentId);
  const unpaidLessons = balance?.debtLessons ?? 0;
  const hasNoPaidLessons = (balance?.remainingLessons ?? 0) < 1;

  if (!balance || (!hasNoPaidLessons && unpaidLessons <= 0)) {
    return { sent: false, reason: "У ученика есть оплаченные занятия на балансе." };
  }

  if (!student.telegramChatId) {
    return { sent: false, reason: "У ученика не указан Telegram chat id." };
  }

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
    return { sent: true };
  } catch (error) {
    await updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
}

function groupReminderMembers(students: Student[], lesson: Lesson): Map<string, ReminderMember[]> {
  const chatGroups = new Map<string, ReminderMember[]>();

  for (const participant of lesson.participants) {
    if (participant.status === "declined") {
      continue;
    }

    const student = students.find((candidate) => candidate.id === participant.studentId);
    if (!student?.telegramChatId) {
      continue;
    }

    const chatId = student.telegramChatId;
    const members = chatGroups.get(chatId) ?? [];
    members.push({ student, participant });
    chatGroups.set(chatId, members);
  }

  return chatGroups;
}

async function sendReminderOnce(input: {
  chatId: string;
  lesson: Lesson;
  members: ReminderMember[];
  isGroupChat: boolean;
  scheduledFor: string;
  dedupeKey: string;
}): Promise<void> {
  const reminder = await upsertReminder({
    type: "lesson",
    lessonId: input.lesson.id,
    studentId: input.isGroupChat ? undefined : input.members[0]?.student.id,
    scheduledFor: input.scheduledFor,
    status: "pending",
    dedupeKey: input.dedupeKey
  });

  if (reminder.status !== "pending") {
    return;
  }

  try {
    await sendLessonReminderToChat({
      chatId: input.chatId,
      lesson: input.lesson,
      members: input.members,
      isGroupChat: input.isGroupChat
    });
    await updateReminder(reminder.id, {
      status: "sent",
      sentAt: new Date().toISOString()
    });
  } catch (error) {
    await updateReminder(reminder.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
