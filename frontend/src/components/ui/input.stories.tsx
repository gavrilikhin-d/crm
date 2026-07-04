import preview from "../../../.storybook/preview";
import { Input } from "./input";

const meta = preview.meta({
  component: Input,
  tags: ["ai-generated"]
});

export const Text = meta.story({
  args: {
    placeholder: "ФИО"
  }
});

export const Email = meta.story({
  args: {
    type: "email",
    defaultValue: "teacher@example.com"
  }
});

export const Disabled = meta.story({
  args: {
    defaultValue: "Недоступно",
    disabled: true
  }
});
