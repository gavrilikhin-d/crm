import { Telegraf } from "telegraf";
import type { Lesson, Student } from "@crm/shared";
import { lessonReminderKeyboard } from "@crm/shared/lesson-callback";
import { formatLessonDateTimeInTimeZone } from "@crm/shared/timezone";

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

export async function sendLessonReminder(student: Student, lesson: Lesson, timeZone: string): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  await instance.telegram.sendMessage(student.telegramChatId, formatLessonReminder(student, lesson, timeZone), {
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

function formatLessonReminder(student: Student, lesson: Lesson, timeZone: string): string {
  const { date, timeRange } = formatLessonDateTimeInTimeZone(lesson.startsAt, lesson.durationMinutes, timeZone);

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
