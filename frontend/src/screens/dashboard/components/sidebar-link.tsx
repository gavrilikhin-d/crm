"use client";

import type { ReactNode } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarLink({
  icon,
  active,
  onClick,
  children
}: {
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={active}
        tooltip={typeof children === "string" ? children : undefined}
        onClick={onClick}
        className={cn(
          "h-10 font-bold text-stone-500 hover:bg-orange-50 hover:text-orange-700",
          "data-[active=true]:bg-orange-50 data-[active=true]:text-orange-700",
          active && "text-orange-700"
        )}
      >
        {icon}
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
