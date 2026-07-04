import preview from "../../../../.storybook/preview";
import { fn } from "storybook/test";
import { Button } from "@/components/ui/button";
import { Modal } from "./modal";

const meta = preview.meta({
  component: Modal,
  tags: ["ai-generated"]
});

export const Open = meta.story({
  args: {
    open: true,
    title: "Добавить ученика",
    onClose: fn(),
    children: (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">Форма отображается внутри общего модального контейнера.</p>
        <Button>Сохранить</Button>
      </div>
    )
  }
});

export const Closed = meta.story({
  args: {
    open: false,
    title: "Добавить оплату",
    onClose: fn(),
    children: <Button>Сохранить</Button>
  }
});
