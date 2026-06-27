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
    try {
      const [, lessonId, studentId, rawAction] = ctx.match;
      const action = rawAction as "attend" | "decline";
      const status = action === "attend" ? "confirmed" : "declined";
      const lesson = await store.setParticipantStatus(lessonId, studentId, status, action);
      await ctx.answerCbQuery(action === "attend" ? "Отмечено: будете" : "Отмечено: не будете");
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      await ctx.reply(formatParticipantResult(lesson, studentId, action));
      console.log(`Telegram callback processed: lesson=${lessonId} student=${studentId} action=${action}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Telegram callback error";
      console.error("Telegram callback failed:", message);
      await ctx.answerCbQuery("Не удалось обработать кнопку. Проверьте, что занятие еще существует.", {
        show_alert: true
      });
    }
  });

  return bot;
}

export async function startTelegramBot(): Promise<void> {
  const instance = getTelegramBot();
  if (!instance) {
    console.log("Telegram bot disabled: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  console.log("Telegram bot starting polling...");

  try {
    const botInfo = await withTimeout(instance.telegram.getMe(), 15_000, "Telegram getMe timeout");
    void instance.launch({ dropPendingUpdates: true }).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown Telegram polling error";
      console.error("Telegram polling stopped with error:", message);
    });
    console.log(`Telegram bot polling started as @${botInfo.username}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram launch error";
    console.error("Telegram bot failed to start:", message);
  }

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

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
