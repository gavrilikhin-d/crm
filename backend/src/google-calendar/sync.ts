import type { Lesson, Student } from "@crm/shared";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import * as Sentry from "@sentry/node";
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
  return withSentrySpan(
    "google_calendar.sync_lesson",
    "task",
    async () => {
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
        }, "events.update");
        return;
      }

      const created = await withGoogleCalendarClient(accountId, async (calendar, calendarId) => {
        const response = await calendar.events.insert({
          calendarId,
          requestBody: event
        });
        return response.data.id ?? null;
      }, "events.insert");

      if (created) {
        await updateLessonGoogleEventId(lesson.id, created);
      }
    },
    { "account.id": accountId, "lesson.id": lesson.id }
  );
}

export async function removeLessonFromGoogleCalendar(accountId: string, lesson: Lesson): Promise<void> {
  return withSentrySpan(
    "google_calendar.remove_lesson",
    "task",
    async () => {
      if (!(await isSyncEnabled(accountId)) || !lesson.googleCalendarEventId) {
        return;
      }

      try {
        await withGoogleCalendarClient(accountId, async (calendar, calendarId) => {
          await calendar.events.delete({
            calendarId,
            eventId: lesson.googleCalendarEventId!
          });
        }, "events.delete");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("404") && !message.includes("Not Found")) {
          throw error;
        }
      }

      await updateLessonGoogleEventId(lesson.id, null);
    },
    { "account.id": accountId, "lesson.id": lesson.id }
  );
}

export async function syncLessonsToGoogleCalendar(accountId: string, lessons: Lesson[]): Promise<void> {
  return withSentrySpan(
    "google_calendar.sync_lessons",
    "task",
    async () => {
      if (!(await isSyncEnabled(accountId)) || !lessons.length) {
        return;
      }

      const db = await loadAccountDatabase(accountId);

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
    },
    { "account.id": accountId, "lesson.count": lessons.length }
  );
}

export async function syncAllLessonsToGoogleCalendar(ctx: AuthContext): Promise<{ synced: number; failed: number }> {
  return withSentrySpan(
    "google_calendar.sync_all",
    "task",
    async () => {
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
    },
    { "account.id": ctx.accountId }
  );
}

export function scheduleGoogleCalendarSync(accountId: string, lessons: Lesson[]): void {
  void Sentry.startNewTrace(() =>
    withSentrySpan(
      "google_calendar.background_sync",
      "task",
      () => syncLessonsToGoogleCalendar(accountId, lessons),
      { "account.id": accountId, "lesson.count": lessons.length },
      { forceTransaction: true }
    )
  ).catch((error) => {
    console.error("[google-calendar] Background sync failed", {
      accountId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}
