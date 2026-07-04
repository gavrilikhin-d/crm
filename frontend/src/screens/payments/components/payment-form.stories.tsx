import preview from "../../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { lessonPackages, storybookCurrency, students } from "../../../../.storybook/fixtures";
import { PaymentForm } from "./payment-form";

const meta = preview.meta({
  component: PaymentForm,
  tags: ["ai-generated"]
});

export const WithPackages = meta.story({
  args: {
    students,
    lessonPackages,
    currency: storybookCurrency,
    onSubmit: fn()
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Способ оплаты")).toBeVisible();
  }
});

export const WithoutPackages = meta.story({
  args: {
    students,
    lessonPackages: [],
    currency: storybookCurrency,
    onSubmit: fn()
  }
});
