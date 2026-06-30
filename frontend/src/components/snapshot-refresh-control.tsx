"use client";

import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/i18n/format";
import { useI18n } from "@/i18n/context";
import { cn } from "@/lib/utils";

function SnapshotRefreshControl({
  secondsUntilRefresh,
  refreshing,
  showAutoRefreshed,
  lastRefreshedAt,
  onRefresh
}: {
  secondsUntilRefresh: number;
  refreshing: boolean;
  showAutoRefreshed: boolean;
  lastRefreshedAt: Date | null;
  onRefresh: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      {showAutoRefreshed ? (
        <Badge variant="secondary" className="hidden animate-in fade-in sm:inline-flex">
          {t("calendar.autoRefreshed")}
        </Badge>
      ) : null}

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
            <span className="tabular-nums">{secondsUntilRefresh}s</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-1">
            <span>{t("calendar.refreshIn", { seconds: secondsUntilRefresh })}</span>
            {lastRefreshedAt ? (
              <span className="text-background/80">
                {t("calendar.lastRefreshed", { time: formatTime(lastRefreshedAt) })}
              </span>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export { SnapshotRefreshControl };
