"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import { formatDateTime } from "@/i18n/format";
import type { Lesson, Student, VacationPeriod } from "@crm/shared";
import { getVacationDayOverlay } from "@crm/shared/vacation";
import type { CalendarRange } from "@/screens/dashboard/types";
import { hourHeight } from "@/screens/dashboard/constants";
import { CalendarLesson } from "./calendar-lesson";
import { CurrentTimeMarker } from "./current-time-marker";
import {
  getCurrentTimeOffset,
  getLessonLayouts,
  getLessonStartsAtFromOffset,
  sameDate
} from "@/screens/schedule/utils/calendar";

export type DraggedLesson = {
  lesson: Lesson;
  offsetY: number;
};

export function DayColumn({
  day,
  calendarRange,
  currentTime,
  lessons,
  vacationPeriod,
  draggedLesson,
  getStudent,
  onSelectLesson,
  onLessonDragStart,
  onLessonDragEnd,
  onLessonTimeChange
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  vacationPeriod?: VacationPeriod;
  draggedLesson?: DraggedLesson | null;
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
  onLessonDragStart?: (lesson: Lesson, offsetY: number) => void;
  onLessonDragEnd?: () => void;
  onLessonTimeChange?: (lesson: Lesson, startsAt: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const columnRef = useRef<HTMLDivElement>(null);
  const [dropPreview, setDropPreview] = useState<{ startsAt: string; top: number; height: number } | null>(null);
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

  return (
    <div
      ref={columnRef}
      className={cn(
        "relative border-l border-stone-100",
        isToday && "bg-primary/5 dark:bg-primary/10",
        vacationOverlay?.isFullDay && "bg-sky-50/70 dark:bg-sky-950/30",
        draggedLesson && onLessonTimeChange && "cursor-copy"
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
      onDragOver={(event) => {
        if (!draggedLesson || !onLessonTimeChange) {
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
        if (!draggedLesson || !onLessonTimeChange || !columnRef.current) {
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
        void Promise.resolve(onLessonTimeChange(draggedLesson.lesson, startsAt)).finally(() => onLessonDragEnd?.());
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
            {formatDateTime(dropPreview.startsAt)}
          </span>
        </>
      ) : null}
      {vacationOverlay ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-1 z-5 flex justify-center bg-[repeating-linear-gradient(-45deg,rgba(14,165,233,0.08),rgba(14,165,233,0.08)_8px,transparent_8px,transparent_16px)]",
            vacationOverlay.isFullDay ? "inset-0 items-start pt-3" : "items-center rounded-md border border-sky-200/80"
          )}
          style={
            vacationOverlay.isFullDay
              ? undefined
              : {
                  top: vacationTop,
                  height: Math.max(vacationHeight, 28)
                }
          }
        >
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900 dark:text-sky-200">
            {vacationPeriod?.label ?? t("calendar.vacation.label")}
          </span>
        </div>
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
          getStudent={getStudent}
          onSelect={() => onSelectLesson(lesson)}
          onDragStart={
            !onLessonDragStart || lesson.status === "completed" || lesson.status === "cancelled_by_teacher"
              ? undefined
              : (offsetY) => onLessonDragStart?.(lesson, offsetY)
          }
          onDragEnd={onLessonDragEnd}
        />
      ))}
    </div>
  );
}
