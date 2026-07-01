"use client";

import { CalendarDays, CreditCard, GraduationCap, Settings, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/context";
import type { ActiveSection } from "@/screens/dashboard/types";
import { SidebarAccount } from "./sidebar-account";
import { SidebarLink } from "./sidebar-link";

export function DashboardSidebar({
  activeSection,
  onSectionChange
}: {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
}) {
  const { t } = useI18n();

  return (
    <Sidebar collapsible="icon" className="border-r border-stone-200">
      <SidebarHeader className="px-3 py-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex h-8 items-center overflow-hidden">
          <span className="text-lg font-black tracking-[0.42em] text-orange-600 group-data-[collapsible=icon]:hidden">
            VOCAL
          </span>
          <span className="hidden text-lg font-black text-orange-600 group-data-[collapsible=icon]:block">V</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label={t("nav.mainAria")}>
              <SidebarLink
                icon={<CreditCard className="size-4" />}
                active={activeSection === "payments"}
                onClick={() => onSectionChange("payments")}
              >
                {t("nav.payments")}
              </SidebarLink>
              <SidebarLink
                icon={<Users className="size-4" />}
                active={activeSection === "clients"}
                onClick={() => onSectionChange("clients")}
              >
                {t("nav.students")}
              </SidebarLink>
              <SidebarLink
                icon={<CalendarDays className="size-4" />}
                active={activeSection === "schedule"}
                onClick={() => onSectionChange("schedule")}
              >
                {t("nav.schedule")}
              </SidebarLink>
              <SidebarLink
                icon={<GraduationCap className="size-4" />}
                active={activeSection === "sessions"}
                onClick={() => onSectionChange("sessions")}
              >
                {t("nav.packages")}
              </SidebarLink>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("nav.settings")}
              isActive={activeSection === "settings"}
              onClick={() => onSectionChange("settings")}
            >
              <Settings className="size-4" />
              <span>{t("nav.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarAccount />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
