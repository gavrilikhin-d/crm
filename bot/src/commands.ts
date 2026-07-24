import type { BotCommand, InlineKeyboardMarkup, ReplyKeyboardMarkup } from "@telegraf/types";
import type { Telegram } from "telegraf";

const TEACHER_REPLY_LABEL = "👩‍🏫 Преподаватель";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Расписание — период и ответ по занятию" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "notifications", description: "Настроить напоминания — кнопки или минуты" },
  { command: "timezone", description: "Выбрать часовой пояс кнопкой или городом" },
  { command: "help", description: "Список команд" }
];

const teacherBotCommand: BotCommand = {
  command: "teacher",
  description: "Сменить преподавателя, если их несколько"
};

type CommandSuggestion = {
  id: string;
  label: string;
};

const commandSuggestions: CommandSuggestion[] = [
  { id: "schedule", label: "📅 Расписание" },
  { id: "balance", label: "💰 Баланс" },
  { id: "notifications", label: "🔔 Напоминания" },
  { id: "timezone", label: "🌍 Часовой пояс" },
  { id: "teacher", label: TEACHER_REPLY_LABEL },
  { id: "help", label: "❓ Помощь" }
];

const commandSuggestionLabels = commandSuggestions.map((item) => item.label);

function commandSuggestionsKeyboard(options?: { showTeacherSwitch?: boolean }): InlineKeyboardMarkup {
  const suggestions = options?.showTeacherSwitch
    ? commandSuggestions
    : commandSuggestions.filter((item) => item.id !== "teacher");
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  for (let index = 0; index < suggestions.length; index += 2) {
    const left = suggestions[index]!;
    const right = suggestions[index + 1];
    const row = [{ text: left.label, callback_data: `cmd:${left.id}` }];
    if (right) {
      row.push({ text: right.label, callback_data: `cmd:${right.id}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

function commandReplyKeyboard(options?: { showTeacherSwitch?: boolean }): ReplyKeyboardMarkup {
  const keyboard: ReplyKeyboardMarkup["keyboard"] = [
    [{ text: "📅 Расписание" }, { text: "💰 Баланс" }],
    [{ text: "🔔 Напоминания" }, { text: "🌍 Часовой пояс" }]
  ];
  if (options?.showTeacherSwitch) {
    keyboard.push([{ text: TEACHER_REPLY_LABEL }]);
  }
  return {
    keyboard,
    resize_keyboard: true
  };
}

function resolveCommandSuggestion(callbackData: string): string | null {
  const match = callbackData.match(/^cmd:([a-z]+)$/);
  if (!match) {
    return null;
  }

  return commandSuggestions.some((item) => item.id === match[1]) ? match[1]! : null;
}

function resolveCommandReplyLabel(text: string): string | null {
  const normalized = text.trim();
  return commandSuggestions.find((item) => item.label === normalized)?.id ?? null;
}

function formatHelpMessage(isGroup = false, options?: { showTeacherSwitch?: boolean }): string {
  const commands = options?.showTeacherSwitch ? [...botCommands, teacherBotCommand] : botCommands;
  const lines = [
    "Доступные команды:",
    ...commands.map((item) => `/${item.command} — ${item.description}`),
    "",
    "Расписание: /schedule — период кнопками 7/14/30/60, ответ по занятию кнопками или «буду 1» / «не буду 1».",
    "Напоминания: /notifications — выбрать интервалы, или напишите: 45, 15 мин, 3 ч.",
    "Часовой пояс: /timezone — выбрать город кнопкой, или напишите «Москва», «Минск».",
    "Работает и /shedule (с опечаткой).",
    "",
    "Можно нажать кнопку под полем ввода."
  ];

  if (isGroup) {
    lines.push("", "В группе используйте команды с упоминанием бота, например /schedule@имя_бота.");
  } else {
    const natural = [
      "«расписание»",
      "«баланс»",
      "«сколько осталось»",
      "«буду 1»",
      "«не буду 1»",
      "«часовой пояс»",
      ...(options?.showTeacherSwitch ? ["«преподаватель»"] : []),
      "или время напоминания: «45», «15 мин», «3 ч»"
    ];
    lines.push("", `Можно также написать: ${natural.join(", ")}.`);
  }

  return lines.join("\n");
}

async function registerBotCommands(telegram: Telegram): Promise<void> {
  // Default scope + chat scopes. Also clear stale language-specific lists so removed
  // commands like /attend and /decline disappear from Telegram's "/" menu.
  const scopeOptions: Array<{ scope?: { type: "all_private_chats" | "all_group_chats" } }> = [
    {},
    { scope: { type: "all_private_chats" } },
    { scope: { type: "all_group_chats" } }
  ];

  for (const options of scopeOptions) {
    await telegram.deleteMyCommands(options).catch(() => undefined);
    await telegram.deleteMyCommands({ ...options, language_code: "ru" }).catch(() => undefined);
    await telegram.deleteMyCommands({ ...options, language_code: "en" }).catch(() => undefined);
    await telegram.setMyCommands(botCommands, options);
    await telegram.setMyCommands(botCommands, { ...options, language_code: "ru" });
  }
}

export {
  TEACHER_REPLY_LABEL,
  botCommands,
  commandReplyKeyboard,
  commandSuggestionLabels,
  commandSuggestionsKeyboard,
  formatHelpMessage,
  registerBotCommands,
  resolveCommandReplyLabel,
  resolveCommandSuggestion
};
