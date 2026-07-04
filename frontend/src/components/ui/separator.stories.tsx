import preview from "../../../.storybook/preview";
import { Separator } from "./separator";

const meta = preview.meta({
  component: Separator,
  tags: ["ai-generated"]
});

export const Horizontal = meta.story({
  render: () => (
    <div className="grid max-w-sm gap-3">
      <p className="text-sm">Основная информация</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Дополнительные настройки</p>
    </div>
  )
});

export const Vertical = meta.story({
  args: {
    orientation: "vertical"
  },
  render: (args) => (
    <div className="flex h-12 items-center gap-3">
      <span>День</span>
      <Separator {...args} />
      <span>Неделя</span>
    </div>
  )
});
