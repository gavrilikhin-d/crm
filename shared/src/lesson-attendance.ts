import type { Lesson } from "./types";

const BLOCKED_LESSON_STATUSES = new Set<Lesson["status"]>([
  "completed",
  "cancelled_by_teacher",
  "cancelled_by_student",
  "missed"
]);

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
