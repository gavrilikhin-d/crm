import preview from "../../../../.storybook/preview";
import { CalendarDays } from "lucide-react";
import { fn } from "storybook/test";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarLink } from "./sidebar-link";

const meta = preview.meta({
  component: SidebarLink,
  tags: ["ai-generated"]
});

export const Active = meta.story({
  args: {
    icon: <CalendarDays />,
    active: true,
    onClick: fn(),
    children: "Расписание"
  },
  render: (args) => (
    <SidebarProvider>
      <SidebarMenu className="w-64">
        <SidebarLink {...args} />
      </SidebarMenu>
    </SidebarProvider>
  )
});

export const Inactive = meta.story({
  args: {
    icon: <CalendarDays />,
    active: false,
    onClick: fn(),
    children: "Расписание"
  },
  render: (args) => (
    <SidebarProvider>
      <SidebarMenu className="w-64">
        <SidebarLink {...args} />
      </SidebarMenu>
    </SidebarProvider>
  )
});
