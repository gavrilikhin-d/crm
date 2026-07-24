import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import { formatLessonWhenInTimeZone, resolveNotificationTimeZone } from "@crm/shared/timezone";

type BotReply = string | { text: string; parse_mode: "HTML" };

function formatBalanceMessage(profile: TelegramStudentProfile): BotReply {
  const { balance } = profile;
  const lines = [`<b>${escapeHtml(profile.student.fullName)}</b>`];
  if (profile.teachers.length > 1) {
    lines.push(`Преподаватель: <b>${escapeHtml(profile.teacher.name)}</b>`);
  }

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
  const timeZone = resolveProfileTimeZone(profile);
  const identity =
    profile.teachers.length > 1
      ? `<i>${escapeHtml(profile.student.fullName)} · ${escapeHtml(profile.teacher.name)}</i>`
      : `<i>${escapeHtml(profile.student.fullName)}</i>`;

  if (!profile.upcomingLessons.length) {
    return {
      text: [
        header,
        identity,
        "",
        `На ближайшие ${days} ${pluralDays(days)} занятий нет.`,
        "",
        `<i>Другой период — кнопки ниже</i>`
      ].join("\n"),
      parse_mode: "HTML"
    };
  }

  const now = new Date();
  const blocks = profile.upcomingLessons.map((lesson, index) =>
    formatLessonBlock(index + 1, profile.student.id, lesson, now, timeZone)
  );

  return {
    text: [
      header,
      identity,
      "",
      ...blocks,
      "",
      `<i>Другой период — кнопки ниже</i>`,
      `<i>Ответ: кнопки 👍/👎 или «буду 1» / «не буду 1»</i>`
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

function formatLessonBlock(
  index: number,
  studentId: string,
  lesson: Lesson,
  now: Date,
  timeZone: string
): string {
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const when = formatLessonWhenInTimeZone(lesson.startsAt, lesson.durationMinutes, timeZone, now);
  const kind = lesson.effectiveType === "group" ? "Групповое" : "Индивидуальное";
  const tags = formatLessonTags(participant, lesson.status);

  return [`<b>${index}. ${escapeHtml(when)}</b>`, `${kind}${tags.length ? `\n${tags.join(" · ")}` : ""}`].join("\n");
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

function resolveProfileTimeZone(profile: TelegramStudentProfile): string {
  return resolveNotificationTimeZone({
    studentTimeZone: profile.student.timezone,
    teacherTimeZone: profile.settings.timezone
  });
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

export {
  formatBalanceMessage,
  formatNotLinkedMessage,
  formatScheduleMessage,
  resolveProfileTimeZone,
  type BotReply
};
