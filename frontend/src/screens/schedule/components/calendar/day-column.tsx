"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import type { Lesson, Student, VacationPeriod } from "@crm/shared";
import { getVacationDayOverlay } from "@crm/shared/vacation";
import type { CalendarRange } from "@/screens/dashboard/types";
import { hourHeight } from "@/screens/dashboard/constants";
import { CalendarLesson } from "./calendar-lesson";
import { CurrentTimeMarker } from "./current-time-marker";
import { getCurrentTimeOffset, sameDate } from "@/screens/schedule/utils/calendar";

export function DayColumn({
  day,
  calendarRange,
  currentTime,
  lessons,
  vacationPeriod,
  getStudent,
  onSelectLesson
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  vacationPeriod?: VacationPeriod;
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const { t } = useI18n();
  const isToday = currentTime ? sameDate(day, currentTime) : false;
  const currentTimeOffset = currentTime && isToday ? getCurrentTimeOffset(currentTime, calendarRange) : null;
  const columnHeight = calendarRange.hours.length * hourHeight;
  const vacationOverlay = vacationPeriod ? getVacationDayOverlay(day, vacationPeriod) : null;
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
      className={cn(
        "relative border-l border-stone-100",
        isToday && "bg-primary/5 dark:bg-primary/10",
        vacationOverlay?.isFullDay && "bg-sky-50/70 dark:bg-sky-950/30"
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
    >
      {vacationOverlay ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-1 z-[5] flex justify-center bg-[repeating-linear-gradient(-45deg,rgba(14,165,233,0.08),rgba(14,165,233,0.08)_8px,transparent_8px,transparent_16px)]",
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
      {lessons.map((lesson) => (
        <CalendarLesson
          key={lesson.id}
          lesson={lesson}
          calendarRange={calendarRange}
          getStudent={getStudent}
          onSelect={() => onSelectLesson(lesson)}
        />
      ))}
    </div>
  );
}
