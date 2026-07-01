"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/date-time-picker";
import { StudentMultiCombobox } from "@/components/student-multi-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useI18n } from "@/i18n/context";
import type { Student } from "@crm/shared";

export function LessonForm({
  students,
  recurringEnabled,
  defaultStartsAt,
  onSubmit
}: {
  students: Student[];
  recurringEnabled: boolean;
  defaultStartsAt: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const activeStudents = students.filter((student) => student.status === "active");

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (!selectedStudentIds.length) {
      event.preventDefault();
      toast.error(t("toast.selectAtLeastOneStudent"));
      return;
    }
    onSubmit(event);
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="lesson-starts-at">{t("form.dateTime")}</FieldLabel>
          <DateTimePicker id="lesson-starts-at" name="startsAt" defaultValue={defaultStartsAt} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="lesson-students">{t("form.students")}</FieldLabel>
          <StudentMultiCombobox
            id="lesson-students"
            name="studentIds"
            students={activeStudents}
            value={selectedStudentIds}
            onValueChange={setSelectedStudentIds}
            placeholder={t("form.addStudent")}
            disabled={!activeStudents.length}
          />
        </Field>

        {recurringEnabled ? (
          <Field orientation="horizontal">
            <Checkbox id="lesson-repeat-weekly" name="repeatWeekly" />
            <FieldContent>
              <FieldLabel htmlFor="lesson-repeat-weekly">{t("form.repeatWeekly")}</FieldLabel>
            </FieldContent>
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">{t("plan.recurringDisabled")}</p>
        )}

        <Button type="submit" disabled={!activeStudents.length || !selectedStudentIds.length}>
          {t("form.addToCalendar")}
        </Button>
      </FieldGroup>
    </form>
  );
}
