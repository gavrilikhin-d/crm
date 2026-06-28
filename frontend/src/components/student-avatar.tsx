"use client";

import { useRef, type ChangeEvent } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Student } from "@crm/shared";
import { getStudentInitials } from "@crm/shared/student-initials";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

type StudentLike = Pick<Student, "id" | "fullName" | "avatarUrl" | "updatedAt">;

function getAvatarSrc(student: StudentLike): string | undefined {
  if (!student.avatarUrl) {
    return undefined;
  }

  return `${student.avatarUrl}?v=${encodeURIComponent(student.updatedAt)}`;
}

function StudentAvatar({
  student,
  size = "default",
  className,
  badge
}: {
  student: StudentLike;
  size?: "default" | "sm" | "lg";
  className?: string;
  badge?: "confirmed" | "declined";
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={getAvatarSrc(student)} alt={student.fullName} />
      <AvatarFallback>{getStudentInitials(student.fullName)}</AvatarFallback>
      {badge === "confirmed" ? (
        <AvatarBadge className="translate-x-1/4 translate-y-1/4 bg-green-600 text-white ring-card dark:bg-green-500">
          <Check />
        </AvatarBadge>
      ) : null}
      {badge === "declined" ? (
        <AvatarBadge className="translate-x-1/4 translate-y-1/4 bg-destructive text-white ring-card">
          <X />
        </AvatarBadge>
      ) : null}
    </Avatar>
  );
}

function StudentAvatarUpload({
  student,
  size = "lg",
  className,
  onUpload
}: {
  student: StudentLike;
  size?: "default" | "sm" | "lg";
  className?: string;
  onUpload: (studentId: string, file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(t("avatar.selectImage"));
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(t("avatar.maxSize"));
      }
      await onUpload(student.id, file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("avatar.uploadFailed"));
    }
  }

  return (
    <button
      type="button"
      className={cn("relative shrink-0 rounded-full", className)}
      onClick={() => inputRef.current?.click()}
      aria-label={t("avatar.uploadForAria", { name: student.fullName })}
    >
      <StudentAvatar student={student} size={size} className="cursor-pointer" />
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void handleChange(event)} />
    </button>
  );
}

export { StudentAvatar, StudentAvatarUpload };
