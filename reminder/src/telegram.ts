import { Telegraf } from "telegraf";
import type { Lesson, Student } from "@crm/shared";

let bot: Telegraf | null = null;

function getTelegramBot(): Telegraf | null {
  const token = getTelegramToken();
  if (!token) {
    return null;
  }

  bot ??= new Telegraf(token);
  return bot;
}

function getTelegramToken(): string | undefined {
  const devToken = process.env.TELEGRAM_DEV_BOT_TOKEN?.trim();
  if (process.env.NODE_ENV !== "production" && devToken) {
    return devToken;
  }

  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export async function sendLessonReminder(student: Student, lesson: Lesson): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  await instance.telegram.sendMessage(student.telegramChatId, formatLessonReminder(student, lesson), {
    reply_markup: lessonReminderKeyboard(lesson.id, student.id)
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

import { lessonReminderKeyboard } from "@crm/shared/lesson-callback";

function formatLessonReminder(student: Student, lesson: Lesson): string {
  const startsAt = new Date(lesson.startsAt);
  const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(startsAt);
  const timeRange = formatLessonTimeRange(startsAt, lesson.durationMinutes);

  const kind = lesson.effectiveType === "group" ? "групповое" : "индивидуальное";
  const participant = lesson.participants.find((item) => item.studentId === student.id);
  const paymentLine = participant?.hasDebt
    ? "Важно: по балансу нет оплаченного занятия, пожалуйста, не забудьте оплату."
    : undefined;

  return [
    `${student.fullName}, напоминаем о занятии.`,
    `Когда: ${date}, ${timeRange}`,
    `Формат: ${kind}`,
    paymentLine,
    "Пожалуйста, подтвердите участие."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatLessonTimeRange(startsAt: Date, durationMinutes: number): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", { hour: "numeric", minute: "2-digit" });
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return `${formatter.format(startsAt)}–${formatter.format(endsAt)}`;
}
