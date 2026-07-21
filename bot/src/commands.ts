import type { BotCommand, InlineKeyboardMarkup, ReplyKeyboardMarkup } from "@telegraf/types";
import type { Telegram } from "telegraf";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Расписание — выбрать период кнопкой" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "notifications", description: "Настроить напоминания (/notifications 45, 120)" },
  { command: "timezone", description: "Выбрать часовой пояс кнопкой или городом" },
  { command: "attend", description: "Подтвердить занятие — выбрать кнопкой" },
  { command: "decline", description: "Отказаться от занятия — выбрать кнопкой" },
  { command: "help", description: "Список команд" }
];

type CommandSuggestion = {
  id: string;
  label: string;
};

const commandSuggestions: CommandSuggestion[] = [
  { id: "schedule", label: "📅 Расписание" },
  { id: "balance", label: "💰 Баланс" },
  { id: "attend", label: "👍 Буду" },
  { id: "decline", label: "👎 Не буду" },
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
      [{ text: "👍 Буду" }, { text: "👎 Не буду" }],
      [{ text: "🔔 Напоминания" }, { text: "🌍 Часовой пояс" }],
      [{ text: "❓ Помощь" }]
    ],
    resize_keyboard: true,
    is_persistent: true
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
    "Расписание: /schedule — период можно выбрать кнопками 7/14/30/60.",
    "Напоминания: /notifications — выбрать интервалы, /notifications 45, 120 — задать свои минуты.",
    "Часовой пояс: /timezone — выбрать город кнопкой, или напишите «Москва», «Минск».",
    "Работает и /shedule (с опечаткой).",
    "Ответ по занятию: /attend или /decline — выбрать занятие кнопкой.",
    "",
    "Можно нажать кнопку под полем ввода."
  ];

  if (isGroup) {
    lines.push("", "В группе используйте команды с упоминанием бота, например /schedule@имя_бота.");
  } else {
    lines.push(
      "",
      "Можно также написать: «расписание», «баланс», «сколько осталось», «буду 1», «не буду 1», «часовой пояс»."
    );
  }

  return lines.join("\n");
}

async function registerBotCommands(telegram: Telegram): Promise<void> {
  const scopes = [{ type: "all_private_chats" as const }, { type: "all_group_chats" as const }];

  for (const scope of scopes) {
    await telegram.setMyCommands(botCommands, { scope });
    await telegram.setMyCommands(botCommands, { scope, language_code: "ru" });
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
