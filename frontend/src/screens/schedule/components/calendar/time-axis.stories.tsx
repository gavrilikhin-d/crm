import preview from "../../../../../.storybook/preview";
import { calendarRange } from "../../../../../.storybook/fixtures";
import { TimeAxis } from "./time-axis";

const meta = preview.meta({
  component: TimeAxis,
  tags: ["ai-generated"]
});

export const BusinessHours = meta.story({
  args: {
    calendarRange
  }
});
