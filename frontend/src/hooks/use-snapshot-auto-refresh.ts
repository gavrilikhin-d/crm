"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RefreshSource = "initial" | "manual" | "auto";

type UseSnapshotAutoRefreshOptions = {
  loadSnapshot: (options?: { silent?: boolean }) => Promise<void>;
  pollMs?: number;
};

function useSnapshotAutoRefresh({ loadSnapshot, pollMs = 30_000 }: UseSnapshotAutoRefreshOptions) {
  const pollSeconds = Math.max(1, Math.round(pollMs / 1000));
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(pollSeconds);
  const [refreshing, setRefreshing] = useState(false);
  const [showAutoRefreshed, setShowAutoRefreshed] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const loadSnapshotRef = useRef(loadSnapshot);
  const autoHideTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  loadSnapshotRef.current = loadSnapshot;

  const runRefresh = useCallback(
    async (source: RefreshSource) => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;
      setRefreshing(true);

      try {
        await loadSnapshotRef.current({ silent: source === "auto" });
        setLastRefreshedAt(new Date());
        setSecondsUntilRefresh(pollSeconds);

        if (source === "auto") {
          setShowAutoRefreshed(true);
          if (autoHideTimerRef.current) {
            window.clearTimeout(autoHideTimerRef.current);
          }
          autoHideTimerRef.current = window.setTimeout(() => setShowAutoRefreshed(false), 3_000);
        } else {
          setShowAutoRefreshed(false);
        }
      } finally {
        runningRef.current = false;
        setRefreshing(false);
      }
    },
    [pollSeconds]
  );

  useEffect(() => {
    void runRefresh("initial");
  }, [runRefresh]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      setSecondsUntilRefresh((current) => {
        if (current <= 1) {
          void runRefresh("auto");
          return pollSeconds;
        }

        return current - 1;
      });
    }, 1_000);

    return () => window.clearInterval(tick);
  }, [pollSeconds, runRefresh]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void runRefresh("auto");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (autoHideTimerRef.current) {
        window.clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [runRefresh]);

  const refreshNow = useCallback(() => runRefresh("manual"), [runRefresh]);

  return {
    secondsUntilRefresh,
    refreshing,
    showAutoRefreshed,
    lastRefreshedAt,
    refreshNow
  };
}

export { useSnapshotAutoRefresh };
