import preview from "../../../.storybook/preview";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = preview.meta({
  component: Toaster,
  tags: ["ai-generated"]
});

export const ToastTypes = meta.story({
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button type="button" onClick={() => toast.success("Сохранено")}>
        Success
      </Button>
      <Button type="button" variant="outline" onClick={() => toast.warning("Есть пропущенные события")}>
        Warning
      </Button>
      <Button type="button" variant="destructive" onClick={() => toast.error("Не удалось сохранить")}>
        Error
      </Button>
    </div>
  )
});
