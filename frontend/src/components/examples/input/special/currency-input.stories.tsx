import preview from "../../../../../.storybook/preview";
import { CurrencyInput } from "./currency-input";

const meta = preview.meta({
  component: CurrencyInput,
  tags: ["ai-generated"]
});

export const BelarusianRubles = meta.story({
  args: {
    currency: "BYN",
    placeholder: "0",
    defaultValue: 120
  }
});

export const Empty = meta.story({
  args: {
    currency: "BYN",
    placeholder: "0"
  }
});
