import type { Lesson } from "./types";

export function lessonOccurrenceKey(lesson: Lesson): string {
  const startsAt = new Date(lesson.startsAt).getTime();

  if (lesson.recurringScheduleId) {
    return `schedule:${lesson.recurringScheduleId}:${startsAt}`;
  }

  const studentIds = [...lesson.participants.map((participant) => participant.studentId)].sort().join(",");
  return `lesson:${startsAt}:${lesson.durationMinutes}:${studentIds}`;
}

function pickPreferredLesson(existing: Lesson, candidate: Lesson): Lesson {
  if (existing.googleCalendarEventId && !candidate.googleCalendarEventId) {
    return existing;
  }
  if (candidate.googleCalendarEventId && !existing.googleCalendarEventId) {
    return candidate;
  }

  return new Date(existing.createdAt).getTime() <= new Date(candidate.createdAt).getTime() ? existing : candidate;
}

export function dedupeLessonsByOccurrence(lessonList: Lesson[]): Lesson[] {
  const byKey = new Map<string, Lesson>();

  for (const lesson of lessonList) {
    const key = lessonOccurrenceKey(lesson);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredLesson(existing, lesson) : lesson);
  }

  return [...byKey.values()];
}
