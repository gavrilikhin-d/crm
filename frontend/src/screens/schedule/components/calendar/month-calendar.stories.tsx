import preview from "../../../../../.storybook/preview";
import { fn } from "storybook/test";
import { getStudent, lessons, makeMonthDays, responsiveViewports, selectedDate, storyNow, vacationPeriods } from "../../../../../.storybook/fixtures";
import { MonthCalendar } from "./month-calendar";

const meta = preview.meta({
  component: MonthCalendar,
  tags: ["ai-generated"]
});


export const CurrentMonth = meta.story({
  args: {
    selectedDate,
    monthDays: makeMonthDays(),
    currentTime: storyNow,
    lessons,
    vacationPeriods,
    getStudent,
    onSelectDay: fn(),
    onSelectLesson: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
