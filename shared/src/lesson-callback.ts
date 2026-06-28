export type LessonCallbackAction = "attend" | "decline";

const actionPrefix: Record<LessonCallbackAction, string> = {
  attend: "la",
  decline: "ld"
};

const prefixAction: Record<string, LessonCallbackAction> = {
  la: "attend",
  ld: "decline"
};

export function encodeLessonCallback(
  action: LessonCallbackAction,
  lessonId: string,
  studentId: string
): string {
  return `${actionPrefix[action]}:${lessonId}:${studentId}`;
}

export function parseLessonCallback(data: string): {
  action: LessonCallbackAction;
  lessonId: string;
  studentId: string;
} | null {
  const compact = data.match(/^(la|ld):([^:]+):([^:]+)$/);
  if (compact) {
    const action = prefixAction[compact[1]];
    if (!action) {
      return null;
    }

    return {
      action,
      lessonId: compact[2],
      studentId: compact[3]
    };
  }

  const legacy = data.match(/^lesson:([^:]+):student:([^:]+):(attend|decline)$/);
  if (legacy) {
    return {
      action: legacy[3] as LessonCallbackAction,
      lessonId: legacy[1],
      studentId: legacy[2]
    };
  }

  return null;
}

export function lessonReminderKeyboard(lessonId: string, studentId: string) {
  return {
    inline_keyboard: [
      [
        { text: "👍 Буду", callback_data: encodeLessonCallback("attend", lessonId, studentId) },
        { text: "👎 Не буду", callback_data: encodeLessonCallback("decline", lessonId, studentId) }
      ]
    ]
  };
}
