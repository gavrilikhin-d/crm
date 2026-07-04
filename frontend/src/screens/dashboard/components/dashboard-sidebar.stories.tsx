import preview from "../../../../.storybook/preview";
import { responsiveViewports } from "../../../../.storybook/fixtures";
import { expect, fn } from "storybook/test";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./dashboard-sidebar";

const meta = preview.meta({
  component: DashboardSidebar,
  tags: ["ai-generated"]
});


export const ScheduleActive = meta.story({
  args: {
    activeSection: "schedule",
    onSectionChange: fn()
  },
  render: (args) => (
    <SidebarProvider>
      <DashboardSidebar {...args} />
      <main className="min-h-96 flex-1 p-4">Контент</main>
    </SidebarProvider>
  ),
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("VOCAL")).toBeVisible();
  }
});

export const SettingsActive = meta.story({
  args: {
    activeSection: "settings",
    onSectionChange: fn()
  },
  render: (args) => (
    <SidebarProvider>
      <DashboardSidebar {...args} />
      <main className="min-h-96 flex-1 p-4">Контент</main>
    </SidebarProvider>
  ),
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
