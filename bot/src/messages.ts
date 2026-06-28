import type { Lesson, TelegramStudentProfile } from "@crm/shared";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatBalanceMessage(profile: TelegramStudentProfile): string {
  const { balance } = profile;
  const lines = [`${profile.student.fullName}, ваш баланс:`];

  if (balance.remainingLessons > 0) {
    lines.push(`Осталось занятий: ${balance.remainingLessons}`);
  } else {
    lines.push("Оплаченных занятий не осталось.");
  }

  if (balance.debtLessons > 0) {
    lines.push(`Долг: ${balance.debtLessons} ${pluralLessons(balance.debtLessons)}`);
  }

  lines.push("", "Команды: /schedule — расписание, /help — помощь");
  return lines.join("\n");
}

function formatScheduleMessage(profile: TelegramStudentProfile): string {
  const lines = [`${profile.student.fullName}, ближайшие занятия:`];

  if (!profile.upcomingLessons.length) {
    lines.push("", "Предстоящих занятий нет.");
    lines.push("", "Команды: /balance — баланс, /help — помощь");
    return lines.join("\n");
  }

  for (const [index, lesson] of profile.upcomingLessons.entries()) {
    lines.push("", `${index + 1}. ${formatLessonLine(profile.student.id, lesson)}`);
  }

  lines.push("", "Команды: /balance — баланс, /help — помощь");
  return lines.join("\n");
}

function formatNotLinkedMessage(): string {
  return [
    "Telegram ещё не подключен к вашему профилю.",
    "Попросите преподавателя прислать персональную ссылку из CRM и откройте её здесь."
  ].join("\n");
}

function formatLessonLine(studentId: string, lesson: Lesson): string {
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const date = dateFormatter.format(new Date(lesson.startsAt));
  const kind = lesson.effectiveType === "group" ? "групповое" : "индивидуальное";
  const details = [`${date}`, kind];

  if (participant?.hasDebt) {
    details.push("нет оплаты");
  }

  if (lesson.status === "cancelled_by_student") {
    details.push("отменено");
  } else if (participant?.status === "confirmed") {
    details.push("вы подтвердили");
  } else if (participant?.status === "declined") {
    details.push("вы отказались");
  }

  return details.join(" · ");
}

function pluralLessons(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "занятие";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "занятия";
  }
  return "занятий";
}

export {
  formatBalanceMessage,
  formatNotLinkedMessage,
  formatScheduleMessage
};
