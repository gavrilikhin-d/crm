import { describe, expect, test } from "bun:test";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import { formatBalanceMessage, formatNotLinkedMessage, formatScheduleMessage } from "./messages";

function createProfile(input?: Partial<TelegramStudentProfile>): TelegramStudentProfile {
  return {
    student: { id: "s1", fullName: "Alice <Test>" },
    balance: {
      studentId: "s1",
      paidLessons: 2,
      chargedLessons: 1,
      remainingLessons: 1,
      debtLessons: 0,
      ...input?.balance
    },
    upcomingLessons: input?.upcomingLessons ?? [],
    scheduleDays: input?.scheduleDays ?? 7
  };
}

function createLesson(startsAt: string): Lesson {
  const timestamp = new Date().toISOString();
  return {
    id: "l1",
    startsAt,
    durationMinutes: 60,
    originalType: "individual",
    effectiveType: "individual",
    status: "scheduled",
    participants: [
      {
        id: "p1",
        studentId: "s1",
        status: "awaiting",
        balanceCharged: false,
        hasDebt: false
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("formatNotLinkedMessage", () => {
  test("explains how to connect telegram", () => {
    expect(formatNotLinkedMessage()).toContain("не подключен");
  });
});

describe("formatBalanceMessage", () => {
  test("escapes html and shows remaining lessons", () => {
    const reply = formatBalanceMessage(createProfile());

    expect(typeof reply).toBe("object");
    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.parse_mode).toBe("HTML");
    expect(reply.text).toContain("Alice &lt;Test&gt;");
    expect(reply.text).toContain("Осталось занятий");
  });

  test("shows debt when present", () => {
    const reply = formatBalanceMessage(
      createProfile({
        balance: {
          studentId: "s1",
          paidLessons: 0,
          chargedLessons: 2,
          remainingLessons: 0,
          debtLessons: 2
        }
      })
    );

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("Долг");
  });
});

describe("formatScheduleMessage", () => {
  test("shows empty-state when there are no lessons", () => {
    const reply = formatScheduleMessage(createProfile());

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("занятий нет");
  });

  test("numbers lessons and includes attend hint", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);

    const reply = formatScheduleMessage(
      createProfile({
        upcomingLessons: [createLesson(tomorrow.toISOString())]
      })
    );

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("<b>1.");
    expect(reply.text).toContain("/attend N");
  });
});
