import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import type { Lesson, Student } from "@crm/shared";
import {
  buildLessonReminderKeyboard,
  formatLessonReminderText,
  isTelegramGroupChat,
  type LessonReminderParticipant
} from "@crm/shared/lesson-reminder";
import { parseLessonCallback } from "@crm/shared/lesson-callback";
import { bindTelegramChat, getLessonReminderState, getTelegramStudentProfile, setParticipantStatus } from "./backend-client";
import { formatHelpMessage, registerBotCommands } from "./commands";
import { formatBalanceMessage, formatNotLinkedMessage, formatScheduleMessage, type BotReply } from "./messages";
import {
  DEFAULT_SCHEDULE_DAYS,
  parseScheduleDaysFromPhrase,
  parseScheduleDaysFromPayload,
  SCHEDULE_COMMANDS
} from "./schedule-days";

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
    const payload = getStartPayload(ctx.message);
    const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

    if (!payload || !ctx.chat || !ctx.from) {
      await ctx.reply(
        [
          "Здравствуйте! Это бот CRM преподавателя.",
          "Чтобы подключить напоминания, откройте персональную ссылку из CRM преподавателя.",
          "",
          formatHelpMessage(isGroup)
        ].join("\n")
      );
      return;
    }

    try {
      const student = await bindTelegramChat({
        token: payload,
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        username: ctx.from.username
      });
      const connectedLines = isGroup
        ? [
            `${student.fullName}, ваш Telegram подключен.`,
            "Напоминания и команды будут работать в этом чате для вас лично.",
            "",
            "Расписание: /schedule (7 дней) или /schedule 14",
            "Баланс: /balance"
          ]
        : [
            `${student.fullName}, Telegram подключен. Теперь сюда будут приходить напоминания о занятиях.`,
            "",
            "Спросить расписание: /schedule (7 дней) или /schedule 14",
            "Спросить баланс: /balance"
          ];

      await ctx.reply(connectedLines.join("\n"));
      console.log(
        `Telegram linked: student=${student.id} user=${ctx.from.id} chat=${ctx.chat.id} group=${isGroup}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Telegram binding error";
      console.error("Telegram binding failed:", message);
      await ctx.reply("Не удалось подключить Telegram. Попросите преподавателя прислать новую ссылку из CRM.");
    }
  });

  bot.command([...SCHEDULE_COMMANDS], async (ctx) => {
    const { days, error } = parseScheduleDaysFromPayload(ctx.payload);
    if (error) {
      await ctx.reply(error);
      return;
    }

    await replyWithSchedule(ctx, days);
  });

  bot.command(["balance", "баланс"], async (ctx) => {
    await replyWithProfile(ctx, formatBalanceMessage);
  });

  bot.command(["help", "помощь"], async (ctx) => {
    const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
    await ctx.reply(formatHelpMessage(isGroup));
  });

  bot.hears(/^расписание(?:\s+на)?\s+\d+\s*(?:дн(?:я|ей)?)?$/i, async (ctx) => {
    if (!isPrivateChat(ctx)) {
      return;
    }

    if (!ctx.message || !("text" in ctx.message) || typeof ctx.message.text !== "string") {
      await replyWithSchedule(ctx, DEFAULT_SCHEDULE_DAYS);
      return;
    }

    const days = parseScheduleDaysFromPhrase(ctx.message.text) ?? DEFAULT_SCHEDULE_DAYS;
    await replyWithSchedule(ctx, days);
  });

  bot.hears(/^(расписание|занятия|когда занятие|следующ(?:ее|ие) занят(?:ие|ия))$/i, async (ctx) => {
    if (!isPrivateChat(ctx)) {
      return;
    }

    await replyWithSchedule(ctx, DEFAULT_SCHEDULE_DAYS);
  });

  bot.hears(/^(баланс|сколько осталось|остаток)$/i, async (ctx) => {
    if (!isPrivateChat(ctx)) {
      return;
    }

    await replyWithProfile(ctx, formatBalanceMessage);
  });

  bot.action(/^(?:la|ld):[^:]+:[^:]+$|^lesson:.+:student:.+:(?:attend|decline)$/, async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCbQuery("Не удалось определить пользователя.", { show_alert: true });
        return;
      }

      const callbackData =
        "data" in ctx.callbackQuery && typeof ctx.callbackQuery.data === "string"
          ? ctx.callbackQuery.data
          : "";
      const parsed = parseLessonCallback(callbackData);
      if (!parsed) {
        await ctx.answerCbQuery("Не удалось распознать кнопку.", { show_alert: true });
        return;
      }
      const { lessonId, studentId, action } = parsed;

      const profile = await getTelegramStudentProfile(userId);
      if (profile.student.id !== studentId) {
        await ctx.answerCbQuery("Эта кнопка предназначена для другого ученика.", { show_alert: true });
        return;
      }

      const status = action === "attend" ? "confirmed" : "declined";
      const lesson = await setParticipantStatus({ lessonId, studentId, status, action });
      await ctx.answerCbQuery(action === "attend" ? "Отмечено: будете" : "Отмечено: не будете");

      const chatId = ctx.chat?.id;
      const isGroup = chatId !== undefined && isTelegramGroupChat(chatId);

      if (isGroup && chatId !== undefined) {
        const reminderState = await getLessonReminderState(lessonId, chatId);
        await ctx
          .editMessageText(reminderState.text, {
            reply_markup: reminderState.replyMarkup
          })
          .catch(() => undefined);
      } else {
        await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
        await ctx.reply(formatParticipantResult(lesson, studentId, action));
      }

      console.log(`Telegram callback processed: lesson=${lessonId} student=${studentId} action=${action}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Telegram callback error";
      console.error("Telegram callback failed:", message);
      if (message.includes("not found")) {
        await ctx.answerCbQuery("Telegram не подключен к вашему профилю.", { show_alert: true });
        return;
      }
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
    await registerBotCommands(instance.telegram);
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
  const participant = lesson.participants.find((item) => item.studentId === student.id);
  if (!instance || !student.telegramChatId || !participant) {
    return;
  }

  const participants: LessonReminderParticipant[] = [
    {
      studentId: student.id,
      fullName: student.fullName,
      status: participant.status,
      hasDebt: participant.hasDebt
    }
  ];

  const text = formatLessonReminderText(lesson, participants, { isGroupChat: false });
  const replyMarkup = buildLessonReminderKeyboard(lesson.id, participants);

  await instance.telegram.sendMessage(student.telegramChatId, text, {
    reply_markup: replyMarkup
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

async function replyWithSchedule(ctx: Context, days: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId, { days });
    const reply = formatScheduleMessage(profile);
    if (typeof reply === "string") {
      await ctx.reply(reply);
      return;
    }
    await ctx.reply(reply.text, { parse_mode: reply.parse_mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      await ctx.reply(formatNotLinkedMessage());
      return;
    }
    console.error("Telegram schedule query failed:", message);
    await ctx.reply("Не удалось получить расписание. Попробуйте позже.");
  }
}

async function replyWithProfile(
  ctx: Context,
  format: (profile: Awaited<ReturnType<typeof getTelegramStudentProfile>>) => BotReply
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId);
    const reply = format(profile);
    if (typeof reply === "string") {
      await ctx.reply(reply);
      return;
    }
    await ctx.reply(reply.text, { parse_mode: reply.parse_mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      await ctx.reply(formatNotLinkedMessage());
      return;
    }
    console.error("Telegram profile query failed:", message);
    await ctx.reply("Не удалось получить данные. Попробуйте позже.");
  }
}

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

function getStartPayload(message: unknown): string | undefined {
  if (!message || typeof message !== "object" || !("text" in message) || typeof message.text !== "string") {
    return undefined;
  }

  const [, payload] = message.text.trim().split(/\s+/, 2);
  return payload;
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
