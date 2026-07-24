"use client";

import { LessonParticipantSummary } from "@/components/lesson-participant-summary";
import { ParticipantCardAvatar, ParticipantCardLabel } from "@/components/participant-card-label";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/context";
import { formatTime } from "@/i18n/format";
import type { Lesson, Payment, Student } from "@crm/shared";
import {
  formatParticipantNameWithPackageProgress,
  getPackageLessonProgress
} from "@crm/shared/package-progress";
import { formatTimeRange } from "@/screens/schedule/utils/calendar";

export function MonthLessonChip({
  lesson,
  compact,
  packageProgressLessons = [],
  payments = [],
  getStudent,
  onSelect
}: {
  lesson: Lesson;
  compact?: boolean;
  packageProgressLessons?: Lesson[];
  payments?: Payment[];
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const startsAt = new Date(lesson.startsAt);

  if (compact) {
    const firstParticipant = lesson.participants[0];
    const firstStudent = firstParticipant
      ? getStudent(firstParticipant.studentId)
      : undefined;
    const compactName = firstStudent
      ? formatParticipantNameWithPackageProgress(
          firstStudent.fullName.split(/\s+/)[0] ?? firstStudent.fullName,
          getPackageLessonProgress({
            studentId: firstStudent.id,
            lessonId: lesson.id,
            lessons: packageProgressLessons,
            payments
          })
        )
      : t("calendar.lessonFallback");

    return (
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border bg-card px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums leading-none">
          {formatTime(startsAt, locale)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.625rem] leading-none text-muted-foreground">
          {compactName}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border bg-card px-2 py-1 text-left transition-colors hover:bg-muted/50"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="truncate text-[0.62rem] font-semibold tabular-nums leading-tight">
          {formatTimeRange(startsAt, lesson.durationMinutes, locale)}
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
                <ParticipantCardLabel
                  name={formatParticipantNameWithPackageProgress(
                    student.fullName,
                    getPackageLessonProgress({
                      studentId: student.id,
                      lessonId: lesson.id,
                      lessons: packageProgressLessons,
                      payments
                    })
                  )}
                  studentId={student.id}
                  compact
                />
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
