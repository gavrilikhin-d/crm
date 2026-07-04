import preview from "../../../../../.storybook/preview";
import { fn } from "storybook/test";
import { calendarRange, getStudent, lessons, makeWeekDays, responsiveViewports, storyNow, vacationPeriods } from "../../../../../.storybook/fixtures";
import { WeekCalendar } from "./week-calendar";

const meta = preview.meta({
  component: WeekCalendar,
  tags: ["ai-generated"]
});


export const CurrentWeek = meta.story({
  args: {
    weekDays: makeWeekDays(),
    calendarRange,
    currentTime: storyNow,
    lessons,
    vacationPeriods,
    getStudent,
    onSelectLesson: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
