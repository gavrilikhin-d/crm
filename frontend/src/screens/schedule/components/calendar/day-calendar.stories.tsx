import preview from "../../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { calendarRange, getStudent, lessons, responsiveViewports, selectedDate, storyNow, vacationPeriods } from "../../../../../.storybook/fixtures";
import { DayCalendar } from "./day-calendar";

const meta = preview.meta({
  component: DayCalendar,
  tags: ["ai-generated"]
});


export const Today = meta.story({
  args: {
    day: selectedDate,
    calendarRange,
    currentTime: storyNow,
    lessons: lessons.filter((lesson) => lesson.startsAt.startsWith("2024-04-01")),
    vacationPeriods,
    getStudent,
    onSelectLesson: fn(),
    onLessonUpdate: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Анна Петрова")).toBeVisible();
  }
});
