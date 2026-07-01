import type { Lesson, ParticipantStatus } from "./types";

export const TEACHER_PARTICIPANT_STATUSES = ["confirmed", "declined"] as const;

export type TeacherParticipantStatus = (typeof TEACHER_PARTICIPANT_STATUSES)[number];

const BLOCKED_LESSON_STATUSES = new Set<Lesson["status"]>([
  "completed",
  "cancelled_by_teacher",
  "cancelled_by_student",
  "missed"
]);

export function assertTeacherParticipantStatus(status: ParticipantStatus): asserts status is TeacherParticipantStatus {
  if (!TEACHER_PARTICIPANT_STATUSES.includes(status as TeacherParticipantStatus)) {
    throw new Error("Teacher can only set confirmed or declined status");
  }
}

export function normalizeTeacherParticipantStatus(
  lesson: Lesson,
  status: TeacherParticipantStatus
): ParticipantStatus {
  if (lesson.status === "completed" && status === "confirmed") {
    return "attended";
  }

  return status;
}

export function toTeacherParticipantStatus(status: ParticipantStatus): TeacherParticipantStatus {
  return status === "declined" ? "declined" : "confirmed";
}

export function canStudentChangeParticipantStatus(lesson: Lesson, now = Date.now()): boolean {
  if (BLOCKED_LESSON_STATUSES.has(lesson.status)) {
    return false;
  }

  return new Date(lesson.startsAt).getTime() > now;
}

export function assertStudentCanChangeParticipantStatus(lesson: Lesson, now = Date.now()): void {
  if (!canStudentChangeParticipantStatus(lesson, now)) {
    throw new Error("Cannot change attendance for a past lesson");
  }
}
