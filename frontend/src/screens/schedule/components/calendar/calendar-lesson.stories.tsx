import preview from "../../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { calendarRange, getStudent, lessons } from "../../../../../.storybook/fixtures";
import { CalendarLesson } from "./calendar-lesson";

const meta = preview.meta({
  component: CalendarLesson,
  tags: ["ai-generated"]
});

export const Individual = meta.story({
  args: {
    lesson: lessons[0],
    calendarRange,
    getStudent,
    onSelect: fn()
  },
  render: (args) => (
    <div className="relative h-[900px] w-80 rounded-lg border">
      <CalendarLesson {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Анна Петрова")).toBeVisible();
  }
});

export const GroupWithDebt = meta.story({
  args: {
    lesson: lessons[1],
    calendarRange,
    getStudent,
    onSelect: fn()
  },
  render: (args) => (
    <div className="relative h-[900px] w-80 rounded-lg border">
      <CalendarLesson {...args} />
    </div>
  )
});
