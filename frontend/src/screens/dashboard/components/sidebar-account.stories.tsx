import preview from "../../../../.storybook/preview";
import { expect } from "storybook/test";
import { SidebarProvider } from "@/components/ui/sidebar";
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
