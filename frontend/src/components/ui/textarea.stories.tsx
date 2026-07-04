import preview from "../../../.storybook/preview";
import { Textarea } from "./textarea";

const meta = preview.meta({
  component: Textarea,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    placeholder: "Комментарий к занятию",
    rows: 4
  }
});

export const WithValue = meta.story({
  args: {
    defaultValue: "Ученик подготовил домашнее задание.",
    rows: 4
  }
});
