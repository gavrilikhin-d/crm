import type { ParticipantStatus, Student } from "@crm/shared";
import { StudentAvatar } from "@/components/student-avatar";
import { cn } from "@/lib/utils";

type StudentLike = Pick<Student, "id" | "fullName" | "avatarUrl" | "updatedAt">;

function getParticipantBadge(status: ParticipantStatus): "confirmed" | "declined" | undefined {
  if (status === "confirmed") {
    return "confirmed";
  }
  if (status === "declined") {
    return "declined";
  }
  return undefined;
}

function ParticipantCardAvatar({
  student,
  status,
  compact
}: {
  student: StudentLike;
  status: ParticipantStatus;
  compact?: boolean;
}) {
  return (
    <StudentAvatar
      student={student}
      size={compact ? "sm" : "default"}
      badge={getParticipantBadge(status)}
      className={cn("shrink-0", compact ? "size-5" : "size-6")}
    />
  );
}

function ParticipantCardLabel({
  name,
  compact
}: {
  name: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("truncate leading-tight", compact ? "text-[0.58rem]" : "text-[0.68rem]")}>{name}</span>
  );
}

export { ParticipantCardAvatar, ParticipantCardLabel };
