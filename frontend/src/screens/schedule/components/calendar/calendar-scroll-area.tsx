"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { calendarHeaderHeight } from "@/screens/dashboard/constants";

export function CalendarScrollArea({
  children,
  horizontalAnchorOffset,
  minWidth,
  scrollAnchorOffset,
  scrollKey,
  stickyHeader
}: {
  children: ReactNode;
  horizontalAnchorOffset?: number;
  minWidth?: number;
  scrollAnchorOffset?: number;
  scrollKey?: string;
  stickyHeader?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef<string | null>(null);
  const enableVerticalScroll = scrollAnchorOffset !== undefined || stickyHeader;
  const enableHorizontalScroll = horizontalAnchorOffset !== undefined;

  useEffect(() => {
    didScrollRef.current = null;
  }, [scrollKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !scrollKey) {
      return;
    }

    if (didScrollRef.current === scrollKey) {
      return;
    }

    const headerHeight = calendarHeaderHeight;
    const frame = window.requestAnimationFrame(() => {
      if (scrollAnchorOffset !== undefined) {
        const targetTop = headerHeight + scrollAnchorOffset;
        container.scrollTop = Math.max(0, targetTop - container.clientHeight / 2);
      }

      if (horizontalAnchorOffset !== undefined) {
        container.scrollLeft = Math.max(0, horizontalAnchorOffset - container.clientWidth / 2);
      }

      didScrollRef.current = scrollKey;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [horizontalAnchorOffset, scrollAnchorOffset, scrollKey]);

  return (
    <div
      ref={enableVerticalScroll || enableHorizontalScroll ? containerRef : undefined}
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
