import { describe, expect, test } from "bun:test";
import type { Lesson } from "./types";
import {
  assertStudentCanChangeParticipantStatus,
  canStudentChangeParticipantStatus,
  normalizeTeacherParticipantStatus,
  toTeacherParticipantStatus
} from "./lesson-attendance";

function createLesson(overrides: Partial<Lesson> & Pick<Lesson, "startsAt">): Lesson {
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    id: "lesson-1",
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "scheduled",
    participants: [
      {
        id: "participant-1",
        studentId: "student-1",
        status: "awaiting",
        balanceCharged: false,
        hasDebt: false
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

describe("canStudentChangeParticipantStatus", () => {
  const now = new Date("2026-07-01T12:00:00.000Z").getTime();

  test("allows changes before lesson start", () => {
    const lesson = createLesson({ startsAt: "2026-07-01T18:00:00.000Z" });
    expect(canStudentChangeParticipantStatus(lesson, now)).toBe(true);
  });

  test("blocks changes after lesson start", () => {
    const lesson = createLesson({ startsAt: "2026-07-01T11:00:00.000Z" });
    expect(canStudentChangeParticipantStatus(lesson, now)).toBe(false);
  });

  test("blocks changes for completed and cancelled lessons", () => {
    const future = createLesson({ startsAt: "2026-07-01T18:00:00.000Z" });
    expect(canStudentChangeParticipantStatus({ ...future, status: "completed" }, now)).toBe(false);
    expect(canStudentChangeParticipantStatus({ ...future, status: "cancelled_by_teacher" }, now)).toBe(false);
  });
});

describe("assertStudentCanChangeParticipantStatus", () => {
  const now = new Date("2026-07-01T12:00:00.000Z").getTime();

  test("throws for past lessons", () => {
    const lesson = createLesson({ startsAt: "2026-07-01T11:00:00.000Z" });
    expect(() => assertStudentCanChangeParticipantStatus(lesson, now)).toThrow(
      "Cannot change attendance for a past lesson"
    );
  });
});

describe("teacher participant status helpers", () => {
  test("maps attended-like statuses to confirmed for teacher UI", () => {
    expect(toTeacherParticipantStatus("awaiting")).toBe("confirmed");
    expect(toTeacherParticipantStatus("confirmed")).toBe("confirmed");
    expect(toTeacherParticipantStatus("attended")).toBe("confirmed");
    expect(toTeacherParticipantStatus("declined")).toBe("declined");
  });

  test("normalizes confirmed to attended on completed lessons", () => {
    const lesson = createLesson({ startsAt: "2026-07-01T11:00:00.000Z", status: "completed" });
    expect(normalizeTeacherParticipantStatus(lesson, "confirmed")).toBe("attended");
    expect(normalizeTeacherParticipantStatus(lesson, "declined")).toBe("declined");
  });
});
