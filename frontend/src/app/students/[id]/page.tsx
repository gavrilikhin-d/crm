"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Database, Lesson, LessonPackage, RecurringSchedule, Student, StudentBalance } from "@crm/shared";
import { formatMoney, resolveCurrency } from "@crm/shared/currency";
import { TelegramIcon } from "@/components/icons/telegram-icon";
import { ParticipantStatusBadge } from "@/components/participant-status-badge";
import { StudentAvatar } from "@/components/student-avatar";
import { StudentForm } from "@/components/student-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { readFileAsDataUrl } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/context";
import { formatFullDate, formatLongDate } from "@/i18n/format";
import {
  getLessonStatusLabel,
  getLessonTypeLabel,
  getPaymentMethodLabel,
  getStudentStatusLabel,
  getWeekdayShortLabels
} from "@/i18n/labels";

type Snapshot = Database & {
  balances: StudentBalance[];
};

function getTelegramBindUrl(student: Student): string | undefined {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!username) {
    return undefined;
  }
  return `https://t.me/${username}?start=${student.telegramBindToken}`;
}

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const weekdayLabels = getWeekdayShortLabels("sun");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const loadSnapshot = useCallback(async () => {
    const data = await api<Snapshot>("/api/snapshot");
    setSnapshot(data);
  }, []);

  useEffect(() => {
    void loadSnapshot()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t("toast.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [loadSnapshot, t]);

  const student = snapshot?.students.find((item) => item.id === id);
  const currency = resolveCurrency(snapshot?.settings.currency);
  const balance = snapshot?.balances.find((item) => item.studentId === id);
  const payments = useMemo(
    () =>
      [...(snapshot?.payments.filter((payment) => payment.studentId === id) ?? [])].sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      ),
    [id, snapshot?.payments]
  );
  const lessons = useMemo(() => {
    const items =
      snapshot?.lessons.filter((lesson) => lesson.participants.some((participant) => participant.studentId === id)) ??
      [];
    return [...items].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [id, snapshot?.lessons]);
  const upcomingLessons = useMemo(
    () => lessons.filter((lesson) => new Date(lesson.startsAt).getTime() >= Date.now()),
    [lessons]
  );
  const pastLessons = useMemo(
    () => lessons.filter((lesson) => new Date(lesson.startsAt).getTime() < Date.now()),
    [lessons]
  );
  const recurringSchedules = useMemo(
    () => snapshot?.recurringSchedules.filter((schedule) => schedule.studentIds.includes(id)) ?? [],
    [id, snapshot?.recurringSchedules]
  );
  const packagesById = useMemo(() => {
    const map = new Map<string, LessonPackage>();
    for (const lessonPackage of snapshot?.lessonPackages ?? []) {
      map.set(lessonPackage.id, lessonPackage);
    }
    return map;
  }, [snapshot?.lessonPackages]);

  async function handleStudentUpdate(payload: {
    fullName: string;
    avatarFile: File | null;
    removeAvatar: boolean;
  }) {
    try {
      const body: Record<string, unknown> = { fullName: payload.fullName.trim() };
      if (payload.removeAvatar) {
        body.avatarDataUrl = null;
      } else if (payload.avatarFile) {
        body.avatarDataUrl = await readFileAsDataUrl(payload.avatarFile);
      }
      await api(`/api/students/${id}`, { method: "PATCH", body });
      await loadSnapshot();
      setEditing(false);
      toast.success(t("toast.studentUpdated"));
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : t("toast.saveFailed"));
    }
  }

  async function copyTelegramBindText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success(t("toast.telegramLinkCopied"));
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">{t("common.loading")}</main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-destructive">{error}</p>
      </main>
    );
  }

  if (!student || !balance) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            {t("common.back")}
          </Link>
        </Button>
        <p className="mt-4 text-muted-foreground">{t("student.notFound")}</p>
      </main>
    );
  }

  const telegramBindUrl = getTelegramBindUrl(student);

  function formatRecurringSchedule(schedule: RecurringSchedule): string {
    const weekday = weekdayLabels[schedule.weekday] ?? "—";
    return t("studentPage.recurringSchedule", {
      weekday,
      time: schedule.time,
      type: getLessonTypeLabel(schedule.lessonType)
    });
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 pb-10">
      <Button variant="ghost" className="w-fit" asChild>
        <Link href="/">
          <ArrowLeft data-icon="inline-start" />
          {t("common.back")}
        </Link>
      </Button>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("student.edit.title")}</CardTitle>
            <CardDescription>{t("student.edit.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <StudentForm
              key={student.updatedAt}
              student={student}
              submitLabel={t("form.save")}
              onSubmit={handleStudentUpdate}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
            <StudentAvatar student={student} size="lg" className="size-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{student.fullName}</h1>
                <Badge variant={student.status === "active" ? "secondary" : "outline"}>
                  {getStudentStatusLabel(student.status)}
                </Badge>
                {balance.debtLessons > 0 ? (
                  <Badge variant="destructive">{t("badge.debtWithCount", { count: balance.debtLessons })}</Badge>
                ) : null}
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Telegram: </span>
                  {student.telegramChatId ? (
                    <span className="inline-flex items-center gap-1">
                      <TelegramIcon className="size-3.5 shrink-0" />
                      {student.telegramUsername ? `@${student.telegramUsername}` : t("student.telegramConnected")}
                    </span>
                  ) : telegramBindUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => void copyTelegramBindText(telegramBindUrl)}
                    >
                      <TelegramIcon data-icon="inline-start" />
                      {t("student.connectTelegram")}
                    </Button>
                  ) : (
                    t("student.telegramNotConnected")
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("student.lessonPrice")}</span>
                  {formatMoney(student.defaultLessonPrice, currency)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("student.addedAt")}</span>
                  {formatLongDate(student.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                {t("student.edit.button")}
              </Button>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <BalanceStat label={t("balance.remaining")} value={String(balance.remainingLessons)} highlight={balance.remainingLessons < 1} />
                <BalanceStat label={t("balance.used")} value={String(balance.chargedLessons)} />
                <BalanceStat label={t("balance.paidLessons")} value={String(balance.paidLessons)} />
                <BalanceStat label={t("balance.debt")} value={String(balance.debtLessons)} highlight={balance.debtLessons > 0} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("studentPage.paymentsTitle")}</CardTitle>
          <CardDescription>{t("common.recordsCount", { count: payments.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("table.lessonCount")}</TableHead>
                  <TableHead>{t("table.method")}</TableHead>
                  <TableHead className="text-right">{t("table.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatFullDate(payment.paidAt)}</TableCell>
                    <TableCell>{payment.lessonCount}</TableCell>
                    <TableCell>{getPaymentMethodLabel(payment.method)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(payment.amount, currency)}
                      {payment.packageId ? (
                        <p className="text-xs font-normal text-muted-foreground">
                          {packagesById.get(payment.packageId)?.name ?? t("payments.packageFallback")}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t("studentPage.paymentsEmpty")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("studentPage.recurringTitle")}</CardTitle>
          <CardDescription>{t("common.schedulesCount", { count: recurringSchedules.length })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recurringSchedules.length ? (
            recurringSchedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{formatRecurringSchedule(schedule)}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("common.fromDate", { date: formatLongDate(schedule.activeFrom) })}
                  {schedule.activeTo ? t("common.toDate", { date: formatLongDate(schedule.activeTo) }) : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("studentPage.recurringEmpty")}</p>
          )}
        </CardContent>
      </Card>

      <LessonSection
        title={t("studentPage.upcomingLessons")}
        lessons={upcomingLessons}
        studentId={id}
        emptyText={t("studentPage.upcomingEmpty")}
      />
      <LessonSection
        title={t("studentPage.pastLessons")}
        lessons={pastLessons}
        studentId={id}
        emptyText={t("studentPage.pastEmpty")}
      />
    </main>
  );
}

function BalanceStat({
  label,
  value,
  highlight
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", highlight && "border-destructive/30 bg-destructive/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", highlight && "text-destructive")}>{value}</p>
    </div>
  );
}

function LessonSection({
  title,
  lessons,
  studentId,
  emptyText
}: {
  title: string;
  lessons: Lesson[];
  studentId: string;
  emptyText: string;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t("common.lessonsCount", { count: lessons.length })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lessons.length ? (
          lessons.map((lesson) => {
            const participant = lesson.participants.find((item) => item.studentId === studentId);
            if (!participant) {
              return null;
            }

            return (
              <div key={lesson.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{formatFullDate(lesson.startsAt)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getLessonTypeLabel(lesson.effectiveType)}, {t("common.minutes", { count: lesson.durationMinutes })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{getLessonStatusLabel(lesson.status)}</Badge>
                    <ParticipantStatusBadge status={participant.status} className="text-[0.65rem]" />
                    {participant.hasDebt ? (
                      <Badge variant="destructive" className="text-[0.65rem]">
                        {t("badge.debt")}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
