"use client";

import { LessonParticipantSummary } from "@/components/lesson-participant-summary";
import { ParticipantCardAvatar, ParticipantCardLabel } from "@/components/participant-card-label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import type { Lesson, Student } from "@crm/shared";
import type { CalendarRange } from "@/screens/dashboard/types";
import { formatTimeRange, getLessonPosition } from "@/screens/schedule/utils/calendar";

export function CalendarLesson({
  lesson,
  calendarRange,
  getStudent,
  onSelect
}: {
  lesson: Lesson;
  calendarRange: CalendarRange;
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const startsAt = new Date(lesson.startsAt);
  const { top, height } = getLessonPosition(lesson, calendarRange);
  const compact = height < 52;

  return (
    <button
      type="button"
      className="absolute inset-x-1.5 z-10 flex cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border bg-card p-1.5 text-left shadow-sm transition-shadow hover:shadow-md"
      style={{ top, height }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="shrink-0 text-[0.68rem] font-semibold tabular-nums leading-tight">
          {formatTimeRange(startsAt, lesson.durationMinutes)}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact={compact} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1 pr-0.5">
        {lesson.participants.map((participant) => {
          const student = getStudent(participant.studentId);
          if (!student) {
            return null;
          }

          return (
            <div
              key={participant.id}
              className={cn("flex shrink-0 min-w-0 items-center gap-1.5", compact ? "min-h-6" : "min-h-7")}
            >
              <ParticipantCardAvatar student={student} status={participant.status} compact={compact} />
              <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
                <div className="min-w-0 flex-1">
                  <ParticipantCardLabel name={student.fullName} studentId={student.id} compact={compact} />
                </div>
                {participant.hasDebt ? (
                  <Badge
                    variant="destructive"
                    className={cn("shrink-0 px-1 py-0", compact ? "text-[0.5rem]" : "text-[0.55rem]")}
                  >
                    {t("badge.debt")}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}
