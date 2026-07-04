import preview from "../../.storybook/preview";
import { fn } from "storybook/test";
import { students } from "../../.storybook/fixtures";
import { StudentCombobox } from "./student-combobox";

const meta = preview.meta({
  component: StudentCombobox,
  tags: ["ai-generated"]
});

export const Empty = meta.story({
  args: {
    students,
    value: "",
    onValueChange: fn(),
    placeholder: "Выберите ученика"
  }
});

export const Selected = meta.story({
  args: {
    students,
    value: "student-anna",
    onValueChange: fn()
  }
});

export const Disabled = meta.story({
  args: {
    students,
    value: "",
    onValueChange: fn(),
    disabled: true
  }
});
