"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Student } from "@crm/shared";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/context";

function StudentForm({
  student,
  submitLabel,
  onSubmit,
  onCancel
}: {
  student?: Student;
  submitLabel: string;
  onSubmit: (payload: { fullName: string; avatarFile: File | null; removeAvatar: boolean }) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState(student?.fullName ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(() => {
    if (!student?.avatarUrl) {
      return null;
    }
    return `${student.avatarUrl}?v=${encodeURIComponent(student.updatedAt)}`;
  });

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  function handleFileSelect(file: File) {
    setAvatarFile(file);
    setRemoveAvatar(false);
    setPreviewSrc((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  }

  function handleClearAvatar() {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setPreviewSrc((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error(t("form.fullNameRequired"));
      return;
    }
    await onSubmit({ fullName: trimmedName, avatarFile, removeAvatar });
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <FieldGroup className="gap-4">
        <AvatarPicker
          fullName={fullName}
          previewSrc={previewSrc}
          onFileSelect={handleFileSelect}
          onClear={previewSrc ? handleClearAvatar : undefined}
        />
        <Field>
          <FieldLabel htmlFor="student-full-name">{t("form.fullName")}</FieldLabel>
          <Input
            id="student-full-name"
            name="fullName"
            placeholder={t("form.fullName")}
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{submitLabel}</Button>
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("form.cancel")}
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}

export { StudentForm };
