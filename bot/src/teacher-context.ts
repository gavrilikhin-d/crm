import type { InlineKeyboardMarkup } from "@telegraf/types";
import type { TelegramStudentProfile } from "@crm/shared";

function hasMultipleTeachers(profile: TelegramStudentProfile): boolean {
  return profile.teachers.length > 1;
}

function teacherContextKeyboard(profile: TelegramStudentProfile): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];

  for (const teacher of profile.teachers) {
    const active = teacher.studentId === profile.teacher.studentId;
    rows.push([
      {
        text: active ? `✓ ${teacher.name}` : teacher.name,
        callback_data: `tc:${teacher.studentId}`
      }
    ]);
  }

  return { inline_keyboard: rows };
}

function resolveTeacherContextCallback(callbackData: string): string | null {
  const match = callbackData.match(/^tc:(.+)$/);
  return match?.[1] ?? null;
}

function formatTeacherContextMessage(profile: TelegramStudentProfile, prefix?: string): string {
  if (!hasMultipleTeachers(profile)) {
    return [prefix, `У вас подключён один преподаватель: ${profile.teacher.name}.`]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    prefix,
    `Текущий преподаватель: ${profile.teacher.name}.`,
    "Выберите другого преподавателя кнопкой ниже."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatTeacherSwitchedMessage(profile: TelegramStudentProfile): string {
  return `Активный преподаватель: ${profile.teacher.name}.`;
}

export {
  formatTeacherContextMessage,
  formatTeacherSwitchedMessage,
  hasMultipleTeachers,
  resolveTeacherContextCallback,
  teacherContextKeyboard
};
