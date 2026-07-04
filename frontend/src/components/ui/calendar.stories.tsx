import preview from "../../../.storybook/preview";
import { Calendar } from "./calendar";

const meta = preview.meta({
  component: Calendar,
  tags: ["ai-generated"]
});

export const SingleDate = meta.story({
  args: {
    mode: "single",
    month: new Date("2024-04-01T00:00:00.000Z"),
    selected: new Date("2024-04-01T00:00:00.000Z")
  }
});

export const Range = meta.story({
  args: {
    mode: "range",
    month: new Date("2024-04-01T00:00:00.000Z"),
    selected: {
      from: new Date("2024-04-08T00:00:00.000Z"),
      to: new Date("2024-04-10T00:00:00.000Z")
    }
  }
});
