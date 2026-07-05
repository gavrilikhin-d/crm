"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/i18n/format";
import { useI18n } from "@/i18n/context";
import { cn } from "@/lib/utils";

function SnapshotRefreshControl({
  secondsUntilRefresh,
  connected,
  refreshing,
  lastRefreshedAt,
  onRefresh
}: {
  secondsUntilRefresh: number;
  connected: boolean;
  refreshing: boolean;
  lastRefreshedAt: Date | null;
  onRefresh: () => void;
}) {
  const { locale, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
            aria-label={t("calendar.refresh")}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} data-icon="inline-start" />
            <span>{connected ? t("calendar.live") : t("calendar.reconnectingShort")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-1">
            <span>
              {connected
                ? t("calendar.liveUpdates")
                : t("calendar.reconnecting", { seconds: secondsUntilRefresh })}
            </span>
            {lastRefreshedAt ? (
              <span className="text-background/80">
                {t("calendar.lastRefreshed", { time: formatTime(lastRefreshedAt, locale) })}
              </span>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export { SnapshotRefreshControl };
