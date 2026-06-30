import type { BotCommand } from "@telegraf/types";
import type { Telegram } from "telegraf";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Занятия на 7 дней (/schedule 14)" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "attend", description: "Подтвердить занятие (/attend 1)" },
  { command: "decline", description: "Отказаться от занятия (/decline 1)" },
  { command: "help", description: "Список команд" }
];

function formatHelpMessage(isGroup = false): string {
  const lines = [
    "Доступные команды:",
    ...botCommands.map((item) => `/${item.command} — ${item.description}`),
    "",
    "Расписание: /schedule или /schedule 14 — на 14 дней.",
    "Работает и /shedule (с опечаткой).",
    "Ответ по занятию: /attend 1 или /decline 1 — без нового напоминания."
  ];

  if (isGroup) {
    lines.push("", "В группе используйте команды с упоминанием бота, например /schedule@имя_бота.");
  } else {
    lines.push("", "Можно также написать: «расписание», «баланс», «сколько осталось», «буду 1», «не буду 1».");
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

export { botCommands, formatHelpMessage, registerBotCommands };
