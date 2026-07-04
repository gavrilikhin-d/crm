import preview from "../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { storybookCurrency } from "../../../../.storybook/fixtures";
import { PackageForm } from "./package-form";

const meta = preview.meta({
  component: PackageForm,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  args: {
    currency: storybookCurrency,
    onSubmit: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Название пакета")).toBeRequired();
  }
});
