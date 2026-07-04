import preview from "../../../.storybook/preview";
import { Input } from "./input";
import { Label } from "./label";

const meta = preview.meta({
  component: Label,
  tags: ["ai-generated"]
});

export const ForInput = meta.story({
  args: {
    htmlFor: "label-story-input",
    children: "Имя ученика"
  },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label {...args} />
      <Input id="label-story-input" placeholder="Анна Петрова" />
    </div>
  )
});
