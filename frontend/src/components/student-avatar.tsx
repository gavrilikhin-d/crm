"use client";

import { useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import type { Student } from "@crm/shared";
import { getStudentInitials } from "@crm/shared/student-initials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
  className
}: {
  student: StudentLike;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={getAvatarSrc(student)} alt={student.fullName} />
      <AvatarFallback>{getStudentInitials(student.fullName)}</AvatarFallback>
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
        throw new Error("Выберите изображение.");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Изображение должно быть не больше 2 МБ.");
      }
      await onUpload(student.id, file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить аватар.");
    }
  }

  return (
    <button
      type="button"
      className={cn("relative shrink-0 rounded-full", className)}
      onClick={() => inputRef.current?.click()}
      aria-label={`Загрузить аватар для ${student.fullName}`}
    >
      <StudentAvatar student={student} size={size} className="cursor-pointer" />
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void handleChange(event)} />
    </button>
  );
}

export { StudentAvatar, StudentAvatarUpload };
