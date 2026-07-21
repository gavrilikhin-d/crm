import type { InlineKeyboardMarkup } from "@telegraf/types";
import { canStudentChangeParticipantStatus } from "@crm/shared/lesson-attendance";
import { encodeLessonCallback } from "@crm/shared/lesson-callback";
import { formatAttendanceWhenInTimeZone } from "@crm/shared/timezone";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import { resolveProfileTimeZone } from "./messages";

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

  const timeZone = resolveProfileTimeZone(profile);
  const lines = profile.upcomingLessons.map((lesson, index) => {
    const participant = lesson.participants.find((item) => item.studentId === profile.student.id);
    const when = formatAttendanceWhenInTimeZone(lesson.startsAt, timeZone);
    const status = formatParticipantStatus(participant?.status);
    const actionable = isActionableLesson(lesson, profile.student.id);
    const suffix = !actionable ? " — недоступно" : status ? ` — ${status}` : "";
    return `${index + 1}. ${when}${suffix}`;
  });

  const hasActionable = actionableLessons(profile).length > 0;
  return [
    `Выберите занятие, чтобы ${verb}:`,
    "",
    ...lines,
    "",
    hasActionable ? "Нажмите кнопку ниже." : "Сейчас нет доступных занятий для ответа."
  ].join("\n");
}

function attendanceLessonKeyboard(
  profile: TelegramStudentProfile,
  intent: AttendanceIntent
): InlineKeyboardMarkup | undefined {
  const action = intent === "confirmed" ? "attend" : "decline";
  const timeZone = resolveProfileTimeZone(profile);
  const rows = profile.upcomingLessons.flatMap((lesson, index) => {
    if (!isActionableLesson(lesson, profile.student.id)) {
      return [];
    }

    const when = formatAttendanceWhenInTimeZone(lesson.startsAt, timeZone);
    const prefix = intent === "confirmed" ? "👍" : "👎";
    return [
      [
        {
          text: `${prefix} ${index + 1}. ${when}`,
          callback_data: encodeLessonCallback(action, lesson.id, profile.student.id)
        }
      ]
    ];
  });

  if (!rows.length) {
    return undefined;
  }

  return { inline_keyboard: rows };
}

function formatAttendanceResult(
  lesson: Lesson,
  studentId: string,
  intent: AttendanceIntent,
  timeZone: string
): string {
  const when = formatAttendanceWhenInTimeZone(lesson.startsAt, timeZone);
  const label = intent === "confirmed" ? "буду" : "не буду";
  const participant = lesson.participants.find((item) => item.studentId === studentId);
  const debt = participant?.hasDebt ? "\n⚠️ По балансу нет оплаченного занятия." : "";

  return `${when}: ${label}.${debt}`;
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
  attendanceLessonKeyboard,
  findLessonByScheduleIndex,
  formatAttendancePrompt,
  formatAttendanceResult,
  isActionableLesson,
  parseLessonIndex,
  type AttendanceIntent
};
