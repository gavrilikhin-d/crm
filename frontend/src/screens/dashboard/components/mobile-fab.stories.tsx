import preview from "../../../../.storybook/preview";
import { responsiveViewports } from "../../../../.storybook/fixtures";
import { fn } from "storybook/test";
import { MobileFab } from "./mobile-fab";

const meta = preview.meta({
  component: MobileFab,
  tags: ["ai-generated"]
});


const actions = {
  onScheduleLesson: fn(),
  onAddStudent: fn(),
  onAddPayment: fn(),
  onAddPackage: fn()
};

export const Schedule = meta.story({
  args: {
    activeSection: "schedule",
    ...actions
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});

export const Clients = meta.story({
  args: {
    activeSection: "clients",
    ...actions
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});

export const SettingsHidden = meta.story({
  args: {
    activeSection: "settings",
    ...actions
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
