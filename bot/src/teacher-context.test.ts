import { describe, expect, test } from "bun:test";
import type { TelegramStudentProfile } from "@crm/shared";
import {
  formatTeacherContextMessage,
  hasMultipleTeachers,
  resolveTeacherContextCallback,
  teacherContextKeyboard
} from "./teacher-context";

function createProfile(overrides?: Partial<TelegramStudentProfile>): TelegramStudentProfile {
  const teacher = overrides?.teacher ?? {
    studentId: "s1",
    accountId: "a1",
    name: "Alice Teacher"
  };
  return {
    student: { id: teacher.studentId, fullName: "Shared Student", ...overrides?.student },
    teacher,
    teachers: overrides?.teachers ?? [teacher],
    settings: overrides?.settings ?? { lessonReminderMinutes: [60], timezone: "Europe/Minsk" },
    balance: {
      studentId: teacher.studentId,
      paidLessons: 0,
      chargedLessons: 0,
      remainingLessons: 0,
      debtLessons: 0,
      ...overrides?.balance
    },
    upcomingLessons: overrides?.upcomingLessons ?? [],
    scheduleDays: overrides?.scheduleDays ?? 7
  };
}

describe("hasMultipleTeachers", () => {
  test("is false for a single linked teacher", () => {
    expect(hasMultipleTeachers(createProfile())).toBe(false);
  });

  test("is true when more than one teacher is linked", () => {
    expect(
      hasMultipleTeachers(
        createProfile({
          teachers: [
            { studentId: "s1", accountId: "a1", name: "Alice Teacher" },
            { studentId: "s2", accountId: "a2", name: "Bob Teacher" }
          ]
        })
      )
    ).toBe(true);
  });
});

describe("teacherContextKeyboard", () => {
  test("marks the active teacher and exposes switch callbacks", () => {
    const profile = createProfile({
      teacher: { studentId: "s2", accountId: "a2", name: "Bob Teacher" },
      teachers: [
        { studentId: "s1", accountId: "a1", name: "Alice Teacher" },
        { studentId: "s2", accountId: "a2", name: "Bob Teacher" }
      ]
    });

    const labels = teacherContextKeyboard(profile)
      .inline_keyboard.flat()
      .map((button) => ("text" in button ? button.text : ""));
    const callbacks = teacherContextKeyboard(profile)
      .inline_keyboard.flat()
      .map((button) => ("callback_data" in button ? button.callback_data : undefined));

    expect(labels).toContain("Alice Teacher");
    expect(labels).toContain("✓ Bob Teacher");
    expect(callbacks).toContain("tc:s1");
    expect(callbacks).toContain("tc:s2");
  });
});

describe("resolveTeacherContextCallback", () => {
  test("parses teacher context callbacks", () => {
    expect(resolveTeacherContextCallback("tc:student-1")).toBe("student-1");
    expect(resolveTeacherContextCallback("cmd:teacher")).toBeNull();
  });
});

describe("formatTeacherContextMessage", () => {
  test("explains single-teacher state", () => {
    const text = formatTeacherContextMessage(createProfile());
    expect(text).toContain("один преподаватель");
    expect(text).toContain("Alice Teacher");
  });

  test("lists current teacher when multiple are linked", () => {
    const text = formatTeacherContextMessage(
      createProfile({
        teachers: [
          { studentId: "s1", accountId: "a1", name: "Alice Teacher" },
          { studentId: "s2", accountId: "a2", name: "Bob Teacher" }
        ]
      })
    );
    expect(text).toContain("Текущий преподаватель");
    expect(text).toContain("Alice Teacher");
    expect(text).toContain("кнопкой");
  });
});
