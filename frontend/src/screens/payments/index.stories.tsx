import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { getStudent, payments, responsiveViewports, storybookCurrency } from "../../../.storybook/fixtures";
import { PaymentsView } from "./index";

const meta = preview.meta({
  component: PaymentsView,
  tags: ["ai-generated"]
});


export const WithPayments = meta.story({
  args: {
    payments,
    currency: storybookCurrency,
    getStudent,
    onAddPayment: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("История оплат")).toBeVisible();
  }
});

export const Empty = meta.story({
  args: {
    payments: [],
    currency: storybookCurrency,
    getStudent,
    onAddPayment: fn()
  }
});
