import { describe, expect, test } from "bun:test";
import type { Lesson, TelegramStudentProfile } from "@crm/shared";
import { formatBalanceMessage, formatNotLinkedMessage, formatScheduleMessage } from "./messages";

function createProfile(input?: Partial<TelegramStudentProfile>): TelegramStudentProfile {
  const teacher = input?.teacher ?? {
    studentId: input?.student?.id ?? "s1",
    accountId: "a1",
    name: "Teacher"
  };
  return {
    student: {
      id: teacher.studentId,
      fullName: "Alice <Test>",
      ...input?.student
    },
    teacher,
    teachers: input?.teachers ?? [teacher],
    settings: input?.settings ?? { lessonReminderMinutes: [1440, 120], timezone: "Europe/Minsk" },
    balance: {
      studentId: teacher.studentId,
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

function createLesson(startsAt: string, durationMinutes = 60): Lesson {
  const timestamp = new Date().toISOString();
  return {
    id: "l1",
    startsAt,
    durationMinutes,
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
    expect(reply.text).not.toContain("Преподаватель:");
  });

  test("shows active teacher when multiple teachers are linked", () => {
    const reply = formatBalanceMessage(
      createProfile({
        teacher: { studentId: "s1", accountId: "a1", name: "Alice <Teacher>" },
        teachers: [
          { studentId: "s1", accountId: "a1", name: "Alice <Teacher>" },
          { studentId: "s2", accountId: "a2", name: "Bob Teacher" }
        ]
      })
    );

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("Преподаватель: <b>Alice &lt;Teacher&gt;</b>");
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

  test("numbers lessons and includes attendance hint", () => {
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
    expect(reply.text).toContain("буду 1");
    expect(reply.text).not.toContain("/attend");
  });

  test("shows actual lesson time range from duration in teacher timezone", () => {
    // 18:00 Europe/Minsk == 15:00 UTC
    const startsAt = "2024-04-02T15:00:00.000Z";

    const reply = formatScheduleMessage(
      createProfile({
        settings: { lessonReminderMinutes: [1440, 120], timezone: "Europe/Minsk" },
        upcomingLessons: [createLesson(startsAt, 75)]
      })
    );

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("18:00–19:15");
  });

  test("uses student timezone override for schedule times", () => {
    // 18:00 Europe/Moscow == 15:00 UTC
    const startsAt = "2024-04-02T15:00:00.000Z";

    const reply = formatScheduleMessage(
      createProfile({
        student: { id: "s1", fullName: "Alice <Test>", timezone: "Europe/Moscow" },
        settings: { lessonReminderMinutes: [1440, 120], timezone: "UTC" },
        upcomingLessons: [createLesson(startsAt, 60)]
      })
    );

    if (typeof reply === "string") {
      throw new Error("expected html reply");
    }

    expect(reply.text).toContain("18:00–19:00");
    expect(reply.text).not.toContain("15:00–16:00");
  });
});
