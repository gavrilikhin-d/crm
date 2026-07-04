import preview from "../../.storybook/preview";
import { http, HttpResponse } from "msw";
import { expect } from "storybook/test";
import { GoogleCalendarSettings } from "./google-calendar-settings";

const meta = preview.meta({
  component: GoogleCalendarSettings,
  tags: ["ai-generated"]
});

export const Connected = meta.story({
  args: {
    onChanged: async () => {}
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Google Calendar")).toBeVisible();
    await expect(await canvas.findByRole("button", { name: /синхронизировать/i })).toBeVisible();
  }
});

export const Disconnected = meta.story({
  args: {
    onChanged: async () => {}
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/google-calendar/status", () =>
          HttpResponse.json({
            connected: false,
            syncEnabled: false,
            calendarId: ""
          })
        )
      ]
    }
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: /подключить/i })).toBeVisible();
  }
});
