"use client";

import { useRef } from "react";
import { LessonParticipantSummary } from "@/components/lesson-participant-summary";
import { ParticipantCardAvatar, ParticipantCardLabel } from "@/components/participant-card-label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import type { Lesson, Student } from "@crm/shared";
import type { CalendarRange } from "@/screens/dashboard/types";
import { formatTimeRange, getLessonPosition } from "@/screens/schedule/utils/calendar";

export const lessonDragGhostClassName =
  "border-dashed border-stone-400 bg-white/70 opacity-[0.58] shadow-lg ring-2 ring-stone-300/60";

export function CalendarLesson({
  lesson,
  calendarRange,
  lane = 0,
  lanes = 1,
  getStudent,
  onSelect,
  onDragStart,
  onDragEnd,
  onResizeStart,
  dragPreview = false
}: {
  lesson: Lesson;
  calendarRange: CalendarRange;
  lane?: number;
  lanes?: number;
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
  onDragStart?: (offsetY: number) => void;
  onDragEnd?: () => void;
  onResizeStart?: (edge: "top" | "bottom", clientY: number) => void;
  dragPreview?: boolean;
}) {
  const { t } = useI18n();
  const suppressClickRef = useRef(false);
  const dragImageRef = useRef<HTMLElement | null>(null);
  const startsAt = new Date(lesson.startsAt);
  const { top, height } = getLessonPosition(lesson, calendarRange);
  const compact = height < 52;
  const groupPaddingRem = 0.75;
  const laneGapRem = lanes > 1 ? 0.125 : 0;
  const totalGapRem = laneGapRem * (lanes - 1);
  const laneWidthPercent = 100 / lanes;
  const laneWidthRem = (groupPaddingRem + totalGapRem) / lanes;
  const laneOffsetPercent = lane * laneWidthPercent;
  const laneOffsetRem = 0.375 + lane * laneGapRem - lane * laneWidthRem;

  return (
    <button
      type="button"
      className={cn(
        "absolute z-10 flex cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border bg-card p-1.5 text-left shadow-sm transition-shadow hover:z-20 hover:shadow-md",
        dragPreview && lessonDragGhostClassName
      )}
      style={{
        top,
        height,
        left: `calc(${laneOffsetPercent}% + ${laneOffsetRem}rem)`,
        width: `calc(${laneWidthPercent}% - ${laneWidthRem}rem)`
      }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          suppressClickRef.current = false;
          return;
        }

        onSelect();
      }}
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => {
        if (!onDragStart) {
          event.preventDefault();
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        dragImageRef.current?.remove();

        const dragImage = event.currentTarget.cloneNode(true) as HTMLElement;
        dragImage.style.position = "fixed";
        dragImage.style.top = "-1000px";
        dragImage.style.left = "-1000px";
        dragImage.style.width = `${rect.width}px`;
        dragImage.style.height = `${rect.height}px`;
        dragImage.style.pointerEvents = "none";
        dragImage.className = `${dragImage.className} ${lessonDragGhostClassName}`;
        document.body.appendChild(dragImage);
        dragImageRef.current = dragImage;

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", lesson.id);
        event.dataTransfer.setDragImage(dragImage, event.clientX - rect.left, offsetY);
        suppressClickRef.current = true;
        onDragStart(offsetY);
      }}
      onDragEnd={() => {
        dragImageRef.current?.remove();
        dragImageRef.current = null;
        onDragEnd?.();
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }}
    >
      {onResizeStart ? (
        <>
          <span
            aria-hidden="true"
            draggable={false}
            className="absolute inset-x-2 top-0 z-20 h-2 cursor-ns-resize rounded-full border-t border-dashed border-stone-400/80 opacity-0 transition-opacity hover:opacity-100"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = true;
              onResizeStart("top", event.clientY);
            }}
          />
          <span
            aria-hidden="true"
            draggable={false}
            className="absolute inset-x-2 bottom-0 z-20 h-2 cursor-ns-resize rounded-full border-b border-dashed border-stone-400/80 opacity-0 transition-opacity hover:opacity-100"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = true;
              onResizeStart("bottom", event.clientY);
            }}
          />
        </>
      ) : null}
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
