"use client";

import type { ParticipantStatus } from "@crm/shared";
import { toTeacherParticipantStatus, type TeacherParticipantStatus } from "@crm/shared/lesson-attendance";
import { getParticipantStatusLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/context";
import { participantStatusBadgeClass } from "@/lib/participant-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function teacherDisplayStatus(status: ParticipantStatus): ParticipantStatus {
  return toTeacherParticipantStatus(status) === "declined" ? "declined" : "confirmed";
}

function nextTeacherStatus(status: ParticipantStatus): TeacherParticipantStatus {
  return toTeacherParticipantStatus(status) === "declined" ? "confirmed" : "declined";
}

function ParticipantStatusBadge({
  status,
  className,
  interactive = false,
  disabled = false,
  ariaLabel,
  onStatusChange
}: {
  status: ParticipantStatus;
  className?: string;
  interactive?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onStatusChange?: (status: TeacherParticipantStatus) => void;
}) {
  const { t } = useI18n();
  const displayStatus = interactive ? teacherDisplayStatus(status) : status;
  const hint = t("lessonOverview.participantStatusHint");

  if (!interactive || !onStatusChange) {
    return (
      <Badge variant="outline" className={cn(participantStatusBadgeClass[displayStatus], className)}>
        {getParticipantStatusLabel(displayStatus, t)}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "group relative inline-flex",
        "before:pointer-events-none before:absolute before:inset-x-[-0.25rem] before:top-full before:h-10 before:content-['']"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "relative z-10 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity",
          participantStatusBadgeClass[displayStatus],
          disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:opacity-80",
          className
        )}
        onClick={() => onStatusChange(nextTeacherStatus(status))}
      >
        {getParticipantStatusLabel(displayStatus, t)}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden w-max max-w-xs -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background group-hover:block"
      >
        {hint}
      </span>
    </span>
  );
}

export { ParticipantStatusBadge, nextTeacherStatus, teacherDisplayStatus };
