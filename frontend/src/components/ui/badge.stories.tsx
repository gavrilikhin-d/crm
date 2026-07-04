import preview from "../../../.storybook/preview";
import { expect } from "storybook/test";
import { Badge } from "./badge";

const meta = preview.meta({
  component: Badge,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    children: "Активный"
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Активный")).toHaveAttribute("data-variant", "default");
  }
});

export const Secondary = meta.story({
  args: {
    children: "Пакет",
    variant: "secondary"
  }
});

export const Destructive = meta.story({
  args: {
    children: "Долг",
    variant: "destructive"
  }
});

export const Outline = meta.story({
  args: {
    children: "Ожидает",
    variant: "outline"
  }
});
