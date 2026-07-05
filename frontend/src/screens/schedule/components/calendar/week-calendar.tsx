"use client";

import { useState } from "react";
import { getWeekdayShortLabels } from "@/i18n/labels";
import type { Lesson, Student, VacationPeriod } from "@crm/shared";
import { getVacationPeriodForDate } from "@crm/shared/vacation";
import { cn } from "@/lib/utils";
import { calendarStickyHeaderClass } from "@/screens/dashboard/constants";
import type { CalendarRange } from "@/screens/dashboard/types";
import { sameDate } from "@/screens/schedule/utils/calendar";
import { DayColumn, type DraggedLesson } from "./day-column";
import { TimeAxis } from "./time-axis";

export function WeekCalendar({
  weekDays,
  calendarRange,
  currentTime,
  lessons,
  vacationPeriods,
  getStudent,
  onSelectLesson,
  onLessonUpdate
}: {
  weekDays: Date[];
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  vacationPeriods: VacationPeriod[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
  onLessonUpdate: (lesson: Lesson, patch: { startsAt?: string; durationMinutes?: number }) => Promise<void>;
}) {
  const [draggedLesson, setDraggedLesson] = useState<DraggedLesson | null>(null);
  const weekDayLabels = getWeekdayShortLabels("mon");

  return (
    <div className="grid min-h-[680px] grid-cols-[62px_repeat(7,minmax(86px,1fr))] grid-rows-[58px_auto]">
      <div className={calendarStickyHeaderClass} />
      {weekDays.map((day, index) => {
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        const vacationPeriod = getVacationPeriodForDate(day, vacationPeriods);
        return (
          <div
            className={cn(
              calendarStickyHeaderClass,
              "grid justify-items-center",
              isToday && "bg-stone-50 dark:bg-stone-900",
              vacationPeriod && "bg-sky-50 dark:bg-sky-950"
            )}
            key={day.toISOString()}
          >
            <strong className="text-xs uppercase text-stone-900">{weekDayLabels[index]}</strong>
            <span
              className={cn(
                "flex items-center justify-center text-[0.68rem] font-bold",
                isToday ? "size-6 rounded-full bg-primary text-primary-foreground" : "text-stone-400"
              )}
            >
              {day.getDate()}
            </span>
          </div>
        );
      })}
      <TimeAxis calendarRange={calendarRange} />
      {weekDays.map((day) => (
        <DayColumn
          key={day.toISOString()}
          day={day}
          calendarRange={calendarRange}
          currentTime={currentTime}
          lessons={lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), day))}
          vacationPeriod={getVacationPeriodForDate(day, vacationPeriods)}
          draggedLesson={draggedLesson}
          getStudent={getStudent}
          onSelectLesson={onSelectLesson}
          onLessonDragStart={(lesson, offsetY) => setDraggedLesson({ lesson, offsetY })}
          onLessonDragEnd={() => setDraggedLesson(null)}
          onLessonUpdate={onLessonUpdate}
        />
      ))}
    </div>
  );
}
