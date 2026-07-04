import preview from "../../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { getStudent, lessons } from "../../../../../.storybook/fixtures";
import { MonthLessonChip } from "./month-lesson-chip";

const meta = preview.meta({
  component: MonthLessonChip,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    lesson: lessons[1],
    getStudent,
    onSelect: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Анна Петрова")).toBeVisible();
  }
});

export const Compact = meta.story({
  args: {
    lesson: lessons[1],
    compact: true,
    getStudent,
    onSelect: fn()
  }
});
