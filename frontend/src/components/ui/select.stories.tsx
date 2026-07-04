import preview from "../../../.storybook/preview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "./select";

const meta = preview.meta({
  component: Select,
  tags: ["ai-generated"]
});

export const Currency = meta.story({
  args: {
    defaultValue: "RUB"
  },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Валюта" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Валюты</SelectLabel>
          <SelectItem value="RUB">Российский рубль</SelectItem>
          <SelectItem value="BYN">Белорусский рубль</SelectItem>
          <SelectSeparator />
          <SelectItem value="USD">Доллар США</SelectItem>
          <SelectItem value="EUR">Евро</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
});

export const Open = meta.story({
  args: {
    defaultOpen: true,
    defaultValue: "week"
  },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Вид расписания" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="day">День</SelectItem>
        <SelectItem value="week">Неделя</SelectItem>
        <SelectItem value="month">Месяц</SelectItem>
      </SelectContent>
    </Select>
  )
});
