import { Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "@telegraf/types";
import { store } from "./store.js";
import type { Lesson, Student } from "./types.js";

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }

  if (bot) {
    return bot;
  }

  bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Здравствуйте! Это бот CRM преподавателя.",
        `Ваш chat id: ${ctx.chat.id}`,
        "Передайте этот id преподавателю, чтобы получать напоминания о занятиях."
      ].join("\n")
    );
  });

  bot.action(/^lesson:(.+):student:(.+):(attend|decline)$/, async (ctx) => {
    const [, lessonId, studentId, rawAction] = ctx.match;
    const action = rawAction as "attend" | "decline";
    const status = action === "attend" ? "confirmed" : "declined";
    const lesson = await store.setParticipantStatus(lessonId, studentId, status, action);
    await ctx.answerCbQuery(action === "attend" ? "Отмечено: будете" : "Отмечено: не будете");
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(formatParticipantResult(lesson, studentId, action));
  });

  return bot;
}

export async function startTelegramBot(): Promise<void> {
  const instance = getTelegramBot();
  if (!instance) {
    console.log("Telegram bot disabled: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  await instance.launch();
  console.log("Telegram bot polling started");

  process.once("SIGINT", () => instance.stop("SIGINT"));
  process.once("SIGTERM", () => instance.stop("SIGTERM"));
}

export async function sendLessonReminder(student: Student, lesson: Lesson): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  await instance.telegram.sendMessage(student.telegramChatId, formatLessonReminder(student, lesson), {
    reply_markup: lessonKeyboard(lesson.id, student.id)
  });
}

export async function sendPaymentReminder(student: Student, debtLessons: number): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  await instance.telegram.sendMessage(
    student.telegramChatId,
    `Напоминание об оплате: сейчас не оплачено занятий: ${debtLessons}. Пожалуйста, свяжитесь с преподавателем.`
  );
}

function lessonKeyboard(lessonId: string, studentId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Буду", callback_data: `lesson:${lessonId}:student:${studentId}:attend` },
        { text: "Не буду", callback_data: `lesson:${lessonId}:student:${studentId}:decline` }
      ]
    ]
  };
}

function formatLessonReminder(student: Student, lesson: Lesson): string {
  const date = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(lesson.startsAt));

  const kind = lesson.effectiveType === "group" ? "групповое" : "индивидуальное";
  const participant = lesson.participants.find((item) => item.studentId === student.id);
  const paymentLine = participant?.hasDebt
    ? "Важно: по балансу нет оплаченного занятия, пожалуйста, не забудьте оплату."
    : undefined;

  return [
    `${student.fullName}, напоминаем о занятии.`,
    `Когда: ${date}`,
    `Формат: ${kind}, офлайн`,
    paymentLine,
    "Пожалуйста, подтвердите участие."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatParticipantResult(lesson: Lesson, studentId: string, action: string): string {
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const result = action === "attend" ? "Вы подтвердили занятие." : "Вы отметили отсутствие.";
  const debt = participant?.hasDebt ? "\nВажно: по вашему балансу есть неоплаченное занятие." : "";
  const converted =
    lesson.originalType === "group" && lesson.effectiveType === "individual"
      ? "\nГрупповое занятие сейчас считается индивидуальным, потому что подтвержден один ученик."
      : "";

  return `${result}${debt}${converted}`;
}
