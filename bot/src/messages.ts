import type { Lesson, TelegramStudentProfile } from "@crm/shared";

type BotReply = string | { text: string; parse_mode: "HTML" };

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "numeric", minute: "2-digit" });

function formatBalanceMessage(profile: TelegramStudentProfile): BotReply {
  const { balance } = profile;
  const lines = [`<b>${escapeHtml(profile.student.fullName)}</b>`];

  if (balance.remainingLessons > 0) {
    lines.push(`Осталось занятий: <b>${balance.remainingLessons}</b>`);
  } else {
    lines.push("Оплаченных занятий не осталось.");
  }

  if (balance.debtLessons > 0) {
    lines.push(`⚠️ Долг: <b>${balance.debtLessons}</b> ${pluralLessons(balance.debtLessons)}`);
  }

  return { text: lines.join("\n"), parse_mode: "HTML" };
}

function formatScheduleMessage(profile: TelegramStudentProfile): BotReply {
  const days = profile.scheduleDays;
  const header = `📅 <b>Занятия на ${days} ${pluralDays(days)}</b>`;

  if (!profile.upcomingLessons.length) {
    return {
      text: [
        header,
        "",
        `На ближайшие ${days} ${pluralDays(days)} занятий нет.`,
        "",
        `<i>Другой период: /schedule 14</i>`
      ].join("\n"),
      parse_mode: "HTML"
    };
  }

  const now = new Date();
  const blocks = profile.upcomingLessons.map((lesson) => formatLessonBlock(profile.student.id, lesson, now));

  return {
    text: [
      header,
      `<i>${escapeHtml(profile.student.fullName)}</i>`,
      "",
      ...blocks,
      "",
      `<i>Другой период: /schedule 14</i>`
    ].join("\n\n"),
    parse_mode: "HTML"
  };
}

function formatNotLinkedMessage(): string {
  return [
    "Telegram ещё не подключен к вашему профилю.",
    "Попросите преподавателя прислать персональную ссылку из CRM и откройте её здесь."
  ].join("\n");
}

function formatLessonBlock(studentId: string, lesson: Lesson, now: Date): string {
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const when = formatLessonWhen(new Date(lesson.startsAt), now);
  const kind = lesson.effectiveType === "group" ? "Групповое" : "Индивидуальное";
  const tags = formatLessonTags(participant, lesson.status);

  return [`<b>${escapeHtml(when)}</b>`, `${kind}${tags.length ? `\n${tags.join(" · ")}` : ""}`].join("\n");
}

function formatLessonWhen(startsAt: Date, now: Date): string {
  const time = timeFormatter.format(startsAt);

  if (sameDay(startsAt, now)) {
    return `Сегодня · ${time}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(startsAt, tomorrow)) {
    return `Завтра · ${time}`;
  }

  const weekday = capitalize(weekdayFormatter.format(startsAt));
  const dayMonth = dayMonthFormatter.format(startsAt);
  return `${weekday}, ${dayMonth} · ${time}`;
}

function formatLessonTags(
  participant: Lesson["participants"][number] | undefined,
  lessonStatus: Lesson["status"]
): string[] {
  const tags: string[] = [];

  if (lessonStatus === "cancelled_by_student") {
    tags.push("отменено");
  } else if (participant?.status === "confirmed") {
    tags.push("✓ подтверждено");
  } else if (participant?.status === "declined") {
    tags.push("✗ не будете");
  } else if (participant?.status === "awaiting") {
    tags.push("ожидает ответа");
  }

  if (participant?.hasDebt) {
    tags.push("⚠️ нет оплаты");
  }

  return tags;
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }
  return "дней";
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

export { formatBalanceMessage, formatNotLinkedMessage, formatScheduleMessage, type BotReply };
