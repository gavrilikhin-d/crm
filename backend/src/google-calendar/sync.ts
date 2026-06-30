import type { Lesson, Student } from "@crm/shared";
import {
  getAccountGoogleCalendar,
  loadAccountDatabase,
  setAccountGoogleCalendarSyncEnabled,
  updateLessonGoogleEventId
} from "../db/repository";
import type { AuthContext } from "../auth";
import { withGoogleCalendarClient } from "./client";
import { buildGoogleCalendarEvent, shouldSyncLessonToGoogleCalendar } from "./event";

function studentsById(students: Student[]): Map<string, Student> {
  return new Map(students.map((student) => [student.id, student]));
}

async function isSyncEnabled(accountId: string): Promise<boolean> {
  const credentials = await getAccountGoogleCalendar(accountId);
  return Boolean(credentials?.syncEnabled && credentials.refreshToken);
}

export async function setGoogleCalendarSyncEnabled(accountId: string, enabled: boolean): Promise<void> {
  await setAccountGoogleCalendarSyncEnabled(accountId, enabled);
}

export async function syncLessonToGoogleCalendar(
  accountId: string,
  lesson: Lesson,
  students: Student[]
): Promise<void> {
  if (!(await isSyncEnabled(accountId))) {
    return;
  }

  if (!shouldSyncLessonToGoogleCalendar(lesson)) {
    await removeLessonFromGoogleCalendar(accountId, lesson);
    return;
  }

  const event = buildGoogleCalendarEvent(lesson, studentsById(students));

  if (lesson.googleCalendarEventId) {
    await withGoogleCalendarClient(accountId, async (calendar, calendarId) => {
      await calendar.events.update({
        calendarId,
        eventId: lesson.googleCalendarEventId!,
        requestBody: event
      });
    });
    return;
  }

  const created = await withGoogleCalendarClient(accountId, async (calendar, calendarId) => {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event
    });
    return response.data.id ?? null;
  });

  if (created) {
    await updateLessonGoogleEventId(lesson.id, created);
  }
}

export async function removeLessonFromGoogleCalendar(accountId: string, lesson: Lesson): Promise<void> {
  if (!(await isSyncEnabled(accountId)) || !lesson.googleCalendarEventId) {
    return;
  }

  try {
    await withGoogleCalendarClient(accountId, async (calendar, calendarId) => {
      await calendar.events.delete({
        calendarId,
        eventId: lesson.googleCalendarEventId!
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("404") && !message.includes("Not Found")) {
      throw error;
    }
  }

  await updateLessonGoogleEventId(lesson.id, null);
}

export async function syncLessonsToGoogleCalendar(accountId: string, lessons: Lesson[]): Promise<void> {
  if (!(await isSyncEnabled(accountId)) || !lessons.length) {
    return;
  }

  const db = await loadAccountDatabase(accountId);
  const studentMap = studentsById(db.students);

  for (const lesson of lessons) {
    try {
      if (shouldSyncLessonToGoogleCalendar(lesson)) {
        await syncLessonToGoogleCalendar(accountId, lesson, db.students);
      } else {
        await removeLessonFromGoogleCalendar(accountId, lesson);
      }
    } catch (error) {
      console.error("[google-calendar] Failed to sync lesson", {
        accountId,
        lessonId: lesson.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export async function syncAllLessonsToGoogleCalendar(ctx: AuthContext): Promise<{ synced: number; failed: number }> {
  if (!(await isSyncEnabled(ctx.accountId))) {
    throw new Error("Google Calendar sync is not enabled");
  }

  const db = await loadAccountDatabase(ctx.accountId);
  let synced = 0;
  let failed = 0;

  for (const lesson of db.lessons) {
    try {
      if (shouldSyncLessonToGoogleCalendar(lesson)) {
        await syncLessonToGoogleCalendar(ctx.accountId, lesson, db.students);
      } else if (lesson.googleCalendarEventId) {
        await removeLessonFromGoogleCalendar(ctx.accountId, lesson);
      }
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error("[google-calendar] Failed to sync lesson", {
        accountId: ctx.accountId,
        lessonId: lesson.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { synced, failed };
}

export function scheduleGoogleCalendarSync(accountId: string, lessons: Lesson[]): void {
  void syncLessonsToGoogleCalendar(accountId, lessons).catch((error) => {
    console.error("[google-calendar] Background sync failed", {
      accountId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}
