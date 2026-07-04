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
    onSelectLesson: fn()
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
    onSelectLesson: fn()
  }
});
