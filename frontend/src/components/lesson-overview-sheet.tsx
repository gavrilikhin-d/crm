"use client";

import { type FormEvent, useState } from "react";
import type { Lesson, RecurringDeleteScope, RecurringSchedule, Student } from "@crm/shared";
import type { TeacherParticipantStatus } from "@crm/shared/lesson-attendance";
import { RefreshCw, Trash2 } from "lucide-react";
import { StudentMultiCombobox } from "@/components/student-multi-combobox";
import { StudentLink } from "@/components/student-link";
import { StudentAvatar } from "@/components/student-avatar";
import { ParticipantStatusBadge } from "@/components/participant-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { formatDateTimeLocal } from "@/screens/schedule/utils/calendar";

function formatTimeRange(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function LessonOverviewSheet({
  lesson,
  open,
  recurringSchedule,
  getStudent,
  availableStudents,
  onOpenChange,
  onAddParticipant,
  onRemoveParticipant,
  onSetParticipantStatus,
  onUpdateLessonTime,
  onDeleteLesson
}: {
  lesson: Lesson | null;
  open: boolean;
  recurringSchedule?: RecurringSchedule;
  getStudent: (studentId: string) => Student | undefined;
  availableStudents: Student[];
  onOpenChange: (open: boolean) => void;
  onAddParticipant: (lessonId: string, studentIds: string[]) => Promise<void>;
  onRemoveParticipant: (lessonId: string, studentId: string, studentName: string) => Promise<void>;
  onSetParticipantStatus: (
    lessonId: string,
    studentId: string,
    status: TeacherParticipantStatus
  ) => Promise<void>;
  onUpdateLessonTime: (lesson: Lesson, startsAt: string) => Promise<void>;
  onDeleteLesson: (lesson: Lesson, scope: RecurringDeleteScope) => Promise<void>;
}) {
  const { t } = useI18n();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [statusUpdatingStudentId, setStatusUpdatingStudentId] = useState<string | null>(null);
  const weekdayLabels = getWeekdayShortLabels("sun");

  function formatRecurringSchedule(schedule: RecurringSchedule): string {
    const weekday = weekdayLabels[schedule.weekday] ?? "—";
    return t("lessonOverview.recurring", { weekday, time: schedule.time });
  }

  if (!lesson) {
    return null;
  }

  const currentLesson = lesson;
  const startsAt = new Date(lesson.startsAt);
  const lessonId = lesson.id;
  const converted = lesson.originalType === "group" && lesson.effectiveType === "individual";
  const canEditParticipants = lesson.status !== "completed" && lesson.status !== "cancelled_by_teacher";
  const canChangeParticipantStatus = lesson.status !== "cancelled_by_teacher";
  const canChangeTime = lesson.status !== "completed" && lesson.status !== "cancelled_by_teacher";

  async function handleAddParticipants() {
    if (!selectedStudentIds.length) {
      return;
    }

    setAdding(true);
    try {
      await onAddParticipant(lessonId, selectedStudentIds);
      setSelectedStudentIds([]);
    } finally {
      setAdding(false);
    }
  }

  async function handleParticipantStatusChange(studentId: string, status: TeacherParticipantStatus) {
    setStatusUpdatingStudentId(studentId);
    try {
      await onSetParticipantStatus(lessonId, studentId, status);
    } finally {
      setStatusUpdatingStudentId(null);
    }
  }

  async function handleTimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canChangeTime) {
      return;
    }

    const startsAt = String(new FormData(event.currentTarget).get("startsAt") ?? "");
    if (!startsAt) {
      return;
    }

    setSavingTime(true);
    try {
      await onUpdateLessonTime(currentLesson, startsAt);
    } finally {
      setSavingTime(false);
    }
  }

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

          {canChangeTime ? (
            <form key={`${lesson.id}-${lesson.startsAt}`} onSubmit={handleTimeSubmit}>
              <FieldGroup className="gap-3 rounded-lg border p-3">
                <Field>
                  <FieldLabel htmlFor="lesson-edit-starts-at">{t("form.dateTime")}</FieldLabel>
                  <Input
                    id="lesson-edit-starts-at"
                    type="datetime-local"
                    name="startsAt"
                    defaultValue={formatDateTimeLocal(startsAt)}
                    required
                  />
                </Field>
                <Button type="submit" disabled={savingTime}>
                  {t("form.save")}
                </Button>
              </FieldGroup>
            </form>
          ) : null}

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{t("lessonOverview.participants")}</h3>
            {lesson.participants.map((participant) => {
              const student = getStudent(participant.studentId);
              const studentName = student?.fullName ?? t("lessonOverview.deletedStudent");

              return (
                <div key={participant.id} className="flex items-center gap-3 rounded-lg border p-3">
                  {student ? (
                    <StudentLink studentId={student.id}>
                      <StudentAvatar student={student} size="default" />
                    </StudentLink>
                  ) : (
                    <StudentAvatar
                      student={{
                        id: participant.studentId,
                        fullName: studentName,
                        updatedAt: ""
                      }}
                      size="default"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {student ? <StudentLink studentId={student.id}>{student.fullName}</StudentLink> : studentName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ParticipantStatusBadge
                        status={participant.status}
                        className="text-[0.65rem]"
                        interactive={canChangeParticipantStatus}
                        disabled={statusUpdatingStudentId === participant.studentId}
                        ariaLabel={t("lessonOverview.participantStatusAria", { name: studentName })}
                        onStatusChange={(status) => void handleParticipantStatusChange(participant.studentId, status)}
                      />
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
                      aria-label={t("lessonOverview.removeParticipantAria", { name: studentName })}
                      onClick={() => void onRemoveParticipant(lesson.id, participant.studentId, studentName)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {canEditParticipants ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">{t("lessonOverview.addParticipant")}</p>
                {availableStudents.length ? (
                  <>
                    <StudentMultiCombobox
                      id="lesson-add-participants"
                      students={availableStudents}
                      value={selectedStudentIds}
                      onValueChange={setSelectedStudentIds}
                      placeholder={t("lessonOverview.selectStudents")}
                      disabled={adding}
                    />
                    <Button
                      type="button"
                      disabled={!selectedStudentIds.length || adding}
                      onClick={() => void handleAddParticipants()}
                    >
                      {t("lessonOverview.addParticipantsButton")}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("lessonOverview.noStudentsToAdd")}</p>
                )}
              </div>
            ) : null}
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
