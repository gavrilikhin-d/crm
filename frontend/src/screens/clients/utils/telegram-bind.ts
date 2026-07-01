import type { Student } from "@crm/shared";

export function getTelegramBindUrl(student: Student): string | undefined {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!username) {
    return undefined;
  }

  return `https://t.me/${username}?start=${student.telegramBindToken}`;
}
