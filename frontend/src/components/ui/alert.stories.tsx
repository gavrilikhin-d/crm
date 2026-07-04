import preview from "../../../.storybook/preview";
import { Button } from "./button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";

const meta = preview.meta({
  component: Alert,
  tags: ["ai-generated"]
});

export const Info = meta.story({
  args: {
    children: (
      <>
        <AlertTitle>Синхронизация включена</AlertTitle>
        <AlertDescription>Занятия будут автоматически отправляться в Google Calendar.</AlertDescription>
      </>
    )
  }
});

export const DestructiveWithAction = meta.story({
  args: {
    variant: "destructive",
    children: (
      <>
        <AlertTitle>Достигнут лимит</AlertTitle>
        <AlertDescription>На текущем тарифе больше нельзя добавить ученика.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline">
            Настройки
          </Button>
        </AlertAction>
      </>
    )
  }
});
