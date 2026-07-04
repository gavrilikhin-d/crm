import preview from "../../../.storybook/preview";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "./native-select";

const meta = preview.meta({
  component: NativeSelect,
  tags: ["ai-generated"]
});

export const PaymentMethod = meta.story({
  args: {
    defaultValue: "transfer"
  },
  render: (args) => (
    <NativeSelect {...args} className="w-64">
      <NativeSelectOption value="transfer">Перевод</NativeSelectOption>
      <NativeSelectOption value="cash">Наличные</NativeSelectOption>
      <NativeSelectOption value="other">Другое</NativeSelectOption>
    </NativeSelect>
  )
});

export const Grouped = meta.story({
  render: () => (
    <NativeSelect className="w-64" defaultValue="BYN">
      <NativeSelectOptGroup label="Основные">
        <NativeSelectOption value="BYN">Белорусский рубль</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Международные">
        <NativeSelectOption value="USD">Доллар США</NativeSelectOption>
        <NativeSelectOption value="EUR">Евро</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  )
});
