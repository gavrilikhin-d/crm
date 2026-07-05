import preview from "../../../.storybook/preview";
import { responsiveViewports } from "../../../.storybook/fixtures";
import { expect, fn } from "storybook/test";
import {
  calendarRange,
  getStudent,
  lessons,
  makeMonthDays,
  makeWeekDays,
  selectedDate,
  storyNow,
  students,
  vacationPeriods
} from "../../../.storybook/fixtures";
import { ScheduleScreen } from "./index";

const meta = preview.meta({
  component: ScheduleScreen,
  tags: ["ai-generated"]
});


const baseArgs = {
  selectedDate,
  currentTime: storyNow,
  weekDays: makeWeekDays(),
  monthDays: makeMonthDays(),
  dayLessons: lessons.filter((lesson) => lesson.startsAt.startsWith("2024-04-01")),
  weekLessons: lessons,
  monthLessons: lessons,
  dayCalendarRange: calendarRange,
  dayScrollAnchor: 180,
  weekCalendarRange: calendarRange,
  weekScrollAnchor: 180,
  students,
  vacationPeriods,
  recurringEnabled: true,
  lessonFormKey: 1,
  lessonDialogOpen: false,
  setLessonDialogOpen: fn(),
  secondsUntilRefresh: 0,
  connected: true,
  refreshing: false,
  lastRefreshedAt: storyNow,
  refreshNow: async () => {},
  onShiftCalendar: fn(),
  onGoToToday: fn(),
  getStudent,
  onSelectLesson: fn(),
  onLessonTimeChange: fn(),
  onLessonSubmit: fn()
};

export const Week = meta.story({
  args: {
    ...baseArgs,
    scheduleView: "week",
    setScheduleView: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Неделя" })).toBeVisible();
  }
});

export const Day = meta.story({
  args: {
    ...baseArgs,
    scheduleView: "day",
    setScheduleView: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});

export const Month = meta.story({
  args: {
    ...baseArgs,
    scheduleView: "month",
    setScheduleView: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
