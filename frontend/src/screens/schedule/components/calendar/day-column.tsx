"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import { formatDateTime } from "@/i18n/format";
import type { Lesson, Payment, Student, VacationPeriod } from "@crm/shared";
import { getVacationDayOverlay } from "@crm/shared/vacation";
import type { CalendarRange } from "@/screens/dashboard/types";
import { hourHeight } from "@/screens/dashboard/constants";
import { CalendarLesson } from "./calendar-lesson";
import { CurrentTimeMarker } from "./current-time-marker";
import {
  getCurrentTimeOffset,
  getLessonLayouts,
  getLessonStartsAtFromOffset,
  formatDateTimeLocal,
  formatTimeRange,
  getVacationWatermarkStyle,
  sameDate
} from "@/screens/schedule/utils/calendar";

export type DraggedLesson = {
  lesson: Lesson;
  offsetY: number;
};

export type LessonResizePreview = {
  startsAt: string;
  durationMinutes: number;
  top: number;
  height: number;
};

type ResizeEdge = "top" | "bottom";

type ResizingLesson = {
  lesson: Lesson;
  edge: ResizeEdge;
  startY: number;
  startMinutes: number;
  durationMinutes: number;
};

export function DayColumn({
  day,
  calendarRange,
  currentTime,
  lessons,
  packageProgressLessons = [],
  payments = [],
  vacationPeriod,
  draggedLesson,
  resizePreview: resizePreviewProp,
  getStudent,
  onSelectLesson,
  onCreateLessonAt,
  onLessonDragStart,
  onLessonDragEnd,
  onLessonUpdate
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  packageProgressLessons?: Lesson[];
  payments?: Payment[];
  vacationPeriod?: VacationPeriod;
  draggedLesson?: DraggedLesson | null;
  resizePreview?: LessonResizePreview | null;
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
  onCreateLessonAt?: (startsAt: string) => void;
  onLessonDragStart?: (lesson: Lesson, offsetY: number) => void;
  onLessonDragEnd?: () => void;
  onLessonUpdate?: (lesson: Lesson, patch: { startsAt?: string; durationMinutes?: number }) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const columnRef = useRef<HTMLDivElement>(null);
  const [dropPreview, setDropPreview] = useState<{ startsAt: string; top: number; height: number } | null>(null);
  const [resizingLesson, setResizingLesson] = useState<ResizingLesson | null>(null);
  const [resizePreviewState, setResizePreviewState] = useState<LessonResizePreview | null>(null);
  const resizePreviewRef = useRef<LessonResizePreview | null>(null);
  const isToday = currentTime ? sameDate(day, currentTime) : false;
  const currentTimeOffset = currentTime && isToday ? getCurrentTimeOffset(currentTime, calendarRange) : null;
  const columnHeight = calendarRange.hours.length * hourHeight;
  const vacationOverlay = vacationPeriod ? getVacationDayOverlay(day, vacationPeriod) : null;
  const lessonLayouts = getLessonLayouts(lessons);
  const vacationTop =
    vacationOverlay !== null
      ? ((Math.max(vacationOverlay.topMinutes, calendarRange.startHour * 60) - calendarRange.startHour * 60) /
          60) *
        hourHeight
      : 0;
  const vacationHeight =
    vacationOverlay !== null
      ? ((Math.min(
          vacationOverlay.topMinutes + vacationOverlay.heightMinutes,
          calendarRange.endHour * 60
        ) -
          Math.max(vacationOverlay.topMinutes, calendarRange.startHour * 60)) /
          60) *
        hourHeight
      : 0;

  const getStartsAtForMinutes = useCallback((minutes: number): string => {
    const startsAt = new Date(day);
    startsAt.setHours(0, minutes, 0, 0);
    return formatDateTimeLocal(startsAt);
  }, [day]);

  const calculateResizePreview = useCallback((state: ResizingLesson, clientY: number): LessonResizePreview => {
    const snapMinutes = 5;
    const minDurationMinutes = 15;
    const deltaMinutes = Math.round((((clientY - state.startY) / hourHeight) * 60) / snapMinutes) * snapMinutes;
    const calendarStartMinutes = calendarRange.startHour * 60;
    const calendarEndMinutes = calendarRange.endHour * 60;
    let startMinutes = state.startMinutes;
    let durationMinutes = state.durationMinutes;

    if (state.edge === "bottom") {
      durationMinutes = Math.min(
        Math.max(state.durationMinutes + deltaMinutes, minDurationMinutes),
        Math.max(minDurationMinutes, calendarEndMinutes - state.startMinutes)
      );
    } else {
      const endMinutes = state.startMinutes + state.durationMinutes;
      startMinutes = Math.min(
        Math.max(state.startMinutes + deltaMinutes, calendarStartMinutes),
        endMinutes - minDurationMinutes
      );
      durationMinutes = endMinutes - startMinutes;
    }

    return {
      startsAt: getStartsAtForMinutes(startMinutes),
      durationMinutes,
      top: ((startMinutes - calendarStartMinutes) / 60) * hourHeight,
      height: (durationMinutes / 60) * hourHeight
    };
  }, [calendarRange.endHour, calendarRange.startHour, getStartsAtForMinutes]);

  useEffect(() => {
    if (!resizingLesson || !onLessonUpdate) {
      return;
    }
    const activeResize = resizingLesson;
    const updateLesson = onLessonUpdate;

    function handlePointerMove(event: PointerEvent) {
      const preview = calculateResizePreview(activeResize, event.clientY);
      resizePreviewRef.current = preview;
      setResizePreviewState(preview);
    }

    function handlePointerUp() {
      const preview = resizePreviewRef.current;
      setResizingLesson(null);
      setResizePreviewState(null);
      resizePreviewRef.current = null;
      if (preview) {
        void updateLesson(activeResize.lesson, {
          startsAt: activeResize.edge === "top" ? preview.startsAt : undefined,
          durationMinutes: preview.durationMinutes
        });
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [calculateResizePreview, onLessonUpdate, resizingLesson]);

  const resizePreview = resizePreviewState ?? resizePreviewProp ?? null;
  const vacationLabel = vacationPeriod?.label ?? t("calendar.vacation.label");
  const vacationWatermark = getVacationWatermarkStyle(vacationLabel);

  return (
    <div
      ref={columnRef}
      className={cn(
        "relative border-l border-stone-100",
        isToday && "bg-primary/5 dark:bg-primary/10",
        vacationOverlay?.isFullDay && "bg-sky-50/70 dark:bg-sky-950/30",
        draggedLesson && onLessonUpdate && "cursor-copy",
        !draggedLesson && onCreateLessonAt && "cursor-pointer"
      )}
      style={{
        minHeight: columnHeight,
        backgroundImage:
          vacationOverlay && !vacationOverlay.isFullDay
            ? "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
            : vacationOverlay
              ? undefined
              : "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
      }}
      onClick={(event) => {
        if (!onCreateLessonAt || !columnRef.current || draggedLesson || resizingLesson) {
          return;
        }

        // Only empty-slot clicks — lesson cards handle their own selection.
        if (event.target !== event.currentTarget) {
          return;
        }

        const rect = columnRef.current.getBoundingClientRect();
        const startsAt = getLessonStartsAtFromOffset(
          day,
          event.clientY - rect.top,
          15,
          calendarRange
        );
        onCreateLessonAt(startsAt);
      }}
      onDragOver={(event) => {
        if (!draggedLesson || !onLessonUpdate || resizingLesson) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!columnRef.current) {
          return;
        }

        const rect = columnRef.current.getBoundingClientRect();
        const top = event.clientY - rect.top - draggedLesson.offsetY;
        setDropPreview({
          startsAt: getLessonStartsAtFromOffset(day, top, draggedLesson.lesson.durationMinutes, calendarRange),
          top: Math.min(Math.max(top, 0), columnHeight - 1),
          height: (draggedLesson.lesson.durationMinutes / 60) * hourHeight
        });
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropPreview(null);
        }
      }}
      onDrop={(event) => {
        if (!draggedLesson || !onLessonUpdate || !columnRef.current) {
          return;
        }

        event.preventDefault();
        setDropPreview(null);
        const rect = columnRef.current.getBoundingClientRect();
        const startsAt = getLessonStartsAtFromOffset(
          day,
          event.clientY - rect.top - draggedLesson.offsetY,
          draggedLesson.lesson.durationMinutes,
          calendarRange
        );
        void Promise.resolve(onLessonUpdate(draggedLesson.lesson, { startsAt })).finally(() => onLessonDragEnd?.());
      }}
    >
      {dropPreview ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-1 z-30 h-px bg-primary"
            style={{ top: dropPreview.top }}
          />
          <span
            className="pointer-events-none absolute right-1 z-30 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground shadow-sm"
            style={{
              top:
                dropPreview.top >= 24
                  ? dropPreview.top - 24
                  : Math.min(dropPreview.top + dropPreview.height + 4, columnHeight - 24)
            }}
          >
            {formatDateTime(dropPreview.startsAt, locale)}
          </span>
        </>
      ) : null}
      {resizePreview ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border border-dashed border-primary/80 bg-primary/10"
            style={{ top: resizePreview.top, height: resizePreview.height }}
          />
          <span
            className="pointer-events-none absolute right-1 z-30 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground shadow-sm"
            style={{
              top:
                resizePreview.top >= 24
                  ? resizePreview.top - 24
                  : Math.min(resizePreview.top + resizePreview.height + 4, columnHeight - 24)
            }}
          >
            {formatTimeRange(new Date(resizePreview.startsAt), resizePreview.durationMinutes, locale)}
          </span>
        </>
      ) : null}
      {vacationOverlay ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-1 z-5 bg-sky-50/60 dark:bg-sky-950/25",
            vacationOverlay.isFullDay ? "inset-0" : "rounded-md border border-sky-200/60 dark:border-sky-800/60"
          )}
          style={{
            ...(vacationOverlay.isFullDay
              ? vacationWatermark
              : {
                  top: vacationTop,
                  height: Math.max(vacationHeight, 28),
                  ...vacationWatermark
                })
          }}
        />
      ) : null}
      {currentTimeOffset !== null && currentTime ? (
        <CurrentTimeMarker top={currentTimeOffset} currentTime={currentTime} />
      ) : null}
      {lessonLayouts.map(({ lesson, lane, lanes }) => (
        <CalendarLesson
          key={lesson.id}
          lesson={lesson}
          calendarRange={calendarRange}
          lane={lane}
          lanes={lanes}
          packageProgressLessons={packageProgressLessons}
          payments={payments}
          getStudent={getStudent}
          onSelect={() => onSelectLesson(lesson)}
          onDragStart={
            !onLessonDragStart || lesson.status === "cancelled_by_teacher"
              ? undefined
              : (offsetY) => onLessonDragStart?.(lesson, offsetY)
          }
          onDragEnd={onLessonDragEnd}
          onResizeStart={
            !onLessonUpdate || lesson.status === "cancelled_by_teacher"
              ? undefined
              : (edge, clientY) => {
                  const startsAt = new Date(lesson.startsAt);
                  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
                  const previewState = {
                    lesson,
                    edge,
                    startY: clientY,
                    startMinutes,
                    durationMinutes: lesson.durationMinutes
                  };
                  const preview = calculateResizePreview(previewState, clientY);
                  resizePreviewRef.current = preview;
                  setResizePreviewState(preview);
                  setResizingLesson(previewState);
                }
          }
        />
      ))}
    </div>
  );
}
