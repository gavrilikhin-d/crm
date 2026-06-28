import { Telegraf } from "telegraf";
import type { Lesson, LessonParticipant, Student } from "@crm/shared";
import {
  buildLessonReminderKeyboard,
  formatLessonReminderText,
  type LessonReminderParticipant
} from "@crm/shared/lesson-reminder";

let bot: Telegraf | null = null;

function getTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }

  bot ??= new Telegraf(token);
  return bot;
}

export async function sendLessonReminderToChat(input: {
  chatId: string;
  lesson: Lesson;
  members: Array<{ student: Student; participant: LessonParticipant }>;
  isGroupChat: boolean;
}): Promise<void> {
  const instance = getTelegramBot();
  if (!instance) {
    return;
  }

  const participants = input.members.map(({ student, participant }) => ({
    studentId: student.id,
    fullName: student.fullName,
    status: participant.status,
    hasDebt: participant.hasDebt
  }));

  await sendReminderMessage(instance, input.chatId, input.lesson, participants, input.isGroupChat);
}

export async function sendLessonReminder(student: Student, lesson: Lesson): Promise<void> {
  const participant = lesson.participants.find((item) => item.studentId === student.id);
  if (!student.telegramChatId || !participant) {
    return;
  }

  await sendLessonReminderToChat({
    chatId: student.telegramChatId,
    lesson,
    members: [{ student, participant }],
    isGroupChat: false
  });
}

export async function sendPaymentReminder(student: Student, unpaidLessons: number): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  const paymentText =
    unpaidLessons > 0
      ? `сейчас не оплачено занятий: ${unpaidLessons}`
      : "на балансе нет оплаченных занятий";

  await instance.telegram.sendMessage(
    student.telegramChatId,
    `Напоминание об оплате: ${paymentText}. Пожалуйста, свяжитесь с преподавателем.`
  );
}

async function sendReminderMessage(
  instance: Telegraf,
  chatId: string,
  lesson: Lesson,
  participants: LessonReminderParticipant[],
  isGroupChat: boolean
): Promise<void> {
  const text = formatLessonReminderText(lesson, participants, { isGroupChat });
  const replyMarkup = buildLessonReminderKeyboard(lesson.id, participants);

  await instance.telegram.sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
}
