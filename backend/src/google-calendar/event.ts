import type { Lesson, LessonParticipant, ParticipantStatus, Student } from "@crm/shared";
import type { calendar_v3 } from "googleapis";

export const CALENDAR_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Minsk";

const ACTIVE_LESSON_STATUSES = new Set<Lesson["status"]>(["scheduled", "confirmed"]);
const INACTIVE_PARTICIPANT_STATUSES = new Set<ParticipantStatus>(["declined", "missed"]);

const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  awaiting: "ожидает ответа",
  confirmed: "подтвердил",
  declined: "отказался",
  missed: "не пришёл",
  attended: "будет"
};

export function shouldSyncLessonToGoogleCalendar(lesson: Lesson): boolean {
  return ACTIVE_LESSON_STATUSES.has(lesson.status);
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function participantName(participant: LessonParticipant, studentsById: Map<string, Student>): string | null {
  return studentsById.get(participant.studentId)?.fullName ?? null;
}

function formatParticipantLine(participant: LessonParticipant, name: string): string {
  const safeName = escapeHtml(name);
  const statusLabel = PARTICIPANT_STATUS_LABEL[participant.status];

  if (INACTIVE_PARTICIPANT_STATUSES.has(participant.status)) {
    return `<s>${safeName}</s> — ${statusLabel}`;
  }

  if (participant.status === "awaiting") {
    return `${safeName} — ${statusLabel}`;
  }

  return `${safeName} — ${statusLabel}`;
}

export function buildGoogleCalendarSummary(
  lesson: Lesson,
  studentsById: Map<string, Student>
): string {
  const activeNames = lesson.participants
    .filter((participant) => !INACTIVE_PARTICIPANT_STATUSES.has(participant.status))
    .map((participant) => participantName(participant, studentsById))
    .filter(Boolean) as string[];

  if (activeNames.length) {
    return activeNames.join(", ");
  }

  const allNames = lesson.participants
    .map((participant) => participantName(participant, studentsById))
    .filter(Boolean) as string[];

  return allNames.join(", ") || "Занятие";
}

export function buildGoogleCalendarDescription(
  lesson: Lesson,
  studentsById: Map<string, Student>
): string {
  const typeLabel = lesson.effectiveType === "group" ? "Групповое" : "Индивидуальное";
  const lines = lesson.participants
    .map((participant) => {
      const name = participantName(participant, studentsById);
      return name ? formatParticipantLine(participant, name) : null;
    })
    .filter(Boolean);

  return [`Занятие из CRM`, `Формат: ${typeLabel}`, "", "Ученики:", ...lines].join("<br>");
}

export function buildGoogleCalendarEvent(
  lesson: Lesson,
  studentsById: Map<string, Student>
): calendar_v3.Schema$Event {
  const start = new Date(lesson.startsAt);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

  return {
    summary: buildGoogleCalendarSummary(lesson, studentsById),
    description: buildGoogleCalendarDescription(lesson, studentsById),
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
}
