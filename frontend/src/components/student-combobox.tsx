"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

function StudentCombobox({
  students,
  value,
  onValueChange,
  name,
  id,
  placeholder = "Выберите ученика",
  disabled
}: {
  students: Student[];
  value: string;
  onValueChange: (studentId: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedStudent = students.find((student) => student.id === value);

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selectedStudent && "text-muted-foreground")}
          >
            {selectedStudent ? (
              <span className="flex min-w-0 items-center gap-2">
                <StudentAvatar student={selectedStudent} size="sm" />
                <span className="truncate">{selectedStudent.fullName}</span>
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Найти ученика..." />
            <CommandList>
              <CommandEmpty>Ученик не найден.</CommandEmpty>
              <CommandGroup>
                {students.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={student.fullName}
                    data-checked={value === student.id}
                    onSelect={() => {
                      onValueChange(student.id);
                      setOpen(false);
                    }}
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
    </>
  );
}

export { StudentCombobox };
