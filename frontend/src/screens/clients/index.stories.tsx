import preview from "../../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { responsiveViewports, students } from "../../../.storybook/fixtures";
import { ClientsView } from "./index";

const meta = preview.meta({
  component: ClientsView,
  tags: ["ai-generated"]
});


export const WithStudents = meta.story({
  args: {
    students,
    onAddStudent: fn(),
    onEditStudent: fn(),
    onDeleteStudent: fn()
  },
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Анна Петрова")).toBeVisible();
  }
});

export const Empty = meta.story({
  args: {
    students: [],
    onAddStudent: fn(),
    onEditStudent: fn(),
    onDeleteStudent: fn()
  }
});
