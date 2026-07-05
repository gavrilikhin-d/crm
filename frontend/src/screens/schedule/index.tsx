"use client";

import { type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { SnapshotRefreshControl } from "@/components/snapshot-refresh-control";
import { VacationDialog } from "@/components/vacation-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n/context";
import { formatFullDate, formatMonth, formatWeekRange } from "@/i18n/format";
import type { Lesson, Student, VacationPeriod } from "@crm/shared";
import { pageSectionClass } from "@/screens/dashboard/constants";
import type { CalendarRange, ScheduleView } from "@/screens/dashboard/types";
import { getDefaultLessonStartsAt, sameDate } from "@/screens/schedule/utils/calendar";
import { LessonForm } from "./components/lesson-form";
import { CalendarScrollArea } from "./components/calendar/calendar-scroll-area";
import { DayCalendar } from "./components/calendar/day-calendar";
import { WeekCalendar } from "./components/calendar/week-calendar";
import { MonthCalendar } from "./components/calendar/month-calendar";

const weekCalendarMinWidth = 664;
const weekCalendarTimeAxisWidth = 62;

export function ScheduleScreen({
  scheduleView,
  setScheduleView,
  selectedDate,
  currentTime,
  weekDays,
  monthDays,
  dayLessons,
  weekLessons,
  monthLessons,
  dayCalendarRange,
  dayScrollAnchor,
  weekCalendarRange,
  weekScrollAnchor,
  students,
  vacationPeriods,
  recurringEnabled,
  lessonFormKey,
  lessonDialogOpen,
  setLessonDialogOpen,
  secondsUntilRefresh,
  connected,
  refreshing,
  lastRefreshedAt,
  refreshNow,
  onShiftCalendar,
  onGoToToday,
  getStudent,
  onSelectLesson,
  onLessonTimeChange,
  onLessonSubmit
}: {
  scheduleView: ScheduleView;
  setScheduleView: (view: ScheduleView) => void;
  selectedDate: Date;
  currentTime: Date;
  weekDays: Date[];
  monthDays: Date[];
  dayLessons: Lesson[];
  weekLessons: Lesson[];
  monthLessons: Lesson[];
  dayCalendarRange: CalendarRange;
  dayScrollAnchor: number;
  weekCalendarRange: CalendarRange;
  weekScrollAnchor: number;
  students: Student[];
  vacationPeriods: VacationPeriod[];
  recurringEnabled: boolean;
  lessonFormKey: number;
  lessonDialogOpen: boolean;
  setLessonDialogOpen: (open: boolean) => void;
  secondsUntilRefresh: number;
  connected: boolean;
  refreshing: boolean;
  lastRefreshedAt: Date | null;
  refreshNow: () => Promise<void>;
  onShiftCalendar: (direction: -1 | 1) => void;
  onGoToToday: () => void;
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
  onLessonTimeChange: (lesson: Lesson, startsAt: string) => Promise<void>;
  onLessonSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const scheduleViewLabels: Record<ScheduleView, string> = {
    day: t("calendar.view.day"),
    week: t("calendar.view.week"),
    month: t("calendar.view.month")
  };
  const todayWeekIndex = weekDays.findIndex((day) => sameDate(day, currentTime));
  const weekDayWidth = (weekCalendarMinWidth - weekCalendarTimeAxisWidth) / 7;
  const weekHorizontalAnchor =
    todayWeekIndex === -1
      ? undefined
      : weekCalendarTimeAxisWidth + weekDayWidth * todayWeekIndex + weekDayWidth / 2;

  return (
    <section className={pageSectionClass} id="schedule">
      <div className="min-w-0">
        <div className="mb-3 flex flex-col gap-3 sm:h-12 sm:flex-row sm:items-center sm:justify-between">
          <ToggleGroup
            type="single"
            value={scheduleView}
            onValueChange={(value) => {
              if (value) {
                setScheduleView(value as ScheduleView);
              }
            }}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full sm:w-auto"
          >
            {(["day", "week", "month"] as const).map((view) => (
              <ToggleGroupItem key={view} value={view} aria-label={scheduleViewLabels[view]} className="flex-1 sm:flex-none">
                {scheduleViewLabels[view]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="text-center text-xs font-extrabold uppercase tracking-wide text-stone-400 sm:min-w-52">
            {scheduleView === "day" ? formatFullDate(selectedDate.toISOString()) : null}
            {scheduleView === "week" ? formatWeekRange(weekDays) : null}
            {scheduleView === "month" ? formatMonth(selectedDate) : null}
          </div>

          <div className="flex items-center justify-center gap-2 sm:justify-end">
            <SnapshotRefreshControl
              secondsUntilRefresh={secondsUntilRefresh}
              connected={connected}
              refreshing={refreshing}
              lastRefreshedAt={lastRefreshedAt}
              onRefresh={() => void refreshNow()}
            />
            <Button variant="secondary" size="icon" type="button" onClick={() => onShiftCalendar(-1)} aria-label={t("calendar.prevPeriod")}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={onGoToToday}>
              {t("calendar.today")}
            </Button>
            <Button variant="secondary" size="icon" type="button" onClick={() => onShiftCalendar(1)} aria-label={t("calendar.nextPeriod")}>
              <ChevronRight className="size-4" />
            </Button>
            <VacationDialog
              vacationPeriods={vacationPeriods}
              defaultDate={selectedDate}
              onChanged={() => refreshNow()}
            />
            <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" type="button" className="hidden sm:inline-flex" aria-label={t("calendar.createLesson")}>
                  <Plus className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("calendar.createLessonTitle")}</DialogTitle>
                </DialogHeader>
                <LessonForm
                  key={lessonFormKey}
                  students={students}
                  recurringEnabled={recurringEnabled}
                  defaultStartsAt={getDefaultLessonStartsAt(selectedDate)}
                  onSubmit={onLessonSubmit}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {scheduleView === "day" ? (
          <CalendarScrollArea
            scrollAnchorOffset={dayScrollAnchor}
            scrollKey={`day-${selectedDate.toISOString()}`}
          >
            <DayCalendar
              day={selectedDate}
              calendarRange={dayCalendarRange}
              currentTime={currentTime}
              lessons={dayLessons}
              vacationPeriods={vacationPeriods}
              getStudent={getStudent}
              onSelectLesson={onSelectLesson}
              onLessonTimeChange={onLessonTimeChange}
            />
          </CalendarScrollArea>
        ) : null}

        {scheduleView === "week" ? (
          <CalendarScrollArea
            horizontalAnchorOffset={weekHorizontalAnchor}
            minWidth={weekCalendarMinWidth}
            stickyHeader
            scrollAnchorOffset={weekScrollAnchor}
            scrollKey={`week-${selectedDate.toISOString()}`}
          >
            <WeekCalendar
              weekDays={weekDays}
              calendarRange={weekCalendarRange}
              currentTime={currentTime}
              lessons={weekLessons}
              vacationPeriods={vacationPeriods}
              getStudent={getStudent}
              onSelectLesson={onSelectLesson}
              onLessonTimeChange={onLessonTimeChange}
            />
          </CalendarScrollArea>
        ) : null}

        {scheduleView === "month" ? (
          <MonthCalendar
            selectedDate={selectedDate}
            monthDays={monthDays}
            currentTime={currentTime}
            lessons={monthLessons}
            vacationPeriods={vacationPeriods}
            getStudent={getStudent}
            onSelectLesson={onSelectLesson}
          />
        ) : null}
      </div>
    </section>
  );
}
