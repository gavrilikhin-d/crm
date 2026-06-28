import type { BotCommand } from "@telegraf/types";
import type { Telegram } from "telegraf";

const botCommands: BotCommand[] = [
  { command: "start", description: "Подключить Telegram и открыть меню" },
  { command: "schedule", description: "Ближайшие занятия" },
  { command: "balance", description: "Сколько занятий осталось" },
  { command: "help", description: "Список команд" }
];

function formatHelpMessage(): string {
  return [
    "Доступные команды:",
    ...botCommands.map((item) => `/${item.command} — ${item.description}`),
    "",
    "Можно также написать: «расписание», «баланс», «сколько осталось»."
  ].join("\n");
}

async function registerBotCommands(telegram: Telegram): Promise<void> {
  const scope = { type: "all_private_chats" as const };

  await telegram.setMyCommands(botCommands, { scope });
  await telegram.setMyCommands(botCommands, { scope, language_code: "ru" });
}

export { botCommands, formatHelpMessage, registerBotCommands };
