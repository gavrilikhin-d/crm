import type { Database, Lesson, Student } from "@crm/shared";
import { captureSentryLog } from "@crm/shared/sentry-node";
import { withSentrySpan } from "@crm/shared/sentry-tracing";
import * as Sentry from "@sentry/node";
import { nanoid } from "nanoid";
import {
  getAccountGoogleCalendar,
  loadAccountDatabase,
  setAccountGoogleCalendarSyncEnabled,
  updateLessonGoogleEventId
} from "../db/repository";
import type { AuthContext } from "../auth";
import { withGoogleCalendarAccessToken, withGoogleCalendarClient } from "./client";
import {
  GOOGLE_CALENDAR_BATCH_URL,
  buildGoogleCalendarBatchBody,
  calendarEventsPath,
  chunkGoogleCalendarBatchParts,
  extractMultipartBoundary,
  parseGoogleCalendarBatchResponse,
  type GoogleCalendarBatchPart,
  type GoogleCalendarBatchPartResult
} from "./batch";
import { buildGoogleCalendarEvent, shouldSyncLessonToGoogleCalendar } from "./event";

function studentsById(students: Student[]): Map<string, Student> {
  return new Map(students.map((student) => [student.id, student]));
}

type GoogleCalendarSyncDatabase = Pick<Database, "students" | "lessons" | "payments">;

type LessonBatchOperation = {
  lesson: Lesson;
  contentId: string;
  kind: "insert" | "update" | "delete";
  part: GoogleCalendarBatchPart;
};

function reportGoogleCalendarSyncError(
  message: string,
  error: unknown,
  context: Record<string, string | number>
): void {
  captureSentryLog("backend", "error", message, {
    err: error,
    ...context
  });
  console.error(message, {
    ...context,
    error: error instanceof Error ? error.message : String(error)
  });
}

async function isSyncEnabled(accountId: string): Promise<boolean> {
  const credentials = await getAccountGoogleCalendar(accountId);
  return Boolean(credentials?.syncEnabled && credentials.refreshToken);
}

export async function setGoogleCalendarSyncEnabled(accountId: string, enabled: boolean): Promise<void> {
  await setAccountGoogleCalendarSyncEnabled(accountId, enabled);
}

function buildLessonBatchOperations(
  lessons: Lesson[],
  db: GoogleCalendarSyncDatabase,
  calendarId: string
): LessonBatchOperation[] {
  const studentMap = studentsById(db.students);
  const progressContext = { lessons: db.lessons, payments: db.payments };
  const operations: LessonBatchOperation[] = [];

  for (const lesson of lessons) {
    if (shouldSyncLessonToGoogleCalendar(lesson)) {
      const event = buildGoogleCalendarEvent(lesson, studentMap, progressContext);
      if (lesson.googleCalendarEventId) {
        const contentId = `update:${lesson.id}`;
        operations.push({
          lesson,
          contentId,
          kind: "update",
          part: {
            contentId,
            method: "PUT",
            path: calendarEventsPath(calendarId, lesson.googleCalendarEventId),
            body: event
          }
        });
      } else {
        const contentId = `insert:${lesson.id}`;
        operations.push({
          lesson,
          contentId,
          kind: "insert",
          part: {
            contentId,
            method: "POST",
            path: calendarEventsPath(calendarId),
            body: event
          }
        });
      }
      continue;
    }

    if (lesson.googleCalendarEventId) {
      const contentId = `delete:${lesson.id}`;
      operations.push({
        lesson,
        contentId,
        kind: "delete",
        part: {
          contentId,
          method: "DELETE",
          path: calendarEventsPath(calendarId, lesson.googleCalendarEventId)
        }
      });
    }
  }

  return operations;
}

function isSuccessfulBatchStatus(status: number, kind: LessonBatchOperation["kind"]): boolean {
  if (kind === "delete") {
    return (status >= 200 && status < 300) || status === 404;
  }
  return status >= 200 && status < 300;
}

async function executeGoogleCalendarBatch(
  accountId: string,
  parts: GoogleCalendarBatchPart[]
): Promise<GoogleCalendarBatchPartResult[]> {
  if (!parts.length) {
    return [];
  }

  return withGoogleCalendarAccessToken(
    accountId,
    async (accessToken) => {
      const results: GoogleCalendarBatchPartResult[] = [];

      for (const chunk of chunkGoogleCalendarBatchParts(parts)) {
        const chunkResults = await withSentrySpan(
          "events.batch",
          "google.calendar",
          async () => {
            const boundary = `batch_${nanoid()}`;
            const body = buildGoogleCalendarBatchBody(chunk, boundary);
            const response = await fetch(GOOGLE_CALENDAR_BATCH_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/mixed; boundary=${boundary}`
              },
              body
            });

            const text = await response.text();
            if (!response.ok) {
              throw new Error(`Google Calendar batch failed (${response.status}): ${text.slice(0, 500)}`);
            }

            const responseBoundary =
              extractMultipartBoundary(response.headers.get("content-type")) ?? boundary;
            return parseGoogleCalendarBatchResponse(text, responseBoundary);
          },
          { "account.id": accountId, "batch.size": chunk.length }
        );

        results.push(...chunkResults);
      }

      return results;
    },
    "google_calendar.batch_auth"
  );
}

async function applyBatchOperationResults(
  accountId: string,
  operations: LessonBatchOperation[],
  results: GoogleCalendarBatchPartResult[]
): Promise<{ synced: number; failed: number }> {
  const resultsByContentId = new Map(results.map((result) => [result.contentId, result]));
  let synced = 0;
  let failed = 0;

  await Promise.all(
    operations.map(async (operation) => {
      const result = resultsByContentId.get(operation.contentId);
      if (!result || !isSuccessfulBatchStatus(result.status, operation.kind)) {
        failed += 1;
        reportGoogleCalendarSyncError("[google-calendar] Failed to sync lesson", result?.body ?? "missing batch result", {
          accountId,
          lessonId: operation.lesson.id,
          status: result?.status ?? 0,
          operation: operation.kind
        });
        return;
      }

      try {
        if (operation.kind === "insert") {
          const eventId =
            result.body && typeof result.body === "object" && "id" in result.body
              ? String((result.body as { id?: unknown }).id ?? "")
              : "";
          if (!eventId) {
            throw new Error("Google Calendar insert response missing event id");
          }
          await updateLessonGoogleEventId(operation.lesson.id, eventId);
        } else if (operation.kind === "delete") {
          await updateLessonGoogleEventId(operation.lesson.id, null);
        }
        synced += 1;
      } catch (error) {
        failed += 1;
        reportGoogleCalendarSyncError("[google-calendar] Failed to persist Google Calendar sync result", error, {
          accountId,
          lessonId: operation.lesson.id,
          operation: operation.kind
        });
      }
    })
  );

  return { synced, failed };
}

async function syncLessonOperationsInBatch(
  accountId: string,
  lessons: Lesson[],
  db: GoogleCalendarSyncDatabase
): Promise<{ synced: number; failed: number }> {
  if (!lessons.length) {
    return { synced: 0, failed: 0 };
  }

  return withSentrySpan(
    "google_calendar.sync_lessons_batch",
    "task",
    async () => {
      const credentials = await getAccountGoogleCalendar(accountId);
      const calendarId = credentials?.calendarId ?? "primary";
      const operations = buildLessonBatchOperations(lessons, db, calendarId);

      if (!operations.length) {
        return { synced: lessons.length, failed: 0 };
      }

      const results = await executeGoogleCalendarBatch(
        accountId,
        operations.map((operation) => operation.part)
      );

      const outcome = await applyBatchOperationResults(accountId, operations, results);
      const skipped = lessons.length - operations.length;
      return { synced: outcome.synced + skipped, failed: outcome.failed };
    },
    { "account.id": accountId, "lesson.count": lessons.length }
  );
}

export async function syncLessonToGoogleCalendar(
  accountId: string,
  lesson: Lesson,
  db: GoogleCalendarSyncDatabase
): Promise<void> {
  return withSentrySpan(
    "google_calendar.sync_lesson",
    "task",
    async () => {
      if (!(await isSyncEnabled(accountId))) {
        return;
      }

      await syncLessonOperationsInBatch(accountId, [lesson], db);
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
      await syncLessonOperationsInBatch(accountId, lessons, db);
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
      return syncLessonOperationsInBatch(ctx.accountId, db.lessons, db);
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
    reportGoogleCalendarSyncError("[google-calendar] Background sync failed", error, { accountId });
  });
}
