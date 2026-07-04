import preview from "../../../.storybook/preview";
import { responsiveViewports } from "../../../.storybook/fixtures";
import { expect } from "storybook/test";
import Home from "./index";

const meta = preview.meta({
  component: Home,
  tags: ["ai-generated"]
});


export const ScheduleShell = meta.story({
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("VOCAL")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Расписание" })).toBeVisible();
  }
});

export const SettingsFromQuery = meta.story({
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Настройки" }));
    await expect(canvas.getByRole("heading", { name: "Настройки" })).toBeVisible();
  }
});
