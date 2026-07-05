"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarMenu, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/context";
import { getStudentInitials } from "@crm/shared/student-initials";

export function SidebarAccount() {
  const { t } = useI18n();
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const initials = getStudentInitials(session.user.name || session.user.email);

  return (
    <>
      <SidebarSeparator className="mx-0" />
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="group/account relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0">
            <Avatar className="size-8 shrink-0 rounded-lg transition-opacity group-data-[collapsible=icon]:group-hover/account:opacity-0 group-data-[collapsible=icon]:group-focus-within/account:opacity-0">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name} />
              <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{session.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:group-hover/account:pointer-events-auto group-data-[collapsible=icon]:group-hover/account:opacity-100 group-data-[collapsible=icon]:group-focus-within/account:pointer-events-auto group-data-[collapsible=icon]:group-focus-within/account:opacity-100"
              aria-label={t("auth.signOut")}
              title={t("auth.signOut")}
              onClick={() => void signOut({ callbackUrl: "/login" })}
            >
              <LogOut />
            </Button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
