"use client";

import { LessonParticipantSummary } from "@/components/lesson-participant-summary";
import { ParticipantCardAvatar, ParticipantCardLabel } from "@/components/participant-card-label";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/context";
import { formatTime } from "@/i18n/format";
import type { Lesson, Student } from "@crm/shared";
import { formatTimeRange } from "@/screens/schedule/utils/calendar";

export function MonthLessonChip({
  lesson,
  compact,
  getStudent,
  onSelect
}: {
  lesson: Lesson;
  compact?: boolean;
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const startsAt = new Date(lesson.startsAt);

  if (compact) {
    const firstStudent = lesson.participants
      .map((participant) => getStudent(participant.studentId))
      .find(Boolean);

    return (
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border bg-card px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
        onClick={onSelect}
      >
        <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums leading-none">
          {formatTime(startsAt)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.625rem] leading-none text-muted-foreground">
          {firstStudent?.fullName.split(/\s+/)[0] ?? t("calendar.lessonFallback")}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border bg-card px-2 py-1 text-left transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="truncate text-[0.62rem] font-semibold tabular-nums leading-tight">
          {formatTimeRange(startsAt, lesson.durationMinutes)}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 pb-1 pr-0.5">
        {lesson.participants.map((participant) => {
          const student = getStudent(participant.studentId);
          if (!student) {
            return null;
          }

          return (
            <div key={participant.id} className="flex min-h-6 min-w-0 shrink-0 items-center gap-1">
              <ParticipantCardAvatar student={student} status={participant.status} compact />
              <div className="min-w-0 flex-1">
                <ParticipantCardLabel name={student.fullName} studentId={student.id} compact />
              </div>
              {participant.hasDebt ? (
                <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[0.5rem]">
                  {t("badge.debt")}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>
    </button>
  );
}
