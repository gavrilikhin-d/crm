import preview from "../../.storybook/preview";
import { expect } from "storybook/test";
import { students } from "../../.storybook/fixtures";
import { StudentLink } from "./student-link";

const meta = preview.meta({
  component: StudentLink,
  tags: ["ai-generated"]
});

export const NextLink = meta.story({
  args: {
    studentId: students[0].id,
    children: students[0].fullName
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: students[0].fullName })).toHaveAttribute(
      "href",
      `/students/${students[0].id}`
    );
  }
});

export const StopPropagation = meta.story({
  args: {
    studentId: students[1].id,
    children: students[1].fullName,
    stopPropagation: true
  }
});
