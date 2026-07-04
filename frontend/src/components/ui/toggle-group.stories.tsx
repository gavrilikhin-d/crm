import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = preview.meta({
  component: ToggleGroup,
  tags: ["ai-generated"]
});

export const ScheduleView = meta.story({
  args: {
    type: "single",
    value: "week",
    onValueChange: fn()
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="day">День</ToggleGroupItem>
      <ToggleGroupItem value="week">Неделя</ToggleGroupItem>
      <ToggleGroupItem value="month">Месяц</ToggleGroupItem>
    </ToggleGroup>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Месяц" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("month");
  }
});

export const Multiple = meta.story({
  args: {
    type: "multiple",
    defaultValue: ["confirmed"]
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="awaiting">Ожидает</ToggleGroupItem>
      <ToggleGroupItem value="confirmed">Подтверждено</ToggleGroupItem>
      <ToggleGroupItem value="declined">Отказ</ToggleGroupItem>
    </ToggleGroup>
  )
});
