import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "@telegraf/types";
import type { Context } from "telegraf";
import type { Lesson, Student } from "@crm/shared";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import { lessonReminderKeyboard, parseLessonCallback } from "@crm/shared/lesson-callback";
import { bindTelegramChat, getTelegramStudentProfile, setParticipantStatus } from "./backend-client";
import {
  ATTEND_COMMANDS,
  DECLINE_COMMANDS,
  findLessonByScheduleIndex,
  formatAttendancePrompt,
  formatAttendanceResult,
  isActionableLesson,
  parseLessonIndex,
  type AttendanceIntent
} from "./attendance";
import { formatHelpMessage, registerBotCommands } from "./commands";
import { BotInteraction, answerCallback, replyToUser } from "./interaction-log";
import { log } from "./logger";
import { formatBalanceMessage, formatNotLinkedMessage, formatScheduleMessage, type BotReply } from "./messages";
import {
  DEFAULT_SCHEDULE_DAYS,
  parseScheduleDaysFromPhrase,
  parseScheduleDaysFromPayload,
  SCHEDULE_COMMANDS
} from "./schedule-days";

const DEFAULT_BOT_PORT = 4002;
const WEBHOOK_PREFIX = "/telegram/webhook";

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  const token = getTelegramToken();
  if (!token) {
    return null;
  }

  if (bot) {
    return bot;
  }

  bot = new Telegraf(token);

  bot.use(async (ctx, next) => {
    const updateType = ctx.updateType;
    await withSentrySpan(
      `telegram.${updateType}`,
      "bot.request",
      () => next(),
      {
        "telegram.update_type": updateType,
        ...(ctx.from?.id ? { "telegram.user_id": ctx.from.id } : {}),
        ...(ctx.chat?.id ? { "telegram.chat_id": ctx.chat.id } : {})
      }
    );
  });

  bot.start(async (ctx) => {
    const interaction = new BotInteraction("start", ctx, {
      hasBindPayload: Boolean(getStartPayload(ctx.message))
    });

    try {
      const payload = getStartPayload(ctx.message);
      const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
      interaction.meta.group = isGroup;

      if (!payload || !ctx.chat || !ctx.from) {
        await replyToUser(
          ctx,
          interaction,
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
              "Спросить баланс: /balance",
              "Ответ по занятию: /attend 1 или /decline 1"
            ];

        await replyToUser(ctx, interaction, connectedLines.join("\n"));
        interaction.meta.linked = true;
      } catch (error) {
        interaction.outcome = "error";
        log.error("Telegram binding failed", {
          err: error,
          handler: interaction.handler,
          userId: interaction.userId,
          chatId: interaction.chatId
        });
        await replyToUser(
          ctx,
          interaction,
          "Не удалось подключить Telegram. Попросите преподавателя прислать новую ссылку из CRM."
        );
      }
    } finally {
      interaction.flush();
    }
  });

  bot.command([...SCHEDULE_COMMANDS], async (ctx) => {
    const interaction = new BotInteraction("command:schedule", ctx);

    try {
      const { days, error } = parseScheduleDaysFromPayload(ctx.payload);
      if (error) {
        interaction.outcome = "validation_error";
        await replyToUser(ctx, interaction, error);
        return;
      }

      interaction.meta.days = days;
      await replyWithSchedule(ctx, interaction, days);
    } finally {
      interaction.flush();
    }
  });

  bot.command(["balance", "баланс"], async (ctx) => {
    const interaction = new BotInteraction("command:balance", ctx);

    try {
      await replyWithProfile(ctx, interaction, formatBalanceMessage);
    } finally {
      interaction.flush();
    }
  });

  bot.command(["help", "помощь"], async (ctx) => {
    const interaction = new BotInteraction("command:help", ctx);

    try {
      const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
      interaction.meta.group = isGroup;
      await replyToUser(ctx, interaction, formatHelpMessage(isGroup));
    } finally {
      interaction.flush();
    }
  });

  bot.command([...ATTEND_COMMANDS], async (ctx) => {
    const interaction = new BotInteraction("command:attend", ctx, { intent: "confirmed" });

    try {
      await replyWithAttendance(ctx, interaction, "confirmed", ctx.payload);
    } finally {
      interaction.flush();
    }
  });

  bot.command([...DECLINE_COMMANDS], async (ctx) => {
    const interaction = new BotInteraction("command:decline", ctx, { intent: "declined" });

    try {
      await replyWithAttendance(ctx, interaction, "declined", ctx.payload);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^буду\s+(\d+)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:attend", ctx, { intent: "confirmed" });

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await replyWithAttendance(ctx, interaction, "confirmed", ctx.match[1]);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^не\s+буду\s+(\d+)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:decline", ctx, { intent: "declined" });

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await replyWithAttendance(ctx, interaction, "declined", ctx.match[1]);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^расписание(?:\s+на)?\s+\d+\s*(?:дн(?:я|ей)?)?$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:schedule", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      if (!ctx.message || !("text" in ctx.message) || typeof ctx.message.text !== "string") {
        interaction.meta.days = DEFAULT_SCHEDULE_DAYS;
        await replyWithSchedule(ctx, interaction, DEFAULT_SCHEDULE_DAYS);
        return;
      }

      const days = parseScheduleDaysFromPhrase(ctx.message.text) ?? DEFAULT_SCHEDULE_DAYS;
      interaction.meta.days = days;
      await replyWithSchedule(ctx, interaction, days);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^(расписание|занятия|когда занятие|следующ(?:ее|ие) занят(?:ие|ия))$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:schedule", ctx, { days: DEFAULT_SCHEDULE_DAYS });

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await replyWithSchedule(ctx, interaction, DEFAULT_SCHEDULE_DAYS);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^(баланс|сколько осталось|остаток)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:balance", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await replyWithProfile(ctx, interaction, formatBalanceMessage);
    } finally {
      interaction.flush();
    }
  });

  bot.action(/^(?:la|ld):[^:]+:[^:]+$|^lesson:.+:student:.+:(?:attend|decline)$/, async (ctx) => {
    const interaction = new BotInteraction("callback:lesson_attendance", ctx);

    try {
      const userId = ctx.from?.id;
      if (!userId) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Не удалось определить пользователя.", { show_alert: true });
        return;
      }

      const callbackData =
        "data" in ctx.callbackQuery && typeof ctx.callbackQuery.data === "string"
          ? ctx.callbackQuery.data
          : "";
      const parsed = parseLessonCallback(callbackData);
      if (!parsed) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Не удалось распознать кнопку.", { show_alert: true });
        return;
      }
      const { lessonId, studentId, action } = parsed;
      interaction.meta.action = action;

      const profile = await getTelegramStudentProfile(userId);
      if (profile.student.id !== studentId) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Эта кнопка предназначена для другого ученика.", { show_alert: true });
        return;
      }

      const scheduledLesson = profile.upcomingLessons.find((item) => item.id === lessonId);
      if (scheduledLesson && !isActionableLesson(scheduledLesson, studentId)) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Это занятие уже прошло, изменить ответ нельзя.", { show_alert: true });
        return;
      }

      const status = action === "attend" ? "confirmed" : "declined";
      interaction.meta.status = status;
      const lesson = await setParticipantStatus({ lessonId, studentId, status, action });
      await answerCallback(ctx, interaction, action === "attend" ? "Отмечено: будете" : "Отмечено: не будете");
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      interaction.noteMessageKind("markup_cleared");
      await replyToUser(ctx, interaction, formatParticipantResult(lesson, studentId, action));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown attendance error";
      if (message.includes("past lesson")) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Это занятие уже прошло, изменить ответ нельзя.", { show_alert: true });
        return;
      }
      interaction.outcome = "error";
      log.error("Telegram callback failed", {
        err: error,
        handler: interaction.handler,
        userId: interaction.userId,
        chatId: interaction.chatId
      });
      await answerCallback(
        ctx,
        interaction,
        "Не удалось обработать кнопку. Проверьте, что занятие еще существует.",
        { show_alert: true }
      );
    } finally {
      interaction.flush();
    }
  });

  return bot;
}

export async function startTelegramBot(): Promise<void> {
  const instance = getTelegramBot();
  if (!instance) {
    log.warn("Telegram bot disabled", { reason: "Telegram bot token is not set" });
    startWebhookServer(null, { port: getBotPort(), path: "", secret: "" });
    return;
  }

  const webhook = getWebhookConfig();
  const port = getBotPort();
  const webhookUrl = `${webhook.baseUrl}${webhook.path}`;

  log.info("Telegram bot starting webhook", { webhookUrl, port });

  try {
    const botInfo = await withTimeout(instance.telegram.getMe(), 15_000, "Telegram getMe timeout");
    await registerBotCommands(instance.telegram);
    await instance.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      secret_token: webhook.secret
    });
    const server = startWebhookServer(instance, { port, path: webhook.path, secret: webhook.secret });
    log.info("Telegram bot webhook started", { username: botInfo.username, port, path: webhook.path });
    registerShutdown(instance, server);
  } catch (error) {
    log.error("Telegram bot failed to start", { err: error });
    throw error;
  }
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

async function replyWithSchedule(ctx: Context, interaction: BotInteraction, days: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId, { days });
    const reply = formatScheduleMessage(profile);
    interaction.meta.lessonCount = profile.upcomingLessons.length;
    await replyToUser(ctx, interaction, reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram schedule query failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось получить расписание. Попробуйте позже.");
  }
}

async function replyWithProfile(
  ctx: Context,
  interaction: BotInteraction,
  format: (profile: Awaited<ReturnType<typeof getTelegramStudentProfile>>) => BotReply
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId);
    const reply = format(profile);
    await replyToUser(ctx, interaction, reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram profile query failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось получить данные. Попробуйте позже.");
  }
}

async function replyWithAttendance(
  ctx: Context,
  interaction: BotInteraction,
  intent: AttendanceIntent,
  payload?: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  const { index, error } = parseLessonIndex(payload);
  if (error) {
    interaction.outcome = "validation_error";
    await replyToUser(ctx, interaction, error);
    return;
  }

  if (index) {
    interaction.meta.lessonIndex = index;
  }

  try {
    const profile = await getTelegramStudentProfile(userId);

    if (!index) {
      interaction.meta.mode = "prompt";
      await replyToUser(ctx, interaction, formatAttendancePrompt(profile, intent));
      return;
    }

    const lesson = findLessonByScheduleIndex(profile, index);
    if (!lesson) {
      interaction.outcome = "validation_error";
      interaction.meta.mode = "not_found";
      await replyToUser(
        ctx,
        interaction,
        `Занятие №${index} не найдено.\n\n${formatAttendancePrompt(profile, intent)}`
      );
      return;
    }

    if (!isActionableLesson(lesson, profile.student.id)) {
      interaction.outcome = "validation_error";
      interaction.meta.mode = "not_actionable";
      await replyToUser(
        ctx,
        interaction,
        `Занятие №${index} недоступно для изменения.\n\n${formatAttendancePrompt(profile, intent)}`
      );
      return;
    }

    const status = intent === "confirmed" ? "confirmed" : "declined";
    interaction.meta.status = status;
    interaction.meta.mode = "update";
    const updated = await setParticipantStatus({
      lessonId: lesson.id,
      studentId: profile.student.id,
      status
    });

    await replyToUser(ctx, interaction, formatAttendanceResult(updated, profile.student.id, intent));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown attendance error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    if (message.includes("past lesson")) {
      interaction.outcome = "validation_error";
      await replyToUser(ctx, interaction, "Это занятие уже прошло, изменить ответ нельзя.");
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram attendance command failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось обновить ответ. Попробуйте позже.");
  }
}

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

function lessonKeyboard(lessonId: string, studentId: string): InlineKeyboardMarkup {
  return lessonReminderKeyboard(lessonId, studentId);
}

function getStartPayload(message: unknown): string | undefined {
  if (!message || typeof message !== "object" || !("text" in message) || typeof message.text !== "string") {
    return undefined;
  }

  const [, payload] = message.text.trim().split(/\s+/, 2);
  return payload;
}

function getBotPort(): number {
  const raw = process.env.BOT_PORT ?? process.env.PORT;
  const port = raw ? Number(raw) : DEFAULT_BOT_PORT;

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid bot port: ${raw}`);
  }

  return port;
}

function getTelegramToken(): string | undefined {
  const devToken = readEnv("TELEGRAM_DEV_BOT_TOKEN");
  if (!isProduction() && devToken) {
    return devToken;
  }

  return readEnv("TELEGRAM_BOT_TOKEN") || undefined;
}

function getWebhookConfig(): { baseUrl: string; path: string; secret: string } {
  const useDevWebhook = !isProduction() && Boolean(readEnv("TELEGRAM_DEV_BOT_TOKEN"));
  const baseUrlKey = useDevWebhook ? "TELEGRAM_DEV_WEBHOOK_BASE_URL" : "TELEGRAM_WEBHOOK_BASE_URL";
  const secretKey = useDevWebhook ? "TELEGRAM_DEV_WEBHOOK_SECRET" : "TELEGRAM_WEBHOOK_SECRET";
  const baseUrl = readEnv(baseUrlKey)?.replace(/\/+$/, "");
  const secret = readEnv(secretKey);

  if (!baseUrl) {
    throw new Error(`${baseUrlKey} is required when the Telegram bot token is set`);
  }
  if (!secret) {
    throw new Error(`${secretKey} is required when the Telegram bot token is set`);
  }

  return {
    baseUrl,
    path: `${WEBHOOK_PREFIX}/${encodeURIComponent(secret)}`,
    secret
  };
}

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function startWebhookServer(
  instance: Telegraf | null,
  webhook: { port: number; path: string; secret: string }
): Server {
  const webhookHandler = instance ? instance.webhookCallback(webhook.path) : undefined;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      jsonOk(response, { ok: true, telegramEnabled: Boolean(instance) });
      return;
    }

    if (request.method !== "POST" || url.pathname !== webhook.path || !webhookHandler) {
      jsonError(response, "Route not found", 404);
      return;
    }

    if (!hasValidTelegramSecret(request, webhook.secret)) {
      jsonError(response, "Forbidden", 403);
      return;
    }

    webhookHandler(request, response);
  });

  server.listen(webhook.port, () => {
    log.info("Telegram bot HTTP server listening", { port: webhook.port });
  });

  return server;
}

function hasValidTelegramSecret(request: IncomingMessage, secret: string): boolean {
  return request.headers["x-telegram-bot-api-secret-token"] === secret;
}

function registerShutdown(instance: Telegraf, server: Server): void {
  const shutdown = (signal: NodeJS.Signals) => {
    server.close(() => {
      instance.stop(signal);
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

function jsonOk(response: ServerResponse, payload: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function jsonError(response: ServerResponse, message: string, status: number): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: message }));
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
    `Формат: ${kind}`,
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
