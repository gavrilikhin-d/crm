import preview from "../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { students } from "../../../../.storybook/fixtures";
import { LessonForm } from "./lesson-form";

const meta = preview.meta({
  component: LessonForm,
  tags: ["ai-generated"]
});

export const RecurringEnabled = meta.story({
  args: {
    students,
    recurringEnabled: true,
    defaultStartsAt: "2024-04-01T10:00",
    onSubmit: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Повторять еженедельно")).toBeVisible();
  }
});

export const RecurringDisabled = meta.story({
  args: {
    students,
    recurringEnabled: false,
    defaultStartsAt: "2024-04-01T10:00",
    onSubmit: fn()
  }
});
