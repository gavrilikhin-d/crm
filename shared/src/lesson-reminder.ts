import type { Lesson, ParticipantStatus } from "./types";
import { encodeLessonCallback } from "./lesson-callback";

export type LessonReminderParticipant = {
  studentId: string;
  fullName: string;
  status: ParticipantStatus;
  hasDebt: boolean;
};

export function isTelegramGroupChat(chatId: string | number): boolean {
  return Number(chatId) < 0;
}

export function formatLessonReminderText(
  lesson: Lesson,
  participants: LessonReminderParticipant[],
  options?: { isGroupChat?: boolean }
): string {
  const date = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(lesson.startsAt));

  const kind = lesson.effectiveType === "group" ? "групповое" : "индивидуальное";
  const useGroupFormat = options?.isGroupChat || participants.length > 1;

  if (!useGroupFormat && participants.length === 1) {
    const participant = participants[0];
    const paymentLine = participant.hasDebt
      ? "Важно: по балансу нет оплаченного занятия, пожалуйста, не забудьте оплату."
      : undefined;

    return [
      `${participant.fullName}, напоминаем о занятии.`,
      `Когда: ${date}`,
      `Формат: ${kind}`,
      paymentLine,
      "Пожалуйста, подтвердите участие."
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = ["Напоминаем о занятии.", `Когда: ${date}`, `Формат: ${kind}`, "", "Подтвердите участие:"];

  for (const participant of participants) {
    lines.push(`• ${participant.fullName} — ${formatParticipantReminderStatus(participant.status)}`);
    if (participant.hasDebt) {
      lines.push("  ⚠️ нет оплаты");
    }
  }

  return lines.join("\n");
}

export function buildLessonReminderKeyboard(lessonId: string, participants: LessonReminderParticipant[]) {
  const rows = participants
    .filter((participant) => participant.status === "awaiting")
    .map((participant) => {
      const label = shortenStudentName(participant.fullName, participants.length > 1);
      return [
        { text: `👍 ${label}`, callback_data: encodeLessonCallback("attend", lessonId, participant.studentId) },
        { text: `👎 ${label}`, callback_data: encodeLessonCallback("decline", lessonId, participant.studentId) }
      ];
    });

  if (!rows.length) {
    return undefined;
  }

  return { inline_keyboard: rows };
}

function formatParticipantReminderStatus(status: ParticipantStatus): string {
  switch (status) {
    case "confirmed":
      return "✓ будете";
    case "declined":
      return "✗ не будете";
    case "awaiting":
      return "ожидает ответа";
    case "attended":
      return "✓ были";
    case "missed":
      return "✗ пропустили";
    default:
      return status;
  }
}

function shortenStudentName(fullName: string, forceShort: boolean): string {
  const parts = fullName.trim().split(/\s+/);
  if (forceShort && parts.length >= 2) {
    return parts[0];
  }

  return fullName.length > 16 ? `${fullName.slice(0, 15)}…` : fullName;
}
