import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { accountInfo, responsiveViewports, storybookCurrency } from "../../../.storybook/fixtures";
import { SettingsView } from "./index";

const meta = preview.meta({
  component: SettingsView,
  tags: ["ai-generated"]
});


export const PremiumAccount = meta.story({
  args: {
    accountInfo,
    currency: storybookCurrency,
    lessonReminderMinutes: [1440, 120],
    onCurrencyChange: fn(),
    onLessonReminderMinutesChange: async () => {},
    onRefresh: async () => {}
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Текущий тариф")).toBeVisible();
    await expect(await canvas.findByText("Google Calendar")).toBeVisible();
  }
});

export const WithoutAccountInfo = meta.story({
  args: {
    accountInfo: null,
    currency: storybookCurrency,
    lessonReminderMinutes: [1440, 120],
    onCurrencyChange: fn(),
    onLessonReminderMinutesChange: async () => {},
    onRefresh: async () => {}
  }
});
