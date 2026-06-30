import { canStudentChangeParticipantStatus } from "@crm/shared/lesson-attendance";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";

const ATTEND_COMMANDS = ["attend"] as const;
const DECLINE_COMMANDS = ["decline"] as const;

type AttendanceIntent = "confirmed" | "declined";

function parseLessonIndex(payload?: string): { index?: number; error?: string } {
  const raw = payload?.trim().split(/\s+/)[0];
  if (!raw) {
    return {};
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return { error: "Укажите номер занятия из списка, например: /attend 1" };
  }

  return { index: parsed };
}

function actionableLessons(profile: TelegramStudentProfile): Lesson[] {
  return profile.upcomingLessons.filter((lesson) => isActionableLesson(lesson, profile.student.id));
}

function isActionableLesson(lesson: Lesson, studentId: string): boolean {
  if (!canStudentChangeParticipantStatus(lesson)) {
    return false;
  }

  return lesson.participants.some((participant) => participant.studentId === studentId);
}

function findLessonByScheduleIndex(profile: TelegramStudentProfile, index: number): Lesson | undefined {
  return profile.upcomingLessons[index - 1];
}

function formatAttendancePrompt(profile: TelegramStudentProfile, intent: AttendanceIntent): string {
  const verb = intent === "confirmed" ? "подтвердить" : "отказаться от";

  if (!profile.upcomingLessons.length) {
    return "На ближайшие дни нет занятий, для которых можно изменить ответ.";
  }

  const lines = profile.upcomingLessons.map((lesson, index) => {
    const participant = lesson.participants.find((item) => item.studentId === profile.student.id);
    const when = formatLessonWhen(new Date(lesson.startsAt));
    const status = formatParticipantStatus(participant?.status);
    const actionable = isActionableLesson(lesson, profile.student.id);
    const suffix = !actionable ? " — недоступно" : status ? ` — ${status}` : "";
    return `${index + 1}. ${when}${suffix}`;
  });

  const command = intent === "confirmed" ? "/attend" : "/decline";

  return [
    `Выберите занятие, чтобы ${verb} (номера как в /schedule):`,
    "",
    ...lines,
    "",
    `Пример: ${command} 1`
  ].join("\n");
}

function formatAttendanceResult(lesson: Lesson, studentId: string, intent: AttendanceIntent): string {
  const when = formatLessonWhen(new Date(lesson.startsAt));
  const label = intent === "confirmed" ? "буду" : "не буду";
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const debt = participant?.hasDebt ? "\n⚠️ По балансу нет оплаченного занятия." : "";

  return `${when}: ${label}.${debt}`;
}

function formatLessonWhen(startsAt: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(startsAt);
}

function formatParticipantStatus(status: string | undefined): string | undefined {
  if (status === "confirmed") {
    return "буду";
  }
  if (status === "declined") {
    return "не буду";
  }
  if (status === "awaiting") {
    return "ожидает ответа";
  }

  return undefined;
}

export {
  ATTEND_COMMANDS,
  DECLINE_COMMANDS,
  actionableLessons,
  findLessonByScheduleIndex,
  formatAttendancePrompt,
  formatAttendanceResult,
  isActionableLesson,
  parseLessonIndex,
  type AttendanceIntent
};
