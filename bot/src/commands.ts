import type { BotCommand } from "@telegraf/types";
import type { Telegram } from "telegraf";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Занятия на 7 дней (/schedule 14)" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "help", description: "Список команд" }
];

function formatHelpMessage(): string {
  return [
    "Доступные команды:",
    ...botCommands.map((item) => `/${item.command} — ${item.description}`),
    "",
    "Расписание: /schedule или /schedule 14 — на 14 дней.",
    "Работает и /shedule (с опечаткой).",
    "Можно также написать: «расписание», «баланс», «сколько осталось»."
  ].join("\n");
}

async function registerBotCommands(telegram: Telegram): Promise<void> {
  const scope = { type: "all_private_chats" as const };

  await telegram.setMyCommands(botCommands, { scope });
  await telegram.setMyCommands(botCommands, { scope, language_code: "ru" });
}

export { botCommands, formatHelpMessage, registerBotCommands };
