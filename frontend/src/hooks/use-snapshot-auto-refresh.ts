"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/api";

type RefreshSource = "initial" | "manual" | "auto";

type UseSnapshotAutoRefreshOptions = {
  loadSnapshot: (options?: { silent?: boolean }) => Promise<void>;
  onSnapshot: (snapshot: unknown) => void;
  reconnectMs?: number;
};

function getSnapshotWebSocketUrl(token: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL?.trim();
  const baseUrl =
    configuredUrl ||
    (window.location.hostname === "localhost" && window.location.port === "3000"
      ? "ws://localhost:4000/api/ws/snapshot"
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws/snapshot`);
  const url = new URL(baseUrl);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }
  if (url.pathname === "/") {
    url.pathname = "/api/ws/snapshot";
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function useSnapshotAutoRefresh({ loadSnapshot, onSnapshot, reconnectMs = 5_000 }: UseSnapshotAutoRefreshOptions) {
  const reconnectSeconds = Math.max(1, Math.round(reconnectMs / 1000));
  const [secondsUntilReconnect, setSecondsUntilReconnect] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const loadSnapshotRef = useRef(loadSnapshot);
  const onSnapshotRef = useRef(onSnapshot);
  const runningRef = useRef(false);
  const receivedSnapshotRef = useRef(false);

  useEffect(() => {
    loadSnapshotRef.current = loadSnapshot;
  }, [loadSnapshot]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  const markRefreshed = useCallback(() => {
    setLastRefreshedAt(new Date());
  }, []);

  const runRefresh = useCallback(
    async (source: RefreshSource) => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;
      setRefreshing(true);

      try {
        await loadSnapshotRef.current({ silent: source === "auto" });
        markRefreshed();
      } finally {
        runningRef.current = false;
        setRefreshing(false);
      }
    },
    [markRefreshed]
  );

  useEffect(() => {
    let closed = false;
    let webSocket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let countdownTimer: number | null = null;

    function clearReconnectTimers() {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }

    function scheduleReconnect() {
      if (closed || reconnectTimer) {
        return;
      }

      setSecondsUntilReconnect(reconnectSeconds);
      countdownTimer = window.setInterval(() => {
        setSecondsUntilReconnect((current) => Math.max(0, current - 1));
      }, 1_000);
      reconnectTimer = window.setTimeout(() => {
        clearReconnectTimers();
        connect();
      }, reconnectMs);
    }

    async function connect() {
      const token = await getAccessToken();
      if (!token || closed) {
        void runRefresh("initial");
        scheduleReconnect();
        return;
      }

      webSocket = new WebSocket(getSnapshotWebSocketUrl(token));
      webSocket.addEventListener("open", () => {
        setConnected(true);
        setSecondsUntilReconnect(0);
        clearReconnectTimers();
      });
      webSocket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; payload?: unknown };
          if (message.type === "snapshot" && message.payload) {
            onSnapshotRef.current(message.payload);
            markRefreshed();
            receivedSnapshotRef.current = true;
          }
        } catch {
          // Ignore malformed websocket messages; the connection itself can keep streaming snapshots.
        }
      });
      webSocket.addEventListener("close", () => {
        setConnected(false);
        if (!closed) {
          void runRefresh("auto");
          scheduleReconnect();
        }
      });
      webSocket.addEventListener("error", () => {
        webSocket?.close();
      });
    }

    void connect();

    return () => {
      closed = true;
      clearReconnectTimers();
      webSocket?.close();
    };
  }, [markRefreshed, reconnectMs, reconnectSeconds, runRefresh]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !connected) {
        void runRefresh("auto");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connected, runRefresh]);

  const refreshNow = useCallback(() => runRefresh("manual"), [runRefresh]);

  return {
    secondsUntilRefresh: secondsUntilReconnect,
    connected,
    refreshing,
    lastRefreshedAt,
    refreshNow
  };
}

export { useSnapshotAutoRefresh };
