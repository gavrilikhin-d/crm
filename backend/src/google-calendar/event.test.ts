import { describe, expect, test } from "bun:test";
import type { Lesson, Student } from "@crm/shared";
import {
  buildGoogleCalendarDescription,
  buildGoogleCalendarEvent,
  buildGoogleCalendarSummary,
  formatCalendarDateTime,
  shouldSyncLessonToGoogleCalendar
} from "./event";

const anna: Student = {
  id: "student-1",
  fullName: "Anna Ivanova",
  telegramBindToken: "token",
  status: "active",
  defaultLessonPrice: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const boris: Student = {
  id: "student-2",
  fullName: "Boris Petrov",
  telegramBindToken: "token-2",
  status: "active",
  defaultLessonPrice: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const students = new Map([
  [anna.id, anna],
  [boris.id, boris]
]);

const lesson: Lesson = {
  id: "lesson-1",
  startsAt: "2026-06-30T10:00:00.000Z",
  durationMinutes: 60,
  originalType: "individual",
  effectiveType: "individual",
  status: "scheduled",
  participants: [
    {
      id: "participant-1",
      studentId: anna.id,
      status: "awaiting",
      balanceCharged: false,
      hasDebt: false
    }
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("google calendar event", () => {
  test("syncs only active lessons", () => {
    expect(shouldSyncLessonToGoogleCalendar(lesson)).toBe(true);
    expect(shouldSyncLessonToGoogleCalendar({ ...lesson, status: "completed" })).toBe(false);
    expect(shouldSyncLessonToGoogleCalendar({ ...lesson, status: "cancelled_by_teacher" })).toBe(false);
  });

  test("uses only student names in summary", () => {
    expect(buildGoogleCalendarSummary(lesson, students)).toBe("Anna Ivanova");
    expect(buildGoogleCalendarEvent(lesson, students).summary).toBe("Anna Ivanova");
  });

  test("marks declined participants with strikethrough in description", () => {
    const groupLesson: Lesson = {
      ...lesson,
      effectiveType: "group",
      participants: [
        { ...lesson.participants[0], status: "confirmed" },
        {
          id: "participant-2",
          studentId: boris.id,
          status: "declined",
          balanceCharged: false,
          hasDebt: false
        }
      ]
    };

    expect(buildGoogleCalendarSummary(groupLesson, students)).toBe("Anna Ivanova");
    expect(buildGoogleCalendarDescription(groupLesson, students)).toContain("<s>Boris Petrov</s> — отказался");
    expect(buildGoogleCalendarDescription(groupLesson, students)).toContain("Anna Ivanova — подтвердил");
  });

  test("builds event with CRM metadata and timezone", () => {
    const event = buildGoogleCalendarEvent(lesson, students);

    expect(event.extendedProperties?.private?.crmLessonId).toBe("lesson-1");
    expect(event.start?.dateTime).toBe(formatCalendarDateTime(new Date(lesson.startsAt), "Europe/Minsk"));
    expect(event.start?.timeZone).toBe("Europe/Minsk");
    expect(event.end?.dateTime).toBe(formatCalendarDateTime(new Date("2026-06-30T11:00:00.000Z"), "Europe/Minsk"));
  });
});
