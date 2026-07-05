"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarMenu, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/context";
import { getStudentInitials } from "@crm/shared/student-initials";

export function SidebarAccount() {
  const { t } = useI18n();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <DelayedSidebarAccountSkeleton signOutLabel={t("auth.signOut")} />;
  }

  const sessionUser = session?.user;

  if (!sessionUser) {
    return null;
  }

  const user = sessionUser as NonNullable<typeof sessionUser>;
  const initials = getStudentInitials(user.name || user.email);

  return (
    <>
      <SidebarSeparator className="mx-0" />
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="group/account relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0">
            <Avatar className="size-8 shrink-0 rounded-lg transition-opacity group-data-[collapsible=icon]:group-hover/account:opacity-0 group-data-[collapsible=icon]:group-focus-within/account:opacity-0">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
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

function DelayedSidebarAccountSkeleton({ signOutLabel }: { signOutLabel: string }) {
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowPlaceholders(true), 100);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return <SidebarAccountSkeleton signOutLabel={signOutLabel} showPlaceholders={showPlaceholders} />;
}

function SidebarAccountSkeleton({
  signOutLabel,
  showPlaceholders
}: {
  signOutLabel: string;
  showPlaceholders: boolean;
}) {
  return (
    <>
      <SidebarSeparator className="mx-0" />
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0">
            <Skeleton className={showPlaceholders ? "size-8 shrink-0 rounded-full" : "invisible size-8 shrink-0"} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
              <Skeleton className={showPlaceholders ? "h-4 w-24" : "invisible h-4 w-24"} />
              <Skeleton className={showPlaceholders ? "h-4 w-32" : "invisible h-4 w-32"} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
              aria-label={signOutLabel}
              title={signOutLabel}
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
