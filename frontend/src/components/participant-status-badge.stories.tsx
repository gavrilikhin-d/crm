import preview from "../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { ParticipantStatusBadge } from "./participant-status-badge";

const meta = preview.meta({
  component: ParticipantStatusBadge,
  tags: ["ai-generated"]
});

export const Awaiting = meta.story({
  args: {
    status: "awaiting"
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Ожидает ответа")).toHaveAttribute("data-variant", "outline");
  }
});

export const Confirmed = meta.story({
  args: {
    status: "confirmed"
  }
});

export const DeclinedInteractive = meta.story({
  args: {
    status: "declined",
    interactive: true,
    ariaLabel: "Изменить статус участника",
    onStatusChange: fn()
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Изменить статус участника" }));
    await expect(args.onStatusChange).toHaveBeenCalledWith("confirmed");
  }
});
