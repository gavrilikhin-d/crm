import preview from "../../../.storybook/preview";
import { expect } from "storybook/test";
import LoginPage from "./index";

const meta = preview.meta({
  component: LoginPage,
  tags: ["ai-generated"]
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText("VOCAL")).toBeVisible();
  }
});
