"use client";

import { getWeekdayShortLabels } from "@/i18n/labels";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n/context";
import type { Lesson, Student, VacationPeriod } from "@crm/shared";
import { getVacationPeriodForDate } from "@crm/shared/vacation";
import { cn } from "@/lib/utils";
import { MonthLessonChip } from "./month-lesson-chip";
import { sameDate } from "@/screens/schedule/utils/calendar";

export function MonthCalendar({
  selectedDate,
  monthDays,
  currentTime,
  lessons,
  vacationPeriods,
  getStudent,
  onSelectDay,
  onSelectLesson
}: {
  selectedDate: Date;
  monthDays: Date[];
  currentTime: Date | null;
  lessons: Lesson[];
  vacationPeriods: VacationPeriod[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectDay: (day: Date) => void;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const weekDayLabels = getWeekdayShortLabels("mon", t);
  const maxVisibleLessons = isMobile ? 2 : 4;

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-stone-200">
      {weekDayLabels.map((day) => (
        <div
          className="border-b border-stone-200 bg-stone-50 px-1 py-1 text-center text-[0.625rem] font-bold uppercase text-stone-500 sm:px-2 sm:py-2 sm:text-xs"
          key={day}
        >
          {day}
        </div>
      ))}
      {monthDays.map((day) => {
        const dayLessons = lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), day));
        const isOutsideMonth = day.getMonth() !== selectedDate.getMonth();
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        const vacationPeriod = getVacationPeriodForDate(day, vacationPeriods);
        return (
          <div
            className={cn(
              "min-h-16 min-w-0 cursor-pointer overflow-hidden border-b border-r border-stone-100 p-1 transition-colors hover:bg-stone-50 sm:min-h-28 sm:p-1.5 md:min-h-32 md:p-2",
              isToday && "ring-1 ring-inset ring-stone-200",
              vacationPeriod && "bg-sky-50/80 hover:bg-sky-50 dark:bg-sky-950/30 dark:hover:bg-sky-950/50"
            )}
            key={day.toISOString()}
            onClick={() => onSelectDay(day)}
          >
            <div
              className={cn(
                "mb-1 inline-flex size-5 items-center justify-center rounded-full text-[0.625rem] font-bold sm:mb-2 sm:size-6 sm:text-xs",
                isToday ? "bg-stone-900 text-white" : isOutsideMonth ? "text-stone-300" : "text-stone-700",
                vacationPeriod && !isToday && "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200"
              )}
            >
              {day.getDate()}
            </div>
            <div className="grid min-w-0 gap-0.5 sm:gap-1">
              {vacationPeriod ? (
                <div className="truncate rounded border border-sky-200 bg-sky-100 px-1 py-0.5 text-[0.625rem] font-medium text-sky-800 sm:text-[0.68rem] dark:border-sky-800 dark:bg-sky-900 dark:text-sky-100">
                  {vacationPeriod.label ?? t("calendar.vacation.label")}
                </div>
              ) : null}
              {dayLessons.slice(0, maxVisibleLessons).map((lesson) => (
                <MonthLessonChip
                  key={lesson.id}
                  lesson={lesson}
                  compact={isMobile}
                  getStudent={getStudent}
                  onSelect={() => onSelectLesson(lesson)}
                />
              ))}
              {dayLessons.length > maxVisibleLessons ? (
                <span className="truncate text-[0.625rem] text-stone-400 sm:text-[0.68rem]">
                  {t("calendar.moreLessons", { count: dayLessons.length - maxVisibleLessons })}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
