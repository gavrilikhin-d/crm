"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  BalanceAdjustment,
  Database,
  Lesson,
  LessonPackage,
  Payment,
  RecurringSchedule,
  Student,
  StudentBalance
} from "@crm/shared";
import { formatMoney, resolveCurrency } from "@crm/shared/currency";
import { ParticipantStatusBadge } from "@/components/participant-status-badge";
import { TelegramIcon } from "@/components/icons/telegram-icon";
import { StudentAvatar } from "@/components/student-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Snapshot = Database & {
  balances: StudentBalance[];
};

const studentStatusLabels = {
  active: "Активный",
  inactive: "Неактивный"
} as const;

const paymentMethodLabels = {
  cash: "Наличные",
  transfer: "Перевод",
  other: "Другое"
} as const;

const lessonStatusLabels: Record<string, string> = {
  scheduled: "Запланировано",
  confirmed: "Подтверждено",
  cancelled_by_student: "Отменено учеником",
  cancelled_by_teacher: "Отменено преподавателем",
  completed: "Проведено",
  missed: "Пропуск"
};

const lessonTypeLabels = {
  individual: "Индивидуальное",
  group: "Групповое"
} as const;

const weekdayLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(value));
}

function formatRecurringSchedule(schedule: RecurringSchedule): string {
  const weekday = weekdayLabels[schedule.weekday] ?? "—";
  return `Каждую ${weekday} в ${schedule.time}, ${lessonTypeLabels[schedule.lessonType]}`;
}

function getTelegramBindUrl(student: Student): string | undefined {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!username) {
    return undefined;
  }
  return `https://t.me/${username}?start=${student.telegramBindToken}`;
}

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Snapshot>("/api/snapshot")
      .then(setSnapshot)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  }, []);

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
  const adjustments = useMemo(
    () =>
      [...(snapshot?.balanceAdjustments.filter((item) => item.studentId === id) ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [id, snapshot?.balanceAdjustments]
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

  if (loading) {
    return <main className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">Загрузка...</main>;
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
            Назад
          </Link>
        </Button>
        <p className="mt-4 text-muted-foreground">Ученик не найден.</p>
      </main>
    );
  }

  const telegramBindUrl = getTelegramBindUrl(student);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 pb-10">
      <Button variant="ghost" className="w-fit" asChild>
        <Link href="/">
          <ArrowLeft data-icon="inline-start" />
          Назад
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <StudentAvatar student={student} size="lg" className="size-20" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{student.fullName}</h1>
              <Badge variant={student.status === "active" ? "secondary" : "outline"}>
                {studentStatusLabels[student.status]}
              </Badge>
              {balance.debtLessons > 0 ? <Badge variant="destructive">Долг: {balance.debtLessons}</Badge> : null}
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Telegram: </span>
                {student.telegramChatId ? (
                  <span className="inline-flex items-center gap-1">
                    <TelegramIcon className="size-3.5 shrink-0" />
                    {student.telegramUsername ? `@${student.telegramUsername}` : "Подключен"}
                  </span>
                ) : (
                  "Не подключен"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Цена занятия: </span>
                {formatMoney(student.defaultLessonPrice, currency)}
              </p>
              <p>
                <span className="text-muted-foreground">Добавлен: </span>
                {formatDate(student.createdAt)}
              </p>
              {!student.telegramChatId && telegramBindUrl ? (
                <p className="truncate">
                  <span className="text-muted-foreground">Ссылка для привязки: </span>
                  {telegramBindUrl}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-1">
            <BalanceStat label="Осталось" value={String(balance.remainingLessons)} highlight={balance.remainingLessons < 1} />
            <BalanceStat label="Использовано" value={String(balance.chargedLessons)} />
            <BalanceStat label="Оплачено занятий" value={String(balance.paidLessons)} />
            <BalanceStat label="Долг" value={String(balance.debtLessons)} highlight={balance.debtLessons > 0} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Оплаты</CardTitle>
            <CardDescription>{payments.length} записей</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Занятий</TableHead>
                    <TableHead>Способ</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatFullDate(payment.paidAt)}</TableCell>
                      <TableCell>{payment.lessonCount}</TableCell>
                      <TableCell>{paymentMethodLabels[payment.method]}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(payment.amount, currency)}
                        {payment.packageId ? (
                          <p className="text-xs font-normal text-muted-foreground">
                            {packagesById.get(payment.packageId)?.name ?? "Пакет"}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Оплат пока нет.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Корректировки баланса</CardTitle>
            <CardDescription>{adjustments.length} записей</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {adjustments.length ? (
              adjustments.map((adjustment) => (
                <AdjustmentRow key={adjustment.id} adjustment={adjustment} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Корректировок нет.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Повторяющиеся занятия</CardTitle>
          <CardDescription>{recurringSchedules.length} расписаний</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recurringSchedules.length ? (
            recurringSchedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{formatRecurringSchedule(schedule)}</p>
                <p className="mt-1 text-muted-foreground">
                  С {formatDate(schedule.activeFrom)}
                  {schedule.activeTo ? ` по ${formatDate(schedule.activeTo)}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Не участвует в повторяющихся занятиях.</p>
          )}
        </CardContent>
      </Card>

      <LessonSection title="Предстоящие занятия" lessons={upcomingLessons} studentId={id} emptyText="Предстоящих занятий нет." />
      <LessonSection title="Прошедшие занятия" lessons={pastLessons} studentId={id} emptyText="Прошедших занятий нет." />
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

function AdjustmentRow({ adjustment }: { adjustment: BalanceAdjustment }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">
          {adjustment.lessonDelta > 0 ? "+" : ""}
          {adjustment.lessonDelta} занятий
        </p>
        <p className="text-muted-foreground">{formatFullDate(adjustment.createdAt)}</p>
      </div>
      <p className="mt-1 text-muted-foreground">{adjustment.reason}</p>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{lessons.length} занятий</CardDescription>
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
                      {lessonTypeLabels[lesson.effectiveType]}, {lesson.durationMinutes} мин
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{lessonStatusLabels[lesson.status] ?? lesson.status}</Badge>
                    <ParticipantStatusBadge status={participant.status} className="text-[0.65rem]" />
                    {participant.hasDebt ? (
                      <Badge variant="destructive" className="text-[0.65rem]">
                        Долг
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
