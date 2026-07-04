import preview from "../../.storybook/preview";
import { expect } from "storybook/test";
import { DateTimePicker } from "./date-time-picker";

const meta = preview.meta({
  component: DateTimePicker,
  tags: ["ai-generated"]
});

export const WithDefaultValue = meta.story({
  args: {
    name: "startsAt",
    defaultValue: "2024-04-01T10:00",
    required: true
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /1 апреля 2024/i })).toBeVisible();
  }
});

export const Empty = meta.story({
  args: {
    name: "startsAt"
  }
});
