import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { lessonPackages, responsiveViewports, storybookCurrency } from "../../../.storybook/fixtures";
import { SessionsView } from "./index";

const meta = preview.meta({
  component: SessionsView,
  tags: ["ai-generated"]
});


export const WithPackages = meta.story({
  args: {
    lessonPackages,
    currency: storybookCurrency,
    onAddPackage: fn(),
    onDeletePackage: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Абонемент 4 занятия")).toBeVisible();
  }
});

export const Empty = meta.story({
  args: {
    lessonPackages: [],
    currency: storybookCurrency,
    onAddPackage: fn(),
    onDeletePackage: fn()
  }
});
