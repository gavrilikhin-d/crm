"use client";

import type { Lesson, LessonType, RecurringDeleteScope, RecurringSchedule, Student } from "@crm/shared";
import { RefreshCw, Trash2 } from "lucide-react";
import { StudentLink } from "@/components/student-link";
import { StudentAvatar } from "@/components/student-avatar";
import { ParticipantStatusBadge } from "@/components/participant-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n/context";
import { formatFullDate, formatTime } from "@/i18n/format";
import { getLessonStatusLabel, getLessonTypeLabel, getWeekdayShortLabels } from "@/i18n/labels";

function formatTimeRange(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function LessonOverviewSheet({
  lesson,
  open,
  recurringSchedule,
  getStudent,
  onOpenChange,
  onRemoveParticipant,
  onDeleteLesson
}: {
  lesson: Lesson | null;
  open: boolean;
  recurringSchedule?: RecurringSchedule;
  getStudent: (studentId: string) => Student | undefined;
  onOpenChange: (open: boolean) => void;
  onRemoveParticipant: (lessonId: string, studentId: string, studentName: string) => Promise<void>;
  onDeleteLesson: (lesson: Lesson, scope: RecurringDeleteScope) => Promise<void>;
}) {
  const { t } = useI18n();
  const weekdayLabels = getWeekdayShortLabels("sun");

  function formatRecurringSchedule(schedule: RecurringSchedule): string {
    const weekday = weekdayLabels[schedule.weekday] ?? "—";
    return t("lessonOverview.recurring", { weekday, time: schedule.time });
  }

  if (!lesson) {
    return null;
  }

  const startsAt = new Date(lesson.startsAt);
  const converted = lesson.originalType === "group" && lesson.effectiveType === "individual";
  const canEditParticipants = lesson.status !== "completed" && lesson.status !== "cancelled_by_teacher";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{formatFullDate(lesson.startsAt)}</SheetTitle>
          <SheetDescription>{formatTimeRange(startsAt, lesson.durationMinutes)}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{getLessonStatusLabel(lesson.status)}</Badge>
            <Badge variant="outline">{getLessonTypeLabel(lesson.effectiveType)}</Badge>
            {converted ? <Badge variant="outline">{t("lessonOverview.wasGroup")}</Badge> : null}
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">{t("common.formatLabel")}</span>
              {getLessonTypeLabel(lesson.effectiveType)}, {t("common.minutes", { count: lesson.durationMinutes })}
            </p>
            {recurringSchedule ? (
              <p className="flex items-center gap-1.5">
                <RefreshCw className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{formatRecurringSchedule(recurringSchedule)}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">{t("lessonOverview.oneOff")}</p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{t("lessonOverview.participants")}</h3>
            {lesson.participants.map((participant) => {
              const student = getStudent(participant.studentId);
              if (!student) {
                return null;
              }

              return (
                <div key={participant.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <StudentLink studentId={student.id}>
                    <StudentAvatar student={student} size="default" />
                  </StudentLink>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <StudentLink studentId={student.id}>{student.fullName}</StudentLink>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <ParticipantStatusBadge status={participant.status} className="text-[0.65rem]" />
                      {participant.hasDebt ? (
                        <Badge variant="destructive" className="text-[0.65rem]">
                          {t("badge.debt")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {canEditParticipants ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={t("lessonOverview.removeParticipantAria", { name: student.fullName })}
                      onClick={() => void onRemoveParticipant(lesson.id, student.id, student.fullName)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          {lesson.recurringScheduleId ? (
            <div className="flex w-full flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("lessonOverview.delete.title")}</p>
              <Button type="button" variant="outline" onClick={() => void onDeleteLesson(lesson, "single")}>
                {t("lessonOverview.delete.single")}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onDeleteLesson(lesson, "following")}>
                {t("lessonOverview.delete.following")}
              </Button>
              <Button type="button" variant="destructive" onClick={() => void onDeleteLesson(lesson, "all")}>
                {t("lessonOverview.delete.all")}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="destructive" className="w-full" onClick={() => void onDeleteLesson(lesson, "single")}>
              {t("lessonOverview.delete.button")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { LessonOverviewSheet };
