import preview from "../../../../../.storybook/preview";
import { CurrencyInput } from "./currency-input";

const meta = preview.meta({
  component: CurrencyInput,
  tags: ["ai-generated"]
});

export const Rubles = meta.story({
  args: {
    currency: "RUB",
    placeholder: "0",
    defaultValue: 3500
  }
});

export const Euros = meta.story({
  args: {
    currency: "EUR",
    placeholder: "0"
  }
});
