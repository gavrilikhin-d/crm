import preview from "../../../.storybook/preview";
import { expect } from "storybook/test";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = preview.meta({
  component: Card,
  tags: ["ai-generated"]
});

export const AccountSummary = meta.story({
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Текущий тариф</CardTitle>
          <CardDescription>Использование лимитов вашего тарифа.</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline">
              Обновить
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>Премиум</p>
        </CardContent>
      </>
    )
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Текущий тариф")).toHaveAttribute("data-slot", "card-title");
  }
});

export const WithFooter = meta.story({
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Следующее занятие</CardTitle>
          <CardDescription>Сегодня, 18:00</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Анна Петрова</p>
        </CardContent>
        <CardFooter>Подтверждено</CardFooter>
      </>
    )
  }
});

export const Small = meta.story({
  args: {
    size: "sm",
    children: (
      <>
        <CardHeader>
          <CardTitle>Мини-карточка</CardTitle>
        </CardHeader>
        <CardContent>Компактный размер</CardContent>
      </>
    )
  }
});
