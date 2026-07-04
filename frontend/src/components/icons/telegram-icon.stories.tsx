import preview from "../../../.storybook/preview";
import { TelegramIcon } from "./telegram-icon";

const meta = preview.meta({
  component: TelegramIcon,
  tags: ["ai-generated"]
});

export const Default = meta.story({});

export const Large = meta.story({
  args: {
    className: "size-10"
  }
});
