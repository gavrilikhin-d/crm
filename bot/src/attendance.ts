import type { InlineKeyboardMarkup } from "@telegraf/types";
import { canStudentChangeParticipantStatus } from "@crm/shared/lesson-attendance";
import { encodeLessonCallback } from "@crm/shared/lesson-callback";
import { formatAttendanceWhenInTimeZone } from "@crm/shared/timezone";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import { resolveProfileTimeZone } from "./messages";
import { SCHEDULE_DAY_PRESETS } from "./schedule-days";

type AttendanceIntent = "confirmed" | "declined";

function parseLessonIndex(payload?: string): { index?: number; error?: string } {
  const raw = payload?.trim().split(/\s+/)[0];
  if (!raw) {
    return {};
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return { error: "Укажите номер занятия из расписания, например: буду 1" };
  }

  return { index: parsed };
}

function parseAttendancePhrase(
  text: string
): { intent: AttendanceIntent; index?: number } | null {
  const trimmed = text.trim();
  const withIndex = trimmed.match(/^(буду|не\s+буду)\s+(\d+)$/i);
  if (withIndex) {
    const index = Number(withIndex[2]);
    if (!Number.isInteger(index) || index < 1) {
      return null;
    }
    return {
      intent: /^буду$/i.test(withIndex[1]!) ? "confirmed" : "declined",
      index
    };
  }

  if (/^буду$/i.test(trimmed)) {
    return { intent: "confirmed" };
  }
  if (/^не\s+буду$/i.test(trimmed)) {
    return { intent: "declined" };
  }

  return null;
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

function scheduleKeyboard(profile: TelegramStudentProfile, activeDays: number): InlineKeyboardMarkup {
  const dayRow = SCHEDULE_DAY_PRESETS.map((days) => ({
    text: `${activeDays === days ? "✓ " : ""}${days} дн.`,
    callback_data: `sch:d:${days}`
  }));

  const timeZone = resolveProfileTimeZone(profile);
  const lessonRows = profile.upcomingLessons.flatMap((lesson, index) => {
    if (!isActionableLesson(lesson, profile.student.id)) {
      return [];
    }

    const participant = lesson.participants.find((item) => item.studentId === profile.student.id);
    const status = participant?.status;
    const when = formatAttendanceWhenInTimeZone(lesson.startsAt, timeZone);
    const statusThumb = status === "confirmed" ? "👍 " : status === "declined" ? "👎 " : "";
    // Telegram equalizes buttons in one row, so the label gets its own full-width row.
    const labelRow = [
      {
        text: `${statusThumb}${index + 1}. ${when}`,
        callback_data: "sch:n"
      }
    ];

    if (status === "confirmed") {
      return [
        labelRow,
        [
          {
            text: "👎",
            callback_data: encodeLessonCallback("decline", lesson.id, profile.student.id)
          }
        ]
      ];
    }

    if (status === "declined") {
      return [
        labelRow,
        [
          {
            text: "👍",
            callback_data: encodeLessonCallback("attend", lesson.id, profile.student.id)
          }
        ]
      ];
    }

    return [
      labelRow,
      [
        {
          text: "👍",
          callback_data: encodeLessonCallback("attend", lesson.id, profile.student.id)
        },
        {
          text: "👎",
          callback_data: encodeLessonCallback("decline", lesson.id, profile.student.id)
        }
      ]
    ];
  });

  return { inline_keyboard: [dayRow, ...lessonRows] };
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

export {
  findLessonByScheduleIndex,
  formatAttendanceResult,
  isActionableLesson,
  parseAttendancePhrase,
  parseLessonIndex,
  scheduleKeyboard,
  type AttendanceIntent
};
