import { describe, expect, test } from "bun:test";
import type { AppSettings, Lesson, Reminder, Student } from "./types";
import {
  coalesceLessonReminderDeliveries,
  desiredLessonReminders,
  getStudentLessonReminderMinutes,
  isLessonReminderStillValid,
  isSkippedLessonStatus,
  isSkippedParticipantStatus,
  lessonReminderDedupeKey,
  parseLessonReminderDedupeKey,
  planLessonReminderSync
} from "./lesson-reminder";

function createStudent(id: string, overrides: Partial<Student> = {}): Student {
  const timestamp = new Date().toISOString();
  return {
    id,
    fullName: `Student ${id}`,
    telegramChatId: "12345",
    telegramBindToken: "token",
    status: "active",
    defaultLessonPrice: 3000,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function createLesson(input: {
  id: string;
  startsAt: string;
  status?: Lesson["status"];
  studentIds: string[];
  participantStatuses?: string[];
}): Lesson {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    startsAt: input.startsAt,
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: input.status ?? "scheduled",
    participants: input.studentIds.map((studentId, index) => ({
      id: `p-${studentId}`,
      studentId,
      status: (input.participantStatuses?.[index] ?? "awaiting") as Lesson["participants"][number]["status"],
      balanceCharged: false,
      hasDebt: false
    })),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

const settings: Pick<AppSettings, "lessonReminderMinutes" | "timezone"> = {
  lessonReminderMinutes: [60],
  timezone: "Europe/Minsk"
};

describe("desiredLessonReminders", () => {
  test("schedules awaiting participants for future lessons", () => {
    const student = createStudent("s1");
    const startsAt = "2026-06-30T18:00:00.000Z";
    const nowMs = Date.parse("2026-06-30T10:00:00.000Z");

    const desired = desiredLessonReminders({
      lesson: createLesson({ id: "l1", startsAt, studentIds: ["s1"] }),
      studentsById: new Map([["s1", student]]),
      settings,
      nowMs
    });

    expect(desired).toHaveLength(1);
    expect(desired[0]).toMatchObject({
      dedupeKey: "lesson:l1:s1:60",
      leadMinutes: 60,
      scheduledFor: "2026-06-30T17:00:00.000Z",
      studentId: "s1",
      timeZone: "Europe/Minsk"
    });
  });

  test("skips cancelled lessons and declined participants", () => {
    const student = createStudent("s1");
    const startsAt = "2026-06-30T18:00:00.000Z";
    const nowMs = Date.parse("2026-06-30T10:00:00.000Z");

    expect(
      desiredLessonReminders({
        lesson: createLesson({
          id: "cancelled",
          startsAt,
          status: "cancelled_by_teacher",
          studentIds: ["s1"]
        }),
        studentsById: { s1: student },
        settings,
        nowMs
      })
    ).toHaveLength(0);

    expect(
      desiredLessonReminders({
        lesson: createLesson({
          id: "declined",
          startsAt,
          studentIds: ["s1"],
          participantStatuses: ["declined"]
        }),
        studentsById: { s1: student },
        settings,
        nowMs
      })
    ).toHaveLength(0);
  });

  test("still schedules after the student confirmed", () => {
    const student = createStudent("s1");
    const desired = desiredLessonReminders({
      lesson: createLesson({
        id: "approved",
        startsAt: "2026-06-30T18:00:00.000Z",
        studentIds: ["s1"],
        participantStatuses: ["confirmed"]
      }),
      studentsById: { s1: student },
      settings,
      nowMs: Date.parse("2026-06-30T10:00:00.000Z")
    });

    expect(desired.map((item) => item.dedupeKey)).toEqual(["lesson:approved:s1:60"]);
  });

  test("does not schedule past lessons", () => {
    const student = createStudent("s1");
    expect(
      desiredLessonReminders({
        lesson: createLesson({
          id: "past",
          startsAt: "2020-06-01T10:00:00.000Z",
          status: "completed",
          studentIds: ["s1"],
          participantStatuses: ["attended"]
        }),
        studentsById: { s1: student },
        settings: { lessonReminderMinutes: [1440, 120, 60], timezone: "Europe/Minsk" },
        nowMs: Date.parse("2026-06-30T17:10:00.000Z")
      })
    ).toHaveLength(0);
  });

  test("emits one reminder per configured lead time", () => {
    const student = createStudent("s1");
    const desired = desiredLessonReminders({
      lesson: createLesson({ id: "l1", startsAt: "2026-06-30T18:00:00.000Z", studentIds: ["s1"] }),
      studentsById: { s1: student },
      settings: { lessonReminderMinutes: [1440, 60], timezone: "Europe/Minsk" },
      nowMs: Date.parse("2026-06-30T10:00:00.000Z")
    });

    expect(desired.map((item) => item.dedupeKey)).toEqual(["lesson:l1:s1:1440", "lesson:l1:s1:60"]);
  });

  test("uses student reminder override before account defaults", () => {
    const student = createStudent("s1", { lessonReminderMinutes: [30] });
    const desired = desiredLessonReminders({
      lesson: createLesson({ id: "l1", startsAt: "2026-06-30T18:00:00.000Z", studentIds: ["s1"] }),
      studentsById: { s1: student },
      settings,
      nowMs: Date.parse("2026-06-30T10:00:00.000Z")
    });

    expect(desired.map((item) => item.dedupeKey)).toEqual(["lesson:l1:s1:30"]);
  });

  test("falls back to account defaults when student override is empty", () => {
    const student = createStudent("s1", { lessonReminderMinutes: null });
    expect(getStudentLessonReminderMinutes(student, { lessonReminderMinutes: [120, 60] })).toEqual([120, 60]);
  });
});

describe("planLessonReminderSync", () => {
  test("inserts missing desired reminders", () => {
    const actions = planLessonReminderSync({
      existing: [],
      desired: [
        {
          lessonId: "l1",
          studentId: "s1",
          leadMinutes: 60,
          scheduledFor: "2026-06-30T17:00:00.000Z",
          dedupeKey: "lesson:l1:s1:60",
          timeZone: "Europe/Minsk"
        }
      ],
      lessonId: "l1"
    });

    expect(actions).toEqual([
      {
        type: "insert",
        desired: expect.objectContaining({ dedupeKey: "lesson:l1:s1:60" })
      }
    ]);
  });

  test("reschedules pending reminders and clears claim", () => {
    const existing: Reminder = {
      id: "r1",
      type: "lesson",
      lessonId: "l1",
      studentId: "s1",
      scheduledFor: "2026-06-30T16:00:00.000Z",
      status: "pending",
      claimedAt: "2026-06-30T15:00:00.000Z",
      dedupeKey: "lesson:l1:s1:60",
      createdAt: "2026-06-01T00:00:00.000Z"
    };

    const actions = planLessonReminderSync({
      existing: [existing],
      desired: [
        {
          lessonId: "l1",
          studentId: "s1",
          leadMinutes: 60,
          scheduledFor: "2026-06-30T17:00:00.000Z",
          dedupeKey: "lesson:l1:s1:60",
          timeZone: "Europe/Minsk"
        }
      ],
      lessonId: "l1"
    });

    expect(actions).toEqual([
      {
        type: "update",
        reminderId: "r1",
        reArm: false,
        desired: expect.objectContaining({ scheduledFor: "2026-06-30T17:00:00.000Z" })
      }
    ]);
  });

  test("re-arms terminal reminders when lesson time changes", () => {
    const existing: Reminder = {
      id: "r1",
      type: "lesson",
      lessonId: "l1",
      studentId: "s1",
      scheduledFor: "2026-06-30T16:00:00.000Z",
      status: "sent",
      sentAt: "2026-06-30T16:00:00.000Z",
      dedupeKey: "lesson:l1:s1:60",
      createdAt: "2026-06-01T00:00:00.000Z"
    };

    const actions = planLessonReminderSync({
      existing: [existing],
      desired: [
        {
          lessonId: "l1",
          studentId: "s1",
          leadMinutes: 60,
          scheduledFor: "2026-07-01T17:00:00.000Z",
          dedupeKey: "lesson:l1:s1:60",
          timeZone: "Europe/Minsk"
        }
      ],
      lessonId: "l1"
    });

    expect(actions).toEqual([
      {
        type: "update",
        reminderId: "r1",
        reArm: true,
        desired: expect.objectContaining({ scheduledFor: "2026-07-01T17:00:00.000Z" })
      }
    ]);
  });

  test("skips obsolete pending reminders", () => {
    const existing: Reminder = {
      id: "r1",
      type: "lesson",
      lessonId: "l1",
      studentId: "s1",
      scheduledFor: "2026-06-30T17:00:00.000Z",
      status: "pending",
      dedupeKey: "lesson:l1:s1:60",
      createdAt: "2026-06-01T00:00:00.000Z"
    };

    expect(
      planLessonReminderSync({
        existing: [existing],
        desired: [],
        lessonId: "l1"
      })
    ).toEqual([{ type: "skip", reminderId: "r1" }]);
  });

  test("leaves matching terminal reminders alone", () => {
    const existing: Reminder = {
      id: "r1",
      type: "lesson",
      lessonId: "l1",
      studentId: "s1",
      scheduledFor: "2026-06-30T17:00:00.000Z",
      status: "sent",
      sentAt: "2026-06-30T17:00:00.000Z",
      dedupeKey: "lesson:l1:s1:60",
      createdAt: "2026-06-01T00:00:00.000Z"
    };

    expect(
      planLessonReminderSync({
        existing: [existing],
        desired: [
          {
            lessonId: "l1",
            studentId: "s1",
            leadMinutes: 60,
            scheduledFor: "2026-06-30T17:00:00.000Z",
            dedupeKey: "lesson:l1:s1:60",
            timeZone: "Europe/Minsk"
          }
        ],
        lessonId: "l1"
      })
    ).toEqual([]);
  });
});

describe("helpers", () => {
  test("status helpers", () => {
    expect(isSkippedLessonStatus("cancelled_by_teacher")).toBe(true);
    expect(isSkippedLessonStatus("scheduled")).toBe(false);
    expect(isSkippedParticipantStatus("declined")).toBe(true);
    expect(isSkippedParticipantStatus("confirmed")).toBe(false);
  });

  test("dedupe key parse/roundtrip", () => {
    expect(lessonReminderDedupeKey("l1", "s1", 60)).toBe("lesson:l1:s1:60");
    expect(parseLessonReminderDedupeKey("lesson:l1:s1:60")).toEqual({
      lessonId: "l1",
      studentId: "s1",
      leadMinutes: 60
    });
  });

  test("isLessonReminderStillValid", () => {
    const lesson = createLesson({
      id: "l1",
      startsAt: "2026-06-30T18:00:00.000Z",
      studentIds: ["s1"]
    });
    expect(isLessonReminderStillValid({ lesson, studentId: "s1", nowMs: Date.parse("2026-06-30T17:00:00.000Z") })).toBe(
      true
    );
    expect(
      isLessonReminderStillValid({
        lesson: { ...lesson, status: "cancelled_by_teacher" },
        studentId: "s1",
        nowMs: Date.parse("2026-06-30T17:00:00.000Z")
      })
    ).toBe(false);
  });

});

describe("coalesceLessonReminderDeliveries", () => {
  test("keeps only the closest lead time per lesson and student", () => {
    const items = [
      { lesson: { id: "l1" }, student: { id: "s1" }, leadMinutes: 1440, id: "a" },
      { lesson: { id: "l1" }, student: { id: "s1" }, leadMinutes: 120, id: "b" },
      { lesson: { id: "l1" }, student: { id: "s1" }, leadMinutes: 42, id: "c" },
      { lesson: { id: "l1" }, student: { id: "s2" }, leadMinutes: 60, id: "d" }
    ];

    const { deliver, skip } = coalesceLessonReminderDeliveries(items);

    expect(deliver.map((item) => item.id).sort()).toEqual(["c", "d"]);
    expect(skip.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });
});
