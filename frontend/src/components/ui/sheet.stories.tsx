import preview from "../../../.storybook/preview";
import { Button } from "./button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

const meta = preview.meta({
  component: Sheet,
  tags: ["ai-generated"]
});

export const RightSide = meta.story({
  args: {
    defaultOpen: true
  },
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button>Открыть занятие</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Понедельник, 1 апреля</SheetTitle>
          <SheetDescription>10:00 – 11:00</SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm">Анна Петрова, индивидуальное занятие.</div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Закрыть</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
});

export const BottomSide = meta.story({
  args: {
    defaultOpen: true
  },
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button>Открыть</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Быстрое действие</SheetTitle>
          <SheetDescription>Добавьте оплату или ученика.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
});
