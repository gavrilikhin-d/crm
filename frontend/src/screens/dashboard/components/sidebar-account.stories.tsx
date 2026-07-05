import preview from "../../../../.storybook/preview";
import { expect } from "storybook/test";
import { Sidebar, SidebarContent, SidebarFooter, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { SidebarAccount } from "./sidebar-account";

const meta = preview.meta({
  component: SidebarAccount,
  tags: ["ai-generated"]
});

export const SignedIn = meta.story({
  render: () => (
    <SidebarProvider>
      <div className="w-72 rounded-lg border p-2">
        <SidebarAccount />
      </div>
    </SidebarProvider>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("teacher@example.com")).toBeVisible();
  }
});

export const CollapsedSignOutHover = meta.story({
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon" className="border-r border-stone-200">
        <SidebarContent />
        <SidebarFooter>
          <SidebarAccount />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <main className="min-h-96 flex-1 p-4">Контент</main>
    </SidebarProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(await canvas.findByText("ДА"));
    await expect(await canvas.findByRole("button", { name: "Выйти" })).toBeVisible();
  }
});
