import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { Checkbox } from "./checkbox";
import { Field, FieldContent, FieldLabel } from "./field";

const meta = preview.meta({
  component: Checkbox,
  tags: ["ai-generated"]
});

export const Unchecked = meta.story({
  args: {
    id: "repeat-weekly",
    onCheckedChange: fn()
  },
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox {...args} />
      <FieldContent>
        <FieldLabel htmlFor="repeat-weekly">Повторять еженедельно</FieldLabel>
      </FieldContent>
    </Field>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: "Повторять еженедельно" }));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  }
});

export const Checked = meta.story({
  args: {
    checked: true,
    id: "sync-enabled"
  },
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox {...args} />
      <FieldContent>
        <FieldLabel htmlFor="sync-enabled">Синхронизация включена</FieldLabel>
      </FieldContent>
    </Field>
  )
});
