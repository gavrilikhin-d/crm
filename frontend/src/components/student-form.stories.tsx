import preview from "../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { students } from "../../.storybook/fixtures";
import { StudentForm } from "./student-form";

const meta = preview.meta({
  component: StudentForm,
  tags: ["ai-generated"]
});

export const Create = meta.story({
  args: {
    submitLabel: "Добавить ученика",
    onSubmit: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("ФИО")).toBeRequired();
  }
});

export const Edit = meta.story({
  args: {
    student: students[0],
    submitLabel: "Сохранить",
    onSubmit: fn(),
    onCancel: fn()
  }
});
