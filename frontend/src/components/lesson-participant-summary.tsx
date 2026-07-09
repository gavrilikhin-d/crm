import type { LessonParticipant } from "@crm/shared";
import { Check, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

function countParticipantStatuses(participants: LessonParticipant[]) {
  let confirmed = 0;
  let declined = 0;
  let awaiting = 0;
  let attended = 0;

  for (const participant of participants) {
    if (participant.status === "confirmed") {
      confirmed++;
    } else if (participant.status === "declined") {
      declined++;
    } else if (participant.status === "awaiting") {
      awaiting++;
    } else if (participant.status === "attended") {
      attended++;
    }
  }

  return { confirmed, declined, awaiting, attended };
}

function LessonParticipantSummary({
  participants,
  compact
}: {
  participants: LessonParticipant[];
  compact?: boolean;
}) {
  const { confirmed, declined, awaiting, attended } = countParticipantStatuses(participants);

  if (confirmed === 0 && declined === 0 && awaiting === 0 && attended === 0) {
    return null;
  }

  const textClass = compact ? "text-[0.5rem]" : "text-[0.58rem]";
  const iconClass = compact ? "size-2" : "size-2.5";

  return (
    <div className={cn("flex shrink-0 items-center gap-1 tabular-nums leading-none", textClass)}>
      {confirmed > 0 ? (
        <span className="inline-flex items-center gap-px text-green-600 dark:text-green-400">
          <Check className={iconClass} aria-hidden />
          {confirmed}
        </span>
      ) : null}
      {declined > 0 ? (
        <span className="inline-flex items-center gap-px text-destructive">
          <X className={iconClass} aria-hidden />
          {declined}
        </span>
      ) : null}
      {awaiting > 0 ? (
        <span className="inline-flex items-center gap-px text-amber-600 dark:text-amber-400">
          <HelpCircle className={iconClass} aria-hidden />
          {awaiting}
        </span>
      ) : null}
      {attended > 0 ? (
        <span className="inline-flex items-center gap-px text-sky-600 dark:text-sky-400">
          <Check className={iconClass} aria-hidden />
          {attended}
        </span>
      ) : null}
    </div>
  );
}

export { LessonParticipantSummary };
