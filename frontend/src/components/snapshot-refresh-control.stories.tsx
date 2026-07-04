import preview from "../../.storybook/preview";
import { expect, fn } from "storybook/test";
import { SnapshotRefreshControl } from "./snapshot-refresh-control";

const meta = preview.meta({
  component: SnapshotRefreshControl,
  tags: ["ai-generated"]
});

export const Connected = meta.story({
  args: {
    secondsUntilRefresh: 30,
    connected: true,
    refreshing: false,
    lastRefreshedAt: new Date("2024-04-01T12:00:00.000Z"),
    onRefresh: fn()
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole("button", { name: "Обновить" });
    await userEvent.click(button);
    await expect(args.onRefresh).toHaveBeenCalled();
  }
});

export const Reconnecting = meta.story({
  args: {
    secondsUntilRefresh: 15,
    connected: false,
    refreshing: false,
    lastRefreshedAt: null,
    onRefresh: fn()
  }
});

export const Refreshing = meta.story({
  args: {
    secondsUntilRefresh: 30,
    connected: true,
    refreshing: true,
    lastRefreshedAt: new Date("2024-04-01T12:00:00.000Z"),
    onRefresh: fn()
  }
});
