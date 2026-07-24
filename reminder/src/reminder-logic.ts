function shouldSendManualPaymentReminder(input: {
  balance?: { remainingLessons: number; debtLessons: number };
  telegramChatId?: string;
}): { send: true } | { send: false; reason: string } {
  const balance = input.balance;
  const hasNoPaidLessons = (balance?.remainingLessons ?? 0) < 1;
  const unpaidLessons = balance?.debtLessons ?? 0;

  if (!balance || (!hasNoPaidLessons && unpaidLessons <= 0)) {
    return { send: false, reason: "У ученика есть оплаченные занятия на балансе." };
  }

  if (!input.telegramChatId) {
    return { send: false, reason: "У ученика не указан Telegram chat id." };
  }

  return { send: true };
}

export { shouldSendManualPaymentReminder };
