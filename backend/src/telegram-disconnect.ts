type TelegramDisconnectTarget = {
  chatId: string;
};

const TELEGRAM_API_TIMEOUT_MS = 5_000;

function formatTelegramDisconnectMessage(teacherName: string): string {
  return `Аккаунт преподавателя ${teacherName} удалён. Telegram-подключение к CRM отключено, напоминания больше не будут приходить.`;
}

export async function notifyTelegramDisconnects(
  targets: TelegramDisconnectTarget[],
  teacherName: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !targets.length) {
    return;
  }

  const chatIds = [...new Set(targets.map((target) => target.chatId).filter(Boolean))];
  const text = formatTelegramDisconnectMessage(teacherName);
  const results = await Promise.allSettled(
    chatIds.map((chatId) => sendTelegramDisconnectMessage(token, chatId, text))
  );
  const failed = results.filter((result) => result.status === "rejected").length;

  if (failed) {
    console.warn(`[account-delete] Failed to notify ${failed} Telegram chat(s) about disconnect`);
  }
}

async function sendTelegramDisconnectMessage(token: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    }),
    signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Telegram disconnect notification failed: ${response.status}`);
  }
}

export { formatTelegramDisconnectMessage };
