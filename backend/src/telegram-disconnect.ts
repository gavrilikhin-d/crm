type TelegramDisconnectTarget = {
  chatId: string;
};

const TELEGRAM_API_TIMEOUT_MS = 5_000;
const DISCONNECT_MESSAGE =
  "Аккаунт преподавателя удалён. Telegram-подключение к CRM отключено, напоминания больше не будут приходить.";

export async function notifyTelegramDisconnects(targets: TelegramDisconnectTarget[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !targets.length) {
    return;
  }

  const chatIds = [...new Set(targets.map((target) => target.chatId).filter(Boolean))];
  const results = await Promise.allSettled(
    chatIds.map((chatId) => sendTelegramDisconnectMessage(token, chatId))
  );
  const failed = results.filter((result) => result.status === "rejected").length;

  if (failed) {
    console.warn(`[account-delete] Failed to notify ${failed} Telegram chat(s) about disconnect`);
  }
}

async function sendTelegramDisconnectMessage(token: string, chatId: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: DISCONNECT_MESSAGE
    }),
    signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Telegram disconnect notification failed: ${response.status}`);
  }
}
