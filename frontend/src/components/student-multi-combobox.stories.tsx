import preview from "../../.storybook/preview";
import { fn } from "storybook/test";
import { students } from "../../.storybook/fixtures";
import { StudentMultiCombobox } from "./student-multi-combobox";

const meta = preview.meta({
  component: StudentMultiCombobox,
  tags: ["ai-generated"]
});

export const Empty = meta.story({
  args: {
    students,
    value: [],
    onValueChange: fn(),
    placeholder: "Добавить ученика"
  }
});

export const WithSelection = meta.story({
  args: {
    students,
    value: ["student-anna", "student-ivan"],
    onValueChange: fn()
  }
});

export const Disabled = meta.story({
  args: {
    students: [],
    value: [],
    onValueChange: fn(),
    disabled: true
  }
});
