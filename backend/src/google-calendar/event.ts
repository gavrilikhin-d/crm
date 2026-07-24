import type { Lesson, LessonParticipant, ParticipantStatus, Payment, Student } from "@crm/shared";
import {
  formatParticipantNameWithPackageProgress,
  getPackageLessonProgress
} from "@crm/shared/package-progress";
import type { calendar_v3 } from "googleapis";

export const CALENDAR_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Minsk";

const GOOGLE_CALENDAR_SYNCABLE_LESSON_STATUSES = new Set<Lesson["status"]>([
  "scheduled",
  "confirmed",
  "cancelled_by_student"
]);
const INACTIVE_PARTICIPANT_STATUSES = new Set<ParticipantStatus>(["declined", "missed"]);

const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  awaiting: "ожидает ответа",
  confirmed: "подтвердил",
  declined: "отказался",
  missed: "не пришёл",
  attended: "будет"
};

export type GoogleCalendarProgressContext = {
  lessons: Lesson[];
  payments: Payment[];
};

export function shouldSyncLessonToGoogleCalendar(lesson: Lesson): boolean {
  return GOOGLE_CALENDAR_SYNCABLE_LESSON_STATUSES.has(lesson.status);
}

/** RFC3339 local wall-clock time in the given IANA timezone (no offset suffix). */
export function formatCalendarDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

function participantName(participant: LessonParticipant, studentsById: Map<string, Student>): string | null {
  return studentsById.get(participant.studentId)?.fullName ?? null;
}

function participantDisplayName(
  lesson: Lesson,
  participant: LessonParticipant,
  studentsById: Map<string, Student>,
  progressContext?: GoogleCalendarProgressContext
): string | null {
  const name = participantName(participant, studentsById);
  if (!name) {
    return null;
  }

  if (!progressContext) {
    return name;
  }

  const progress = getPackageLessonProgress({
    studentId: participant.studentId,
    lessonId: lesson.id,
    lessons: progressContext.lessons,
    payments: progressContext.payments
  });

  return formatParticipantNameWithPackageProgress(name, progress);
}

function formatParticipantLine(participant: LessonParticipant, name: string): string {
  const statusLabel = PARTICIPANT_STATUS_LABEL[participant.status];
  return `${name} — ${statusLabel}`;
}

export function buildGoogleCalendarSummary(
  lesson: Lesson,
  studentsById: Map<string, Student>,
  progressContext?: GoogleCalendarProgressContext
): string {
  const activeNames = lesson.participants
    .filter((participant) => !INACTIVE_PARTICIPANT_STATUSES.has(participant.status))
    .map((participant) => participantDisplayName(lesson, participant, studentsById, progressContext))
    .filter(Boolean) as string[];

  if (activeNames.length) {
    return activeNames.join(", ");
  }

  const allNames = lesson.participants
    .map((participant) => participantDisplayName(lesson, participant, studentsById, progressContext))
    .filter(Boolean) as string[];

  const summary = allNames.join(", ") || "Занятие";
  return lesson.status === "cancelled_by_student" ? `Отменено: ${summary}` : summary;
}

export function buildGoogleCalendarDescription(
  lesson: Lesson,
  studentsById: Map<string, Student>,
  progressContext?: GoogleCalendarProgressContext
): string {
  const typeLabel = lesson.effectiveType === "group" ? "Групповое" : "Индивидуальное";
  const statusLine = lesson.status === "cancelled_by_student" ? "Статус: отменено учеником" : null;
  const lines = lesson.participants
    .map((participant) => {
      const name = participantDisplayName(lesson, participant, studentsById, progressContext);
      return name ? formatParticipantLine(participant, name) : null;
    })
    .filter(Boolean);

  return [`Занятие из CRM`, statusLine, `Формат: ${typeLabel}`, "", "Ученики:", ...lines]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildGoogleCalendarEvent(
  lesson: Lesson,
  studentsById: Map<string, Student>,
  progressContext?: GoogleCalendarProgressContext
): calendar_v3.Schema$Event {
  const start = new Date(lesson.startsAt);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

  const event: calendar_v3.Schema$Event = {
    summary: buildGoogleCalendarSummary(lesson, studentsById, progressContext),
    description: buildGoogleCalendarDescription(lesson, studentsById, progressContext),
    start: {
      dateTime: formatCalendarDateTime(start, CALENDAR_TIMEZONE),
      timeZone: CALENDAR_TIMEZONE
    },
    end: {
      dateTime: formatCalendarDateTime(end, CALENDAR_TIMEZONE),
      timeZone: CALENDAR_TIMEZONE
    },
    extendedProperties: {
      private: {
        crmLessonId: lesson.id
      }
    }
  };

  if (lesson.status === "cancelled_by_student") {
    event.reminders = { useDefault: false, overrides: [] };
    event.transparency = "transparent";
  }

  return event;
}
