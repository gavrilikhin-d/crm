import preview from "../../../.storybook/preview";
import { Checkbox } from "./checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle
} from "./field";
import { Input } from "./input";

const meta = preview.meta({
  component: Field,
  tags: ["ai-generated"]
});

export const TextField = meta.story({
  render: () => (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="field-name">ФИО</FieldLabel>
        <Input id="field-name" placeholder="Анна Петрова" />
        <FieldDescription>Используется в расписании и платежах.</FieldDescription>
      </Field>
    </FieldGroup>
  )
});

export const Invalid = meta.story({
  render: () => (
    <FieldGroup className="max-w-sm">
      <Field data-invalid>
        <FieldLabel htmlFor="field-invalid">Email</FieldLabel>
        <Input id="field-invalid" aria-invalid defaultValue="teacher" />
        <FieldError>Введите корректный email.</FieldError>
      </Field>
    </FieldGroup>
  )
});

export const Fieldset = meta.story({
  render: () => (
    <FieldSet className="max-w-sm">
      <FieldLegend>Уведомления</FieldLegend>
      <FieldDescription>Выберите каналы напоминаний.</FieldDescription>
      <FieldSeparator />
      <Field orientation="horizontal">
        <Checkbox id="telegram-notify" defaultChecked />
        <FieldContent>
          <FieldTitle>Telegram</FieldTitle>
          <FieldLabel htmlFor="telegram-notify">Отправлять напоминания ученикам</FieldLabel>
        </FieldContent>
      </Field>
    </FieldSet>
  )
});
