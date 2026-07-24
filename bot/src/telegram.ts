import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "@telegraf/types";
import type { Context } from "telegraf";
import type { Lesson, Student, TelegramStudentProfile } from "@crm/shared";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import { lessonReminderKeyboard, parseLessonCallback } from "@crm/shared/lesson-callback";
import { formatLessonDateTimeInTimeZone } from "@crm/shared/timezone";
import {
  bindTelegramChat,
  getTelegramStudentProfile,
  setParticipantStatus,
  updateTelegramStudentPreferences
} from "./backend-client";
import {
  ATTEND_COMMANDS,
  DECLINE_COMMANDS,
  attendanceLessonKeyboard,
  findLessonByScheduleIndex,
  formatAttendancePrompt,
  formatAttendanceResult,
  isActionableLesson,
  parseLessonIndex,
  type AttendanceIntent
} from "./attendance";
import {
  commandReplyKeyboard,
  commandSuggestionLabels,
  formatHelpMessage,
  registerBotCommands,
  resolveCommandReplyLabel,
  resolveCommandSuggestion
} from "./commands";
import { BotInteraction, answerCallback, replyToUser } from "./interaction-log";
import { log } from "./logger";
import {
  formatBalanceMessage,
  formatNotLinkedMessage,
  formatScheduleMessage,
  resolveProfileTimeZone,
  type BotReply
} from "./messages";
import {
  formatTimezoneSettingsMessage,
  resolveTimezoneCallback,
  resolveTimezoneInput,
  timezoneSettingsKeyboard
} from "./timezone-picker";
import {
  formatNotificationSettingsMessage,
  looksLikeNotificationMinutesInput,
  mergeNotificationMinutes,
  notificationSettingsKeyboard,
  parseNotificationMinutesPayload,
  resolveActiveNotificationMinutes,
  resolveNextNotificationMinutes
} from "./notification-settings";
import {
  ATTENDANCE_SCHEDULE_DAYS,
  DEFAULT_SCHEDULE_DAYS,
  parseScheduleDaysFromPhrase,
  parseScheduleDaysFromPayload,
  resolveScheduleDaysCallback,
  scheduleDaysKeyboard,
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
        await replyWithCommandMenu(
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
              "Выберите действие кнопкой ниже."
            ]
          : [
              `${student.fullName}, Telegram подключен. Теперь сюда будут приходить напоминания о занятиях.`,
              "",
              "Выберите действие кнопкой ниже."
            ];

        await replyWithCommandMenu(ctx, interaction, connectedLines.join("\n"));
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
        await ctx.reply(`${error}\n\nВыберите период:`, {
          reply_markup: scheduleDaysKeyboard(DEFAULT_SCHEDULE_DAYS)
        });
        interaction.noteMessageKind("plain_text");
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

  bot.command(["notifications", "reminders", "напоминания"], async (ctx) => {
    const interaction = new BotInteraction("command:notifications", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        await replyToUser(ctx, interaction, "Настройки напоминаний доступны в личном чате с ботом.");
        return;
      }

      if (ctx.payload?.trim()) {
        await updateNotificationSettingsFromPayload(ctx, interaction, ctx.payload);
        return;
      }

      await replyWithNotificationSettings(ctx, interaction);
    } finally {
      interaction.flush();
    }
  });

  bot.command(["timezone", "tz", "часовойпояс"], async (ctx) => {
    const interaction = new BotInteraction("command:timezone", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        await replyToUser(ctx, interaction, "Часовой пояс можно настроить в личном чате с ботом.");
        return;
      }

      await handleTimezoneCommand(ctx, interaction, ctx.payload);
    } finally {
      interaction.flush();
    }
  });

  bot.command(["help", "помощь"], async (ctx) => {
    const interaction = new BotInteraction("command:help", ctx);

    try {
      const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
      interaction.meta.group = isGroup;
      await replyWithCommandMenu(ctx, interaction, formatHelpMessage(isGroup));
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

  bot.hears(commandSuggestionLabels, async (ctx) => {
    const interaction = new BotInteraction("hears:command_button", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      const text =
        ctx.message && "text" in ctx.message && typeof ctx.message.text === "string" ? ctx.message.text : "";
      const command = resolveCommandReplyLabel(text);
      if (!command) {
        interaction.outcome = "validation_error";
        return;
      }

      interaction.meta.command = command;
      await runCommandSuggestion(ctx, interaction, command);
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

  bot.hears(/^(напоминания|уведомления)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:notifications", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await replyWithNotificationSettings(ctx, interaction);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^(?:напоминания|уведомления)\s+(.+)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:notifications:set", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await updateNotificationSettingsFromPayload(ctx, interaction, ctx.match[1]);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^\d/, async (ctx) => {
    const interaction = new BotInteraction("hears:notifications:minutes", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      const text =
        ctx.message && "text" in ctx.message && typeof ctx.message.text === "string" ? ctx.message.text : "";
      if (!looksLikeNotificationMinutesInput(text)) {
        interaction.outcome = "skipped";
        return;
      }

      await updateNotificationSettingsFromPayload(ctx, interaction, text);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^(?:часовой\s*пояс|timezone|tz)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:timezone", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await handleTimezoneCommand(ctx, interaction);
    } finally {
      interaction.flush();
    }
  });

  bot.hears(/^(?:часовой\s*пояс|timezone|tz)\s+(.+)$/i, async (ctx) => {
    const interaction = new BotInteraction("hears:timezone:set", ctx);

    try {
      if (!isPrivateChat(ctx)) {
        interaction.outcome = "skipped";
        return;
      }

      await handleTimezoneCommand(ctx, interaction, ctx.match[1]);
    } finally {
      interaction.flush();
    }
  });

  bot.action(/^cmd:[a-z]+$/, async (ctx) => {
    const interaction = new BotInteraction("callback:command", ctx);

    try {
      const callbackData =
        "data" in ctx.callbackQuery && typeof ctx.callbackQuery.data === "string"
          ? ctx.callbackQuery.data
          : "";
      const command = resolveCommandSuggestion(callbackData);
      if (!command) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Не удалось распознать команду.", { show_alert: true });
        return;
      }

      interaction.meta.command = command;
      await answerCallback(ctx, interaction, "Ок");
      await runCommandSuggestion(ctx, interaction, command);
    } catch (error) {
      interaction.outcome = "error";
      log.error("Telegram command suggestion callback failed", {
        err: error,
        handler: interaction.handler,
        userId: interaction.userId,
        chatId: interaction.chatId
      });
      await answerCallback(ctx, interaction, "Не удалось выполнить команду.", { show_alert: true }).catch(
        () => undefined
      );
    } finally {
      interaction.flush();
    }
  });

  bot.action(/^sch:d:\d+$/, async (ctx) => {
    const interaction = new BotInteraction("callback:schedule_days", ctx);

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
      const days = resolveScheduleDaysCallback(callbackData);
      if (days === null) {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Не удалось выбрать период.", { show_alert: true });
        return;
      }

      interaction.meta.days = days;
      const profile = await getTelegramStudentProfile(userId, { days });
      const reply = formatScheduleMessage(profile);
      interaction.meta.lessonCount = profile.upcomingLessons.length;
      await answerCallback(ctx, interaction, `Расписание на ${days} дн.`);

      if (typeof reply === "string") {
        await ctx.editMessageText(reply, { reply_markup: scheduleDaysKeyboard(days) }).catch(() => undefined);
        interaction.noteMessageKind("plain_text");
      } else {
        await ctx
          .editMessageText(reply.text, {
            parse_mode: reply.parse_mode,
            reply_markup: scheduleDaysKeyboard(days)
          })
          .catch(() => undefined);
        interaction.noteMessageKind("html_text");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown schedule error";
      if (message.includes("not found")) {
        interaction.outcome = "not_linked";
        await answerCallback(ctx, interaction, "Сначала подключите Telegram по ссылке от преподавателя.", {
          show_alert: true
        });
        return;
      }
      interaction.outcome = "error";
      log.error("Telegram schedule days callback failed", {
        err: error,
        handler: interaction.handler,
        userId: interaction.userId,
        chatId: interaction.chatId
      });
      await answerCallback(ctx, interaction, "Не удалось обновить расписание.", { show_alert: true });
    } finally {
      interaction.flush();
    }
  });

  bot.action(/^tz:(?:s:[a-z0-9]+|r)$/, async (ctx) => {
    const interaction = new BotInteraction("callback:timezone", ctx);

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
      const nextTimezone = resolveTimezoneCallback(callbackData);
      if (nextTimezone === "invalid") {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Не удалось выбрать часовой пояс.", { show_alert: true });
        return;
      }

      const updatedProfile = await updateTelegramStudentPreferences({
        userId,
        timezone: nextTimezone
      });
      await answerCallback(ctx, interaction, "Часовой пояс обновлён.");
      await ctx
        .editMessageText(formatTimezoneSettingsMessage(updatedProfile), {
          reply_markup: timezoneSettingsKeyboard(updatedProfile)
        })
        .catch(() => undefined);
      interaction.noteMessageKind("plain_text");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown timezone settings error";
      if (message.includes("not found")) {
        interaction.outcome = "not_linked";
        await answerCallback(ctx, interaction, "Сначала подключите Telegram по ссылке от преподавателя.", {
          show_alert: true
        });
        return;
      }
      interaction.outcome = "error";
      log.error("Telegram timezone settings callback failed", {
        err: error,
        handler: interaction.handler,
        userId: interaction.userId,
        chatId: interaction.chatId
      });
      await answerCallback(ctx, interaction, "Не удалось обновить часовой пояс.", { show_alert: true });
    } finally {
      interaction.flush();
    }
  });

  bot.action(/^nt:(?:t:\d+|r)$/, async (ctx) => {
    const interaction = new BotInteraction("callback:notifications", ctx);

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
      const profile = await getTelegramStudentProfile(userId);
      const nextMinutes = resolveNextNotificationMinutes(profile, callbackData);

      if (nextMinutes === "empty") {
        interaction.outcome = "validation_error";
        await answerCallback(ctx, interaction, "Оставьте хотя бы одно напоминание.", { show_alert: true });
        return;
      }

      const updatedProfile = await updateTelegramStudentPreferences({
        userId,
        lessonReminderMinutes: nextMinutes
      });
      await answerCallback(ctx, interaction, "Настройки обновлены.");
      await ctx
        .editMessageText(formatNotificationSettingsMessage(updatedProfile), {
          reply_markup: notificationSettingsKeyboard(updatedProfile)
        })
        .catch(() => undefined);
      interaction.noteMessageKind("plain_text");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown notification settings error";
      if (message.includes("not found")) {
        interaction.outcome = "not_linked";
        await answerCallback(ctx, interaction, "Сначала подключите Telegram по ссылке от преподавателя.", {
          show_alert: true
        });
        return;
      }
      interaction.outcome = "error";
      log.error("Telegram notification settings callback failed", {
        err: error,
        handler: interaction.handler,
        userId: interaction.userId,
        chatId: interaction.chatId
      });
      await answerCallback(ctx, interaction, "Не удалось обновить настройки. Попробуйте позже.", {
        show_alert: true
      });
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

      const profile = await getTelegramStudentProfile(userId, { days: ATTENDANCE_SCHEDULE_DAYS });
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

export async function sendLessonReminder(student: Student, lesson: Lesson, timeZone: string): Promise<void> {
  const instance = getTelegramBot();
  if (!instance || !student.telegramChatId) {
    return;
  }

  await instance.telegram.sendMessage(student.telegramChatId, formatLessonReminder(student, lesson, timeZone), {
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
    const keyboard = scheduleDaysKeyboard(days);

    if (typeof reply === "string") {
      await ctx.reply(reply, { reply_markup: keyboard });
      interaction.noteMessageKind("plain_text");
      return;
    }

    await ctx.reply(reply.text, {
      parse_mode: reply.parse_mode,
      reply_markup: keyboard
    });
    interaction.noteMessageKind("html_text");
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

async function replyWithNotificationSettings(ctx: Context, interaction: BotInteraction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId);
    await ctx.reply(formatNotificationSettingsMessage(profile), {
      reply_markup: notificationSettingsKeyboard(profile)
    });
    interaction.noteMessageKind("plain_text");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram notification settings query failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось получить настройки напоминаний. Попробуйте позже.");
  }
}

async function updateNotificationSettingsFromPayload(
  ctx: Context,
  interaction: BotInteraction,
  payload: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  const addedMinutes = parseNotificationMinutesPayload(payload);
  if (!addedMinutes.length) {
    interaction.outcome = "validation_error";
    await replyToUser(ctx, interaction, "Укажите время до занятия, например: 45, 15 мин, 3 ч");
    return;
  }

  try {
    const currentProfile = await getTelegramStudentProfile(userId);
    const minutes = mergeNotificationMinutes(
      resolveActiveNotificationMinutes(currentProfile),
      addedMinutes
    );
    const profile = await updateTelegramStudentPreferences({
      userId,
      lessonReminderMinutes: minutes
    });
    await ctx.reply(formatNotificationSettingsMessage(profile), {
      reply_markup: notificationSettingsKeyboard(profile)
    });
    interaction.noteMessageKind("plain_text");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown profile error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram notification settings update failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось обновить настройки напоминаний. Попробуйте позже.");
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
    const profile = await getTelegramStudentProfile(userId, { days: ATTENDANCE_SCHEDULE_DAYS });

    if (!index) {
      interaction.meta.mode = "prompt";
      await replyWithAttendancePrompt(ctx, interaction, profile, intent);
      return;
    }

    const lesson = findLessonByScheduleIndex(profile, index);
    if (!lesson) {
      interaction.outcome = "validation_error";
      interaction.meta.mode = "not_found";
      await replyWithAttendancePrompt(
        ctx,
        interaction,
        profile,
        intent,
        `Занятие №${index} не найдено.`
      );
      return;
    }

    if (!isActionableLesson(lesson, profile.student.id)) {
      interaction.outcome = "validation_error";
      interaction.meta.mode = "not_actionable";
      await replyWithAttendancePrompt(
        ctx,
        interaction,
        profile,
        intent,
        `Занятие №${index} недоступно для изменения.`
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

    await replyToUser(
      ctx,
      interaction,
      formatAttendanceResult(updated, profile.student.id, intent, resolveProfileTimeZone(profile))
    );
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

async function replyWithAttendancePrompt(
  ctx: Context,
  interaction: BotInteraction,
  profile: TelegramStudentProfile,
  intent: AttendanceIntent,
  prefix?: string
): Promise<void> {
  const text = [prefix, formatAttendancePrompt(profile, intent)].filter(Boolean).join("\n\n");
  const keyboard = attendanceLessonKeyboard(profile, intent);
  await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
  interaction.noteMessageKind("plain_text");
}

async function replyWithCommandMenu(
  ctx: Context,
  interaction: BotInteraction,
  text: string
): Promise<void> {
  await ctx.reply(text, { reply_markup: commandReplyKeyboard() });
  interaction.noteMessageKind("plain_text");
}

async function runCommandSuggestion(
  ctx: Context,
  interaction: BotInteraction,
  command: string
): Promise<void> {
  if (command === "help") {
    const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
    await replyWithCommandMenu(ctx, interaction, formatHelpMessage(isGroup));
    return;
  }

  if (command === "schedule") {
    interaction.meta.days = DEFAULT_SCHEDULE_DAYS;
    await replyWithSchedule(ctx, interaction, DEFAULT_SCHEDULE_DAYS);
    return;
  }

  if (command === "balance") {
    await replyWithProfile(ctx, interaction, formatBalanceMessage);
    return;
  }

  if (command === "notifications") {
    if (!isPrivateChat(ctx)) {
      interaction.outcome = "skipped";
      await replyToUser(ctx, interaction, "Настройки напоминаний доступны в личном чате с ботом.");
      return;
    }
    await replyWithNotificationSettings(ctx, interaction);
    return;
  }

  if (command === "timezone") {
    if (!isPrivateChat(ctx)) {
      interaction.outcome = "skipped";
      await replyToUser(ctx, interaction, "Часовой пояс можно настроить в личном чате с ботом.");
      return;
    }
    await handleTimezoneCommand(ctx, interaction);
    return;
  }

  if (command === "attend") {
    await replyWithAttendance(ctx, interaction, "confirmed");
    return;
  }

  if (command === "decline") {
    await replyWithAttendance(ctx, interaction, "declined");
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

async function handleTimezoneCommand(
  ctx: Context,
  interaction: BotInteraction,
  payload?: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  const raw = payload?.trim();
  try {
    if (!raw) {
      await replyWithTimezoneSettings(ctx, interaction);
      return;
    }

    const resolved = resolveTimezoneInput(raw);
    if (!resolved) {
      interaction.outcome = "validation_error";
      await replyWithTimezoneSettings(
        ctx,
        interaction,
        "Не удалось распознать часовой пояс. Выберите город кнопкой или напишите, например: Москва."
      );
      return;
    }

    const profile = await updateTelegramStudentPreferences({
      userId,
      timezone: resolved === "reset" ? null : resolved
    });
    const prefix =
      resolved === "reset"
        ? "Часовой пояс сброшен к настройкам преподавателя."
        : "Часовой пояс обновлён.";
    await ctx.reply(formatTimezoneSettingsMessage(profile, prefix), {
      reply_markup: timezoneSettingsKeyboard(profile)
    });
    interaction.noteMessageKind("plain_text");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown timezone error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram timezone command failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось обновить часовой пояс. Попробуйте позже.");
  }
}

async function replyWithTimezoneSettings(
  ctx: Context,
  interaction: BotInteraction,
  prefix?: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    interaction.outcome = "skipped";
    return;
  }

  try {
    const profile = await getTelegramStudentProfile(userId);
    await ctx.reply(formatTimezoneSettingsMessage(profile, prefix), {
      reply_markup: timezoneSettingsKeyboard(profile)
    });
    interaction.noteMessageKind("plain_text");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown timezone error";
    if (message.includes("not found")) {
      interaction.outcome = "not_linked";
      await replyToUser(ctx, interaction, formatNotLinkedMessage());
      return;
    }
    interaction.outcome = "error";
    log.error("Telegram timezone settings query failed", {
      err: error,
      handler: interaction.handler,
      userId: interaction.userId,
      chatId: interaction.chatId
    });
    await replyToUser(ctx, interaction, "Не удалось получить настройки часового пояса. Попробуйте позже.");
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
