import preview from "../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { StudentAvatar, StudentAvatarUpload } from "./student-avatar";

const student = {
  id: "student-1",
  fullName: "Анна Петрова",
  avatarUrl: undefined,
  updatedAt: "2024-04-01T12:00:00.000Z"
};

const meta = preview.meta({
  component: StudentAvatar,
  tags: ["ai-generated"]
});

export const Fallback = meta.story({
  args: {
    student
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("АП")).toBeVisible();
  }
});

export const ConfirmedBadge = meta.story({
  args: {
    student,
    badge: "confirmed",
    size: "lg"
  }
});

export const DeclinedBadge = meta.story({
  args: {
    student,
    badge: "declined",
    size: "lg"
  }
});

export const UploadButton = meta.story({
  args: {
    student
  },
  render: ({ student }) => <StudentAvatarUpload student={student} onUpload={fn()} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /анна петрова/i })).toBeVisible();
  }
});
