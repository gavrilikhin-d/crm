import preview from "../../../.storybook/preview";
import { Bold } from "lucide-react";
import { Toggle } from "./toggle";

const meta = preview.meta({
  component: Toggle,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    children: "День"
  }
});

export const Pressed = meta.story({
  args: {
    pressed: true,
    children: "Неделя"
  }
});

export const WithIcon = meta.story({
  args: {
    "aria-label": "Жирный текст",
    children: <Bold data-icon="inline-start" />
  }
});
