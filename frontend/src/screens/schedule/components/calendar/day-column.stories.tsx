import preview from "../../../../../.storybook/preview";
import { fn } from "storybook/test";
import { calendarRange, getStudent, lessons, selectedDate, storyNow, vacationPeriods } from "../../../../../.storybook/fixtures";
import { DayColumn } from "./day-column";

const meta = preview.meta({
  component: DayColumn,
  tags: ["ai-generated"]
});

export const WithLessons = meta.story({
  args: {
    day: selectedDate,
    calendarRange,
    currentTime: storyNow,
    lessons: lessons.filter((lesson) => lesson.startsAt.startsWith("2024-04-01")),
    getStudent,
    onSelectLesson: fn(),
    onLessonUpdate: fn()
  }
});

export const ConflictingLessons = meta.story({
  args: {
    day: selectedDate,
    calendarRange,
    currentTime: storyNow,
    lessons: [
      lessons[0],
      {
        ...lessons[0],
        id: "lesson-conflict-1",
        startsAt: "2024-04-01T10:00:00.000Z",
        participants: [
          {
            ...lessons[0].participants[0],
            id: "participant-conflict-1",
            studentId: "student-ivan"
          }
        ]
      },
      {
        ...lessons[0],
        id: "lesson-conflict-2",
        startsAt: "2024-04-01T10:45:00.000Z",
        durationMinutes: 45,
        participants: [
          {
            ...lessons[0].participants[0],
            id: "participant-conflict-2",
            studentId: "student-maria"
          }
        ]
      },
      {
        ...lessons[0],
        id: "lesson-conflict-3",
        startsAt: "2024-04-01T09:55:00.000Z",
        participants: [
          {
            ...lessons[0].participants[0],
            id: "participant-conflict-3",
            studentId: "student-ivan"
          }
        ]
      },
    ],
    getStudent,
    onSelectLesson: fn(),
    onLessonUpdate: fn()
  }
});

export const Vacation = meta.story({
  args: {
    day: new Date("2024-04-08T00:00:00.000Z"),
    calendarRange,
    currentTime: null,
    lessons: [],
    vacationPeriod: vacationPeriods[0],
    getStudent,
    onSelectLesson: fn(),
    onLessonUpdate: fn()
  }
});
