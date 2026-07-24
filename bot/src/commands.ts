import type { BotCommand, InlineKeyboardMarkup, ReplyKeyboardMarkup } from "@telegraf/types";
import type { Telegram } from "telegraf";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Расписание — период и ответ по занятию" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "notifications", description: "Настроить напоминания — кнопки или минуты" },
  { command: "timezone", description: "Выбрать часовой пояс кнопкой или городом" },
  { command: "help", description: "Список команд" }
];

type CommandSuggestion = {
  id: string;
  label: string;
};

const commandSuggestions: CommandSuggestion[] = [
  { id: "schedule", label: "📅 Расписание" },
  { id: "balance", label: "💰 Баланс" },
  { id: "notifications", label: "🔔 Напоминания" },
  { id: "timezone", label: "🌍 Часовой пояс" },
  { id: "help", label: "❓ Помощь" }
];

const commandSuggestionLabels = commandSuggestions.map((item) => item.label);

function commandSuggestionsKeyboard(): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  for (let index = 0; index < commandSuggestions.length; index += 2) {
    const left = commandSuggestions[index]!;
    const right = commandSuggestions[index + 1];
    const row = [{ text: left.label, callback_data: `cmd:${left.id}` }];
    if (right) {
      row.push({ text: right.label, callback_data: `cmd:${right.id}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

function commandReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "📅 Расписание" }, { text: "💰 Баланс" }],
      [{ text: "🔔 Напоминания" }, { text: "🌍 Часовой пояс" }]
    ],
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

function formatHelpMessage(isGroup = false): string {
  const lines = [
    "Доступные команды:",
    ...botCommands.map((item) => `/${item.command} — ${item.description}`),
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
    lines.push(
      "",
      "Можно также написать: «расписание», «баланс», «сколько осталось», «буду 1», «не буду 1», «часовой пояс», или время напоминания: «45», «15 мин», «3 ч»."
    );
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
  botCommands,
  commandReplyKeyboard,
  commandSuggestionLabels,
  commandSuggestionsKeyboard,
  formatHelpMessage,
  registerBotCommands,
  resolveCommandReplyLabel,
  resolveCommandSuggestion
};
