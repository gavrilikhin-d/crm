"use client";

import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import type { Student } from "@crm/shared";
import { StudentAvatar } from "@/components/student-avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/context";

function StudentMultiCombobox({
  students,
  value,
  onValueChange,
  name,
  id,
  placeholder,
  disabled
}: {
  students: Student[];
  value: string[];
  onValueChange: (studentIds: string[]) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selectedStudents = students.filter((student) => value.includes(student.id));

  function toggleStudent(studentId: string) {
    if (value.includes(studentId)) {
      onValueChange(value.filter((id) => id !== studentId));
      return;
    }
    onValueChange([...value, studentId]);
  }

  function removeStudent(studentId: string) {
    onValueChange(value.filter((id) => id !== studentId));
  }

  return (
    <div className="space-y-2">
      {name
        ? value.map((studentId) => (
            <input key={studentId} type="hidden" name={name} value={studentId} />
          ))
        : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {placeholder ?? t("combobox.addStudent")}
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("combobox.searchStudent")} />
            <CommandList>
              <CommandEmpty>{t("combobox.studentNotFound")}</CommandEmpty>
              <CommandGroup>
                {students.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={student.fullName}
                    data-checked={value.includes(student.id)}
                    onSelect={() => toggleStudent(student.id)}
                  >
                    <StudentAvatar student={student} size="sm" />
                    {student.fullName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedStudents.length ? (
        <div className="flex flex-wrap gap-1.5 py-0.5">
          {selectedStudents.map((student) => (
            <span
              key={student.id}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-1.5 pr-1 text-xs font-medium text-secondary-foreground"
            >
              <StudentAvatar student={student} size="sm" className="shrink-0" />
              <span className="max-w-40 truncate">{student.fullName}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("combobox.removeStudentAria", { name: student.fullName })}
                onClick={() => removeStudent(student.id)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { StudentMultiCombobox };
