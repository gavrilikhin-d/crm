"use client";

import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { getStudentInitials } from "@crm/shared/student-initials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function validateAvatarFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(t("avatar.selectImage"));
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error(t("avatar.maxSize"));
  }
}

function AvatarPicker({
  fullName,
  previewSrc,
  onFileSelect,
  onClear,
  className
}: {
  fullName: string;
  previewSrc?: string | null;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      validateAvatarFile(file);
      onFileSelect(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("avatar.uploadFailed"));
    }
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <button
        type="button"
        className={cn(
          "rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isDragging && "ring-2 ring-primary ring-offset-2"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={t("avatar.uploadAria")}
      >
        <Avatar size="lg" className="size-20 cursor-pointer">
          {previewSrc ? <AvatarImage src={previewSrc} alt={fullName || t("avatar.defaultAlt")} /> : null}
          <AvatarFallback className="text-lg">{getStudentInitials(fullName || "?")}</AvatarFallback>
        </Avatar>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <FieldDescription className="text-center">{t("avatar.dropHint")}</FieldDescription>
      {previewSrc && onClear ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t("avatar.removePhoto")}
        </Button>
      ) : null}
    </div>
  );
}

export { AvatarPicker, validateAvatarFile };
