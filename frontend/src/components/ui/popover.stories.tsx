import preview from "../../../.storybook/preview";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover";

const meta = preview.meta({
  component: Popover,
  tags: ["ai-generated"]
});

export const Open = meta.story({
  args: {
    defaultOpen: true
  },
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Открыть подсказку</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Быстрое действие</PopoverTitle>
          <PopoverDescription>Добавьте занятие или оплату из текущего раздела.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
});
