"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TelegramIcon } from "@/components/icons/telegram-icon";
import { StudentLink } from "@/components/student-link";
import { StudentAvatar } from "@/components/student-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/context";
import type { Student } from "@crm/shared";
import { pageSectionClass } from "@/screens/dashboard/constants";
import { getTelegramBindUrl } from "./utils/telegram-bind";

export function ClientsView({
  students,
  onAddStudent,
  onEditStudent,
  onDeleteStudent
}: {
  students: Student[];
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (student: Student) => void;
}) {
  const { t } = useI18n();

  async function copyTelegramBindText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success(t("toast.telegramLinkCopied"));
  }

  return (
    <section className={pageSectionClass}>
      <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t("clients.title")} <Badge variant="secondary">{students.length}</Badge>
            <Button size="icon-sm" type="button" className="hidden sm:inline-flex" onClick={onAddStudent} aria-label={t("clients.addStudentAria")}>
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-3 sm:px-4">
          {students.map((student) => {
            const telegramBindUrl = getTelegramBindUrl(student);
            return (
              <div
                key={student.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5"
              >
                <StudentLink studentId={student.id} className="shrink-0">
                  <StudentAvatar student={student} size="sm" className="sm:hidden" />
                  <StudentAvatar student={student} size="default" className="hidden sm:flex" />
                </StudentLink>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-stone-900 sm:text-base">
                    <StudentLink studentId={student.id}>{student.fullName}</StudentLink>
                  </h3>
                  {student.telegramChatId ? (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground sm:text-sm">
                      <TelegramIcon className="size-3 shrink-0 sm:size-3.5" />
                      <span className="truncate">
                        {student.telegramUsername ? `@${student.telegramUsername}` : t("clients.telegramConnected")}
                      </span>
                    </p>
                  ) : telegramBindUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="mt-0.5 h-6 px-2 text-[0.6875rem] sm:mt-1 sm:h-7 sm:text-xs"
                      onClick={() => void copyTelegramBindText(telegramBindUrl)}
                    >
                      <TelegramIcon data-icon="inline-start" />
                      {t("clients.connectTelegram")}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="mt-0.5 text-[0.6875rem] sm:mt-1 sm:text-xs">
                      {t("clients.telegramBotUsernameMissing")}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => onEditStudent(student)} aria-label={t("clients.editStudentAria", { name: student.fullName })}>
                    <Pencil className="size-3.5 sm:size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => onDeleteStudent(student)}>
                    <Trash2 className="size-3.5 sm:size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
