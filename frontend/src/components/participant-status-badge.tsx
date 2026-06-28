import type { ParticipantStatus } from "@crm/shared";
import { getParticipantStatusLabel } from "@/i18n/labels";
import { participantStatusBadgeClass } from "@/lib/participant-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function ParticipantStatusBadge({
  status,
  className
}: {
  status: ParticipantStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(participantStatusBadgeClass[status], className)}>
      {getParticipantStatusLabel(status)}
    </Badge>
  );
}

export { ParticipantStatusBadge };
