"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { calendarHeaderHeight } from "@/screens/dashboard/constants";

export function CalendarScrollArea({
  children,
  minWidth,
  scrollAnchorOffset,
  scrollKey,
  stickyHeader
}: {
  children: ReactNode;
  minWidth?: number;
  scrollAnchorOffset?: number;
  scrollKey?: string;
  stickyHeader?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef<string | null>(null);
  const enableVerticalScroll = scrollAnchorOffset !== undefined || stickyHeader;

  useEffect(() => {
    didScrollRef.current = null;
  }, [scrollKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || scrollAnchorOffset === undefined || !scrollKey) {
      return;
    }

    if (didScrollRef.current === scrollKey) {
      return;
    }

    const headerHeight = calendarHeaderHeight;
    const targetTop = headerHeight + scrollAnchorOffset;
    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, targetTop - container.clientHeight / 3);
      didScrollRef.current = scrollKey;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scrollAnchorOffset, scrollKey]);

  return (
    <div
      ref={enableVerticalScroll ? containerRef : undefined}
      className={cn(
        "-mx-4 px-4 sm:mx-0 sm:px-0",
        enableVerticalScroll
          ? "max-h-[calc(100dvh-13rem)] overflow-x-auto overflow-y-auto overscroll-contain"
          : "overflow-x-auto sm:overflow-visible"
      )}
    >
      <div style={minWidth ? { minWidth } : undefined}>{children}</div>
    </div>
  );
}
