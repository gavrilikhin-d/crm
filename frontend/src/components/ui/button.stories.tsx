import preview from "../../../.storybook/preview";
import { expect } from "storybook/test";
import { Mail } from "lucide-react";
import { Button } from "./button";

const meta = preview.meta({
  component: Button,
  tags: ["ai-generated"]
});

export const Primary = meta.story({
  args: {
    children: "Сохранить"
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("button", { name: String(args.children) })).toHaveAttribute("data-variant", "default");
  }
});

export const SecondaryWithIcon = meta.story({
  args: {
    children: (
      <>
        <Mail data-icon="inline-start" />
        Написать
      </>
    ),
    variant: "secondary"
  }
});

export const OutlineLink = meta.story({
  args: {
    asChild: true,
    children: <a href="/settings">Открыть настройки</a>,
    variant: "outline"
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Открыть настройки" })).toHaveAttribute("href", "/settings");
  }
});

export const Disabled = meta.story({
  args: {
    children: "Сохранение...",
    disabled: true
  }
});

export const CssCheck = meta.story({
  args: {
    children: "Проверить CSS"
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Проверить CSS" });
    // Button's default size uses Tailwind's h-8 utility, which resolves to 32px.
    await expect(getComputedStyle(button).height).toBe("32px");
  }
});
