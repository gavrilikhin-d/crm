import preview from "../../../.storybook/preview";
import { responsiveViewports } from "../../../.storybook/fixtures";
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
  }
});

export const SettingsFromQuery = meta.story({
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
