import preview from "../../../.storybook/preview";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from "./command";

const meta = preview.meta({
  component: Command,
  tags: ["ai-generated"]
});

export const Palette = meta.story({
  render: () => (
    <Command className="max-w-md rounded-lg border">
      <CommandInput placeholder="Найти действие..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено.</CommandEmpty>
        <CommandGroup heading="Действия">
          <CommandItem>Добавить ученика</CommandItem>
          <CommandItem>Запланировать занятие</CommandItem>
          <CommandItem>Добавить оплату</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Разделы">
          <CommandItem>
            Расписание
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
});

export const Dialog = meta.story({
  render: () => (
    <CommandDialog open title="Командная палитра" description="Быстрый переход по CRM">
      <Command>
        <CommandInput placeholder="Найти..." />
        <CommandList>
          <CommandGroup heading="Разделы">
            <CommandItem>Ученики</CommandItem>
            <CommandItem>Оплаты</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
});
