import preview from "../../../.storybook/preview";
import { responsiveViewports } from "../../../.storybook/fixtures";
import { CalendarDays, CreditCard, Settings, Users } from "lucide-react";
import { expect } from "storybook/test";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger
} from "./sidebar";

const meta = preview.meta({
  component: Sidebar,
  tags: ["ai-generated"]
});


function SidebarExample({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const items = [
    { label: "Расписание", icon: CalendarDays, active: true },
    { label: "Ученики", icon: Users },
    { label: "Оплаты", icon: CreditCard },
    { label: "Настройки", icon: Settings }
  ];

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarInput placeholder="Поиск..." />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>CRM</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={item.active}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.active ? <SidebarMenuBadge>3</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarMenuSkeleton showIcon />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>teacher@example.com</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-80 p-4">
        <SidebarTrigger />
        <div className="mt-4 rounded-lg border p-4">Основной контент</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Expanded = meta.story({
  render: () => <SidebarExample />,
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Расписание")).toBeVisible();
  }
});

export const Collapsed = meta.story({
  render: () => <SidebarExample defaultOpen={false} />,
  parameters: {
    chromatic: {
      viewports: responsiveViewports
    }
  }
});
