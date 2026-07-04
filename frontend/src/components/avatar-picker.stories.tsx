import preview from "../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { AvatarPicker } from "./avatar-picker";

const meta = preview.meta({
  component: AvatarPicker,
  tags: ["ai-generated"]
});

export const Empty = meta.story({
  args: {
    fullName: "Анна Петрова",
    previewSrc: null,
    onFileSelect: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /avatar|фото|загруз/i })).toBeVisible();
  }
});

export const WithPreview = meta.story({
  args: {
    fullName: "Анна Петрова",
    previewSrc: "https://i.pravatar.cc/160?img=32",
    onFileSelect: fn(),
    onClear: fn()
  }
});
