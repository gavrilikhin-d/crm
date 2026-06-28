"use client";

import { type FormEvent, type ReactNode, type SelectHTMLAttributes, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  HelpCircle,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Database, Lesson, LessonPackage, Student, StudentBalance } from "@crm/shared";

type Snapshot = Database & {
  balances: StudentBalance[];
  dashboard: {
    upcomingLessons: Lesson[];
    debtors: Array<{ student: Student; balance: StudentBalance }>;
    studentsCount: number;
    lessonsCount: number;
  };
};

type ApiOptions = {
  method?: string;
  body?: Record<string, unknown>;
};

type ActiveSection = "schedule" | "clients" | "payments" | "sessions";
type ScheduleView = "day" | "week" | "month";
type ActiveModal = "student" | "payment" | "package" | null;

const statusLabels: Record<string, string> = {
  scheduled: "Запланировано",
  confirmed: "Подтверждено",
  cancelled_by_student: "Отменено учеником",
  cancelled_by_teacher: "Отменено преподавателем",
  completed: "Проведено",
  missed: "Пропуск",
  awaiting: "Ожидает ответа",
  declined: "Отказался",
  attended: "Посетил"
};

const typeLabels: Record<string, string> = {
  individual: "Индивидуальное",
  group: "Групповое"
};

const weekDayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const scheduleViewLabels: Record<ScheduleView, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц"
};
const visibleHours = Array.from({ length: 13 }, (_, index) => index + 9);
const calendarStartHour = 9;
const hourHeight = 76;
const lessonDurationByType = {
  group: 90,
  individual: 60
} as const;
const defaultRecurringLessonCount = 4;
const maxRecurringLessonCount = 24;

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("schedule");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const students = snapshot?.students ?? [];
  const lessonPackages = snapshot?.lessonPackages ?? [];
  const lessons = useMemo(
    () =>
      [...(snapshot?.lessons ?? [])].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [snapshot?.lessons]
  );
  const payments = useMemo(
    () =>
      [...(snapshot?.payments ?? [])].sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      ),
    [snapshot?.payments]
  );
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthDays = useMemo(() => getMonthGridDays(selectedDate), [selectedDate]);
  const weekLessons = useMemo(
    () =>
      lessons.filter((lesson) => {
        const lessonDate = new Date(lesson.startsAt);
        return weekDays.some((day) => sameDate(day, lessonDate));
      }),
    [lessons, weekDays]
  );
  const dayLessons = useMemo(
    () => lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), selectedDate)),
    [lessons, selectedDate]
  );
  const monthLessons = useMemo(
    () =>
      lessons.filter((lesson) => {
        const lessonDate = new Date(lesson.startsAt);
        return lessonDate.getFullYear() === selectedDate.getFullYear() && lessonDate.getMonth() === selectedDate.getMonth();
      }),
    [lessons, selectedDate]
  );

  useEffect(() => {
    void loadSnapshot();
  }, []);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadSnapshot() {
    setLoading(true);
    try {
      setSnapshot(await api<Snapshot>("/api/snapshot"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }

  async function withRefresh(action: () => Promise<string | void>) {
    try {
      const result = await action();
      if (result) {
        setMessage(result);
      }
      await loadSnapshot();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Действие не выполнено.");
    }
  }

  function getStudent(studentId: string) {
    return students.find((student) => student.id === studentId);
  }

  function getBalance(studentId: string): StudentBalance {
    return (
      snapshot?.balances.find((balance) => balance.studentId === studentId) ?? {
        studentId,
        paidLessons: 0,
        chargedLessons: 0,
        remainingLessons: 0,
        debtLessons: 0
      }
    );
  }

  async function handleStudentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    await withRefresh(async () => {
      await api("/api/students", { method: "POST", body: data });
      form.reset();
      setActiveModal(null);
      return "Ученик добавлен.";
    });
  }

  async function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const select = form.elements.namedItem("studentIds") as HTMLSelectElement;
    const studentIds = [...select.selectedOptions].map((option) => option.value);
    const lessonType = studentIds.length > 1 ? "group" : "individual";
    const repeatWeekly = data.repeatWeekly === "on";
    const lessonCount = repeatWeekly
      ? clamp(Number(data.repeatCount) || defaultRecurringLessonCount, 1, maxRecurringLessonCount)
      : 1;
    const payload = {
      startsAt: String(data.startsAt),
      studentIds,
      lessonType,
      durationMinutes: lessonDurationByType[lessonType]
    };

    await withRefresh(async () => {
      for (let index = 0; index < lessonCount; index += 1) {
        await api("/api/lessons", {
          method: "POST",
          body: {
            ...payload,
            startsAt: addWeeksToDateTimeLocal(payload.startsAt, index)
          }
        });
      }
      form.reset();
      return lessonCount === 1 ? "Занятие добавлено." : `Добавлено ${lessonCount} занятий.`;
    });
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    if (!data.packageId) {
      delete data.packageId;
    }
    if (data.lessonCount) {
      data.lessonCount = Number(data.lessonCount);
    } else {
      delete data.lessonCount;
    }
    if (data.amount) {
      data.amount = Number(data.amount);
    } else {
      delete data.amount;
    }
    await withRefresh(async () => {
      await api("/api/payments", { method: "POST", body: data });
      form.reset();
      setActiveModal(null);
      return "Оплата добавлена.";
    });
  }

  async function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    data.lessonCount = Number(data.lessonCount);
    data.price = Number(data.price);
    await withRefresh(async () => {
      await api("/api/lesson-packages", { method: "POST", body: data });
      form.reset();
      setActiveModal(null);
      return "Пакет добавлен.";
    });
  }

  async function handleDeleteStudent(student: Student) {
    if (!window.confirm(`Удалить ученика ${student.fullName}? Его оплаты и участия в занятиях тоже будут удалены.`)) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/students/${student.id}`, { method: "DELETE" });
      return "Ученик удален.";
    });
  }

  async function handleDeleteLesson(lesson: Lesson) {
    if (!window.confirm(`Удалить занятие ${formatFullDate(lesson.startsAt)}?`)) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/lessons/${lesson.id}`, { method: "DELETE" });
      return "Занятие удалено.";
    });
  }

  async function handleDeletePackage(lessonPackage: LessonPackage) {
    if (!window.confirm(`Удалить пакет "${lessonPackage.name}"? Уже внесенные оплаты сохранят количество занятий.`)) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/lesson-packages/${lessonPackage.id}`, { method: "DELETE" });
      return "Пакет удален.";
    });
  }

  function shiftCalendar(direction: -1 | 1) {
    setSelectedDate((current) => addToDate(current, scheduleView, direction));
  }

  function goToToday() {
    setSelectedDate(startOfDay(new Date()));
  }

  const debtLessons = snapshot?.balances.reduce((sum, balance) => sum + balance.debtLessons, 0) ?? 0;
  const activeTitle: Record<ActiveSection, string> = {
    schedule: "Расписание",
    clients: "Ученики",
    payments: "Оплаты",
    sessions: "Пакеты занятий"
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-stone-200">
        <SidebarHeader className="px-3 py-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
          <div className="flex h-8 items-center overflow-hidden">
            <span className="text-lg font-black tracking-[0.42em] text-orange-600 group-data-[collapsible=icon]:hidden">
              VOCAL
            </span>
            <span className="hidden text-lg font-black text-orange-600 group-data-[collapsible=icon]:block">V</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Основная навигация">
                <SidebarLink
                  icon={<CreditCard className="size-4" />}
                  active={activeSection === "payments"}
                  onClick={() => setActiveSection("payments")}
                >
                  Оплаты
                </SidebarLink>
                <SidebarLink
                  icon={<Users className="size-4" />}
                  active={activeSection === "clients"}
                  onClick={() => setActiveSection("clients")}
                >
                  Ученики
                </SidebarLink>
                <SidebarLink
                  icon={<CalendarDays className="size-4" />}
                  active={activeSection === "schedule"}
                  onClick={() => setActiveSection("schedule")}
                >
                  Расписание
                </SidebarLink>
                <SidebarLink
                  icon={<GraduationCap className="size-4" />}
                  active={activeSection === "sessions"}
                  onClick={() => setActiveSection("sessions")}
                >
                  Пакеты
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Настройки">
                <a href="#settings">
                  <Settings className="size-4" />
                  <span>Настройки</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Помощь">
                <a href="#help">
                  <HelpCircle className="size-4" />
                  <span>Помощь</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-auto bg-white">
        <header className="flex min-h-22 items-center justify-between border-b border-stone-200 px-10 py-5">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-2" />
            <h1 className="mt-1 text-lg font-bold text-stone-900">{activeTitle[activeSection]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{snapshot?.dashboard.studentsCount ?? 0} учеников</Badge>
            <Badge variant={debtLessons > 0 ? "destructive" : "secondary"}>{debtLessons} неоплаченных занятий</Badge>
            <Button type="button" onClick={() => setActiveSection("schedule")}>
              Запланировать занятие
            </Button>
          </div>
        </header>

        {message ? (
          <div className="border-b border-orange-100 bg-orange-50 px-10 py-3 text-sm text-orange-900">{message}</div>
        ) : null}

        {activeSection === "schedule" ? (
        <section className="grid grid-cols-[minmax(720px,1fr)_330px] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1" id="schedule">
          <div className="min-w-0">
            <div className="mb-3 flex h-12 items-center justify-between gap-3">
              <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-1">
                {(["day", "week", "month"] as const).map((view) => (
                  <Button
                    key={view}
                    variant={scheduleView === view ? "default" : "ghost"}
                    size="sm"
                    type="button"
                    onClick={() => setScheduleView(view)}
                  >
                    {scheduleViewLabels[view]}
                  </Button>
                ))}
              </div>

              <div className="min-w-52 text-center text-xs font-extrabold uppercase tracking-wide text-stone-400">
                {scheduleView === "day" ? formatFullDate(selectedDate.toISOString()) : null}
                {scheduleView === "week" ? formatWeekRange(weekDays) : null}
                {scheduleView === "month" ? formatMonth(selectedDate) : null}
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" type="button" onClick={() => shiftCalendar(-1)} aria-label="Предыдущий период">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={goToToday}>
                  Сегодня
                </Button>
                <Button variant="secondary" size="icon" type="button" onClick={() => shiftCalendar(1)} aria-label="Следующий период">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {scheduleView === "day" ? (
              <DayCalendar
                day={selectedDate}
                currentTime={currentTime}
                lessons={dayLessons}
                getStudent={getStudent}
                onAction={(action) => withRefresh(action)}
                onDeleteLesson={handleDeleteLesson}
              />
            ) : null}

            {scheduleView === "week" ? (
              <WeekCalendar
                weekDays={weekDays}
                currentTime={currentTime}
                lessons={weekLessons}
                getStudent={getStudent}
                onAction={(action) => withRefresh(action)}
                onDeleteLesson={handleDeleteLesson}
              />
            ) : null}

            {scheduleView === "month" ? (
              <MonthCalendar
                selectedDate={selectedDate}
                monthDays={monthDays}
                currentTime={currentTime}
                lessons={monthLessons}
                getStudent={getStudent}
                onDeleteLesson={handleDeleteLesson}
              />
            ) : null}
          </div>

          <aside className="grid content-start gap-4">
            <Card id="new-session">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  Создать занятие <Badge className="bg-teal-100 text-teal-800">Можно группу</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleLessonSubmit}>
                  <Input name="startsAt" type="datetime-local" required />
                  <Select name="studentIds" multiple required>
                    {students
                      .filter((student) => student.status === "active")
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fullName}
                        </option>
                      ))}
                  </Select>
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      className="size-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                      name="repeatWeekly"
                      type="checkbox"
                    />
                    Повторять еженедельно
                  </label>
                  <Input
                    name="repeatCount"
                    type="number"
                    min="1"
                    max={maxRecurringLessonCount}
                    defaultValue={defaultRecurringLessonCount}
                    placeholder="Количество занятий"
                  />
                  <Button type="submit">Добавить в календарь</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Обзор недели</CardTitle>
                <CardDescription>{weekLessons.length} занятий запланировано на этой неделе.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Badge className="bg-teal-100 text-teal-800">
                  {weekLessons.filter((lesson) => lesson.effectiveType === "group").length} групповых
                </Badge>
                <Badge variant="secondary">
                  {weekLessons.filter((lesson) => lesson.effectiveType === "individual").length} индивидуальных
                </Badge>
              </CardContent>
            </Card>
          </aside>
        </section>
        ) : null}

        {activeSection === "clients" ? (
          <ClientsView
            students={students}
            getBalance={getBalance}
            onAddStudent={() => setActiveModal("student")}
            onDeleteStudent={handleDeleteStudent}
            onAction={(action) => withRefresh(action)}
          />
        ) : null}

        {activeSection === "payments" ? (
          <PaymentsView
            payments={payments}
            getStudent={getStudent}
            onAddPayment={() => setActiveModal("payment")}
          />
        ) : null}

        {activeSection === "sessions" ? (
          <SessionsView
            lessonPackages={lessonPackages}
            onAddPackage={() => setActiveModal("package")}
            onDeletePackage={handleDeletePackage}
          />
        ) : null}
      </SidebarInset>

      <Modal open={activeModal === "student"} title="Добавить ученика" onClose={() => setActiveModal(null)}>
        <StudentForm onSubmit={handleStudentSubmit} />
      </Modal>

      <Modal open={activeModal === "payment"} title="Добавить оплату" onClose={() => setActiveModal(null)}>
        <PaymentForm students={students} lessonPackages={lessonPackages} onSubmit={handlePaymentSubmit} />
      </Modal>

      <Modal open={activeModal === "package"} title="Добавить пакет" onClose={() => setActiveModal(null)}>
        <PackageForm onSubmit={handlePackageSubmit} />
      </Modal>
    </SidebarProvider>
  );
}

function SidebarLink({
  icon,
  active,
  onClick,
  children
}: {
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={active}
        tooltip={typeof children === "string" ? children : undefined}
        onClick={onClick}
        className={cn(
          "h-10 font-bold text-stone-500 hover:bg-orange-50 hover:text-orange-700",
          "data-[active=true]:bg-orange-50 data-[active=true]:text-orange-700",
          active && "text-orange-700"
        )}
      >
        {icon}
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function getTelegramBindUrl(student: Student): string | undefined {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!username) {
    return undefined;
  }

  return `https://t.me/${username}?start=${student.telegramBindToken}`;
}

function ClientsView({
  students,
  getBalance,
  onAddStudent,
  onDeleteStudent,
  onAction
}: {
  students: Student[];
  getBalance: (studentId: string) => StudentBalance;
  onAddStudent: () => void;
  onDeleteStudent: (student: Student) => void;
  onAction: (action: () => Promise<string | void>) => void;
}) {
  const [copiedTelegramStudentId, setCopiedTelegramStudentId] = useState<string | null>(null);

  async function copyTelegramBindText(studentId: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedTelegramStudentId(studentId);
    window.setTimeout(() => {
      setCopiedTelegramStudentId((current) => (current === studentId ? null : current));
    }, 2_000);
  }

  return (
    <section className="p-6 px-10 pb-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Ученики <Badge variant="secondary">{students.length}</Badge>
            <Button size="icon" type="button" onClick={onAddStudent} aria-label="Добавить ученика">
              <Plus className="size-4" />
            </Button>
          </CardTitle>
          <CardDescription>Баланс считается в целых занятиях.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {students.map((student) => {
            const balance = getBalance(student.id);
            const telegramBindUrl = getTelegramBindUrl(student);
            const telegramBindText = telegramBindUrl ?? `/start ${student.telegramBindToken}`;
            const telegramBindCopied = copiedTelegramStudentId === student.id;
            const canSendPaymentReminder =
              Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
            return (
              <div
                className="grid grid-cols-[minmax(0,1fr)_160px_220px] items-center gap-4 rounded-lg border border-stone-200 p-4"
                key={student.id}
              >
                <div>
                  <strong className="block text-stone-900">{student.fullName}</strong>
                  <span className="text-sm text-stone-500">
                    {student.phone} ·{" "}
                    {student.telegramChatId
                      ? student.telegramUsername
                        ? `@${student.telegramUsername}`
                        : "Telegram подключен"
                      : "Telegram не подключен"}
                  </span>
                  {!student.telegramChatId ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => void copyTelegramBindText(student.id, telegramBindText)}
                      >
                        {telegramBindUrl ? "Скопировать ссылку Telegram" : "Скопировать команду Telegram"}
                      </Button>
                      {telegramBindCopied ? (
                        <Badge variant="secondary" aria-live="polite">
                          Скопировано
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-stone-600">
                  <span className="block font-semibold">{balance.remainingLessons} осталось</span>
                  <span>{balance.chargedLessons} использовано</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={!canSendPaymentReminder}
                    onClick={() =>
                      onAction(async () => {
                        const result = await api<{ sent: boolean; reason?: string }>(
                          `/api/payment-reminders/${student.id}`,
                          { method: "POST" }
                        );
                        return result.sent ? "Напоминание об оплате отправлено." : result.reason || "Напоминание не отправлено.";
                      })
                    }
                  >
                    Напомнить
                  </Button>
                  <Button variant="ghost" size="icon" type="button" onClick={() => onDeleteStudent(student)}>
                    <Trash2 className="size-4" />
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

function PaymentsView({
  payments,
  getStudent,
  onAddPayment
}: {
  payments: Snapshot["payments"];
  getStudent: (studentId: string) => Student | undefined;
  onAddPayment: () => void;
}) {
  return (
    <section className="p-6 px-10 pb-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            История оплат <Badge variant="secondary">{payments.length}</Badge>
            <Button size="icon" type="button" onClick={onAddPayment} aria-label="Добавить оплату">
              <Plus className="size-4" />
            </Button>
          </CardTitle>
          <CardDescription>Оплаты за разовые занятия и пакеты.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {payments.map((payment) => (
            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] rounded-lg border border-stone-200 p-4" key={payment.id}>
              <div>
                <strong className="block">{getStudent(payment.studentId)?.fullName ?? "Ученик удален"}</strong>
                <span className="text-sm text-stone-500">{formatFullDate(payment.paidAt)}</span>
              </div>
              <span className="text-sm font-semibold text-stone-700">{payment.lessonCount} занятий</span>
              <span className="text-sm font-semibold text-stone-900">{payment.amount}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function SessionsView({
  lessonPackages,
  onAddPackage,
  onDeletePackage
}: {
  lessonPackages: LessonPackage[];
  onAddPackage: () => void;
  onDeletePackage: (lessonPackage: LessonPackage) => void;
}) {
  return (
    <section className="p-6 px-10 pb-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Пакеты занятий <Badge variant="secondary">{lessonPackages.length}</Badge>
            <Button size="icon" type="button" onClick={onAddPackage} aria-label="Добавить пакет">
              <Plus className="size-4" />
            </Button>
          </CardTitle>
          <CardDescription>Например, пакеты на 4 или 8 занятий.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {lessonPackages.map((lessonPackage) => (
            <div className="rounded-lg border border-stone-200 p-4" key={lessonPackage.id}>
              <div className="flex items-start justify-between gap-3">
                <strong>{lessonPackage.name}</strong>
                <Button variant="ghost" size="icon" type="button" onClick={() => onDeletePackage(lessonPackage)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                {lessonPackage.lessonCount} занятий · {lessonPackage.price}
              </p>
              <Badge className="mt-3 bg-orange-100 text-orange-700">
                {Math.round(lessonPackage.price / lessonPackage.lessonCount)} за занятие
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {title}
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Закрыть
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function StudentForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Input name="fullName" placeholder="ФИО" required />
      <Input name="phone" placeholder="Телефон" required />
      <Button type="submit">Добавить ученика</Button>
    </form>
  );
}

function PaymentForm({
  students,
  lessonPackages,
  onSubmit
}: {
  students: Student[];
  lessonPackages: LessonPackage[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Select name="studentId" required defaultValue="">
        <option value="">Ученик</option>
        {students
          .filter((student) => student.status === "active")
          .map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
      </Select>
      <Select name="packageId" defaultValue="">
        <option value="">Без пакета</option>
        {lessonPackages
          .filter((item) => item.active)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}: {item.lessonCount} / {item.price}
            </option>
          ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input name="lessonCount" type="number" min="1" placeholder="Занятий" />
        <Input name="amount" type="number" min="0" placeholder="Сумма" />
      </div>
      <Select name="method" required defaultValue="transfer">
        <option value="transfer">Перевод</option>
        <option value="cash">Наличные</option>
        <option value="other">Другое</option>
      </Select>
      <Button type="submit">Добавить оплату</Button>
    </form>
  );
}

function PackageForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Input name="name" placeholder="Название пакета" required />
      <div className="grid grid-cols-2 gap-3">
        <Input name="lessonCount" type="number" min="1" placeholder="Занятий" required />
        <Input name="price" type="number" min="0" placeholder="Цена" required />
      </div>
      <Button type="submit">Добавить пакет</Button>
    </form>
  );
}

function DayCalendar({
  day,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  const isToday = currentTime ? sameDate(day, currentTime) : false;

  return (
    <div className="grid min-h-[680px] grid-cols-[62px_minmax(240px,1fr)] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      <div
        className={cn(
          "grid justify-items-center border-b border-stone-300 pt-2",
          isToday && "bg-teal-50 text-teal-800"
        )}
      >
        <strong className={cn("text-xs uppercase", isToday ? "text-teal-900" : "text-stone-900")}>{formatWeekday(day)}</strong>
        <span className={cn("text-[0.68rem] font-bold", isToday ? "text-teal-700" : "text-stone-400")}>{formatDay(day)}</span>
      </div>
      <TimeAxis />
      <DayColumn
        day={day}
        currentTime={currentTime}
        lessons={lessons}
        getStudent={getStudent}
        onAction={onAction}
        onDeleteLesson={onDeleteLesson}
      />
    </div>
  );
}

function WeekCalendar({
  weekDays,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  weekDays: Date[];
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  return (
    <div className="grid min-h-[680px] grid-cols-[62px_repeat(7,minmax(86px,1fr))] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      {weekDays.map((day, index) => {
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        return (
          <div
            className={cn(
              "grid justify-items-center border-b border-stone-300 pt-2",
              isToday && "bg-teal-50 text-teal-800"
            )}
            key={day.toISOString()}
          >
            <strong className={cn("text-xs uppercase", isToday ? "text-teal-900" : "text-stone-900")}>{weekDayLabels[index]}</strong>
            <span className={cn("text-[0.68rem] font-bold", isToday ? "text-teal-700" : "text-stone-400")}>
              {formatDay(day)}
            </span>
          </div>
        );
      })}
      <TimeAxis />
      {weekDays.map((day) => (
        <DayColumn
          key={day.toISOString()}
          day={day}
          currentTime={currentTime}
          lessons={lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), day))}
          getStudent={getStudent}
          onAction={onAction}
          onDeleteLesson={onDeleteLesson}
        />
      ))}
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="col-start-1 row-start-2">
      {visibleHours.map((hour) => (
        <div className="h-[76px] pt-1 text-xs font-bold text-stone-400" key={hour}>
          {formatHour(hour)}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  day,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  const isToday = currentTime ? sameDate(day, currentTime) : false;
  const currentTimeOffset = currentTime && isToday ? getCurrentTimeOffset(currentTime) : null;

  return (
    <div
      className={cn("relative min-h-[988px] border-l border-stone-100", isToday && "bg-teal-50/40")}
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
      }}
    >
      <div className="absolute inset-x-2 bottom-[76px] top-[76px] bg-teal-100/70" />
      {currentTimeOffset !== null ? <CurrentTimeMarker top={currentTimeOffset} /> : null}
      {lessons
        .filter((lesson) => sameDate(new Date(lesson.startsAt), day))
        .map((lesson) => (
          <CalendarLesson
            key={lesson.id}
            lesson={lesson}
            getStudent={getStudent}
            onAction={onAction}
            onDelete={() => onDeleteLesson(lesson)}
          />
        ))}
    </div>
  );
}

function CurrentTimeMarker({ top }: { top: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-1 z-20 flex items-center" style={{ top }}>
      <span className="size-2 rounded-full bg-rose-500 shadow-sm" />
      <span className="h-0.5 flex-1 rounded-full bg-rose-500 shadow-sm" />
    </div>
  );
}

function MonthCalendar({
  selectedDate,
  monthDays,
  currentTime,
  lessons,
  getStudent,
  onDeleteLesson
}: {
  selectedDate: Date;
  monthDays: Date[];
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-stone-200">
      {weekDayLabels.map((day) => (
        <div className="border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold uppercase text-stone-500" key={day}>
          {day}
        </div>
      ))}
      {monthDays.map((day) => {
        const dayLessons = lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), day));
        const isOutsideMonth = day.getMonth() !== selectedDate.getMonth();
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        return (
          <div
            className={cn("min-h-32 border-b border-r border-stone-100 p-2", isToday && "bg-teal-50 ring-1 ring-inset ring-teal-200")}
            key={day.toISOString()}
          >
            <div
              className={cn(
                "mb-2 inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
                isToday ? "bg-teal-600 text-white" : isOutsideMonth ? "text-stone-300" : "text-stone-700"
              )}
            >
              {day.getDate()}
            </div>
            <div className="grid gap-1">
              {dayLessons.slice(0, 4).map((lesson) => {
                const student = getStudent(lesson.participants[0]?.studentId);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-left text-[0.68rem] font-semibold text-white",
                      lesson.effectiveType === "group" ? "bg-teal-700" : "bg-teal-600"
                    )}
                    onClick={() => onDeleteLesson(lesson)}
                    title="Нажмите, чтобы удалить занятие"
                  >
                    {formatTime(new Date(lesson.startsAt))} {student?.fullName ?? "Занятие"}
                  </button>
                );
              })}
              {dayLessons.length > 4 ? <span className="text-[0.68rem] text-stone-400">+{dayLessons.length - 4} еще</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarLesson({
  lesson,
  getStudent,
  onAction,
  onDelete
}: {
  lesson: Lesson;
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDelete: () => void;
}) {
  const date = new Date(lesson.startsAt);
  const startsAtMinutes = date.getHours() * 60 + date.getMinutes();
  const top = Math.max(0, ((startsAtMinutes - calendarStartHour * 60) / 60) * hourHeight);
  const height = Math.max(62, (lesson.durationMinutes / 60) * hourHeight - 8);
  const primaryStudent = getStudent(lesson.participants[0]?.studentId);
  const converted = lesson.originalType === "group" && lesson.effectiveType === "individual";
  const hasDebt = lesson.participants.some((participant) => participant.hasDebt);

  return (
    <article
      className={cn(
        "absolute left-3 right-3 z-10 grid gap-0.5 overflow-hidden rounded-md p-2 text-white shadow-xl",
        lesson.effectiveType === "group" ? "bg-teal-700" : "bg-teal-600",
        hasDebt && "bg-stone-400"
      )}
      style={{ top, minHeight: height }}
    >
      <strong className="text-xs leading-tight">{primaryStudent?.fullName ?? "Занятие"}</strong>
      <span className="text-[0.66rem] leading-tight">
        {formatTime(date)} · {typeLabels[lesson.effectiveType]}
      </span>
      <small className="text-[0.66rem] leading-tight">{lesson.participants.length} участник(ов)</small>
      {converted ? <em className="text-[0.66rem] leading-tight">Перешло в индивидуальное</em> : null}
      <div className="mt-1 flex gap-1">
        {lesson.participants.slice(0, 2).map((participant) => (
          <Button
            className="h-6 bg-white/20 px-2 text-[0.62rem] text-white hover:bg-white/30"
            type="button"
            key={participant.id}
            onClick={() =>
              onAction(async () => {
                await api(`/api/lessons/${lesson.id}/participants/${participant.studentId}/status`, {
                  method: "POST",
                  body: { status: "confirmed" }
                });
              })
            }
          >
            ✓
          </Button>
        ))}
        <Button
          className="h-6 bg-white/20 px-2 text-[0.62rem] text-white hover:bg-white/30"
          type="button"
          onClick={() =>
            onAction(async () => {
              await api(`/api/lessons/${lesson.id}/complete`, { method: "POST" });
            })
          }
        >
          Готово
        </Button>
        <Button
          className="h-6 bg-white/20 px-2 text-[0.62rem] text-white hover:bg-white/30"
          type="button"
          onClick={onDelete}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </article>
  );
}

async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formData(form: HTMLFormElement): Record<string, string | number | string[]> {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

function getWeekDays(baseDate: Date): Date[] {
  const monday = startOfDay(baseDate);
  const day = baseDate.getDay() || 7;
  monday.setDate(baseDate.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function getMonthGridDays(baseDate: Date): Date[] {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = startOfDay(firstOfMonth);
  const day = firstOfMonth.getDay() || 7;
  gridStart.setDate(firstOfMonth.getDate() - day + 1);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addToDate(value: Date, view: ScheduleView, direction: -1 | 1): Date {
  const date = startOfDay(value);
  if (view === "day") {
    date.setDate(date.getDate() + direction);
  }
  if (view === "week") {
    date.setDate(date.getDate() + direction * 7);
  }
  if (view === "month") {
    date.setMonth(date.getMonth() + direction);
  }
  return date;
}

function sameDate(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function addWeeksToDateTimeLocal(value: string, weeks: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + weeks * 7);
  return formatDateTimeLocal(date);
}

function formatDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function getCurrentTimeOffset(value: Date): number | null {
  const currentMinutes = value.getHours() * 60 + value.getMinutes();
  const calendarStartMinutes = calendarStartHour * 60;
  const calendarEndMinutes = calendarStartMinutes + visibleHours.length * 60;

  if (currentMinutes < calendarStartMinutes || currentMinutes >= calendarEndMinutes) {
    return null;
  }

  return ((currentMinutes - calendarStartMinutes) / 60) * hourHeight;
}

function formatDay(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "short", day: "numeric" }).format(value);
}

function formatWeekday(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(value);
}

function formatMonth(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(value);
}

function formatWeekRange(days: Date[]): string {
  return `${formatDay(days[0])} - ${formatDay(days[6])}`;
}

function formatHour(hour: number): string {
  return `${hour}:00`;
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
