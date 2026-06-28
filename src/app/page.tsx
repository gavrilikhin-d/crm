"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, GraduationCap, HelpCircle, RefreshCw, Settings, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database, Lesson, LessonPackage, Student, StudentBalance } from "@/types";

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

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("schedule");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");

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
  const selectedDate = useMemo(() => new Date(), []);
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
    if (data.defaultLessonPrice) {
      data.defaultLessonPrice = Number(data.defaultLessonPrice);
    } else {
      delete data.defaultLessonPrice;
    }
    await withRefresh(async () => {
      await api("/api/students", { method: "POST", body: data });
      form.reset();
      return "Ученик добавлен.";
    });
  }

  async function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const select = form.elements.namedItem("studentIds") as HTMLSelectElement;
    data.studentIds = [...select.selectedOptions].map((option) => option.value);
    if (data.durationMinutes) {
      data.durationMinutes = Number(data.durationMinutes);
    } else {
      delete data.durationMinutes;
    }
    await withRefresh(async () => {
      await api("/api/lessons", { method: "POST", body: data });
      form.reset();
      return "Занятие добавлено.";
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

  const debtLessons = snapshot?.balances.reduce((sum, balance) => sum + balance.debtLessons, 0) ?? 0;
  const activeTitle: Record<ActiveSection, string> = {
    schedule: "Расписание",
    clients: "Ученики",
    payments: "Оплаты",
    sessions: "Пакеты занятий"
  };

  return (
    <div className="grid min-h-screen w-screen grid-cols-[132px_minmax(0,1fr)] bg-white max-[900px]:grid-cols-1">
      <aside className="flex min-h-screen flex-col border-r border-stone-200 px-6 py-8 max-[900px]:min-h-0 max-[900px]:border-b max-[900px]:border-r-0">
        <div className="mb-20 text-lg font-black tracking-[0.42em] text-orange-600 max-[900px]:mb-6">VOCAL</div>
        <nav className="grid gap-5 max-[900px]:flex max-[900px]:flex-wrap" aria-label="Основная навигация">
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
        </nav>
        <div className="mt-auto grid gap-3 text-sm text-stone-500 max-[900px]:mt-6 max-[900px]:flex">
          <a className="flex items-center gap-2 hover:text-stone-900" href="#settings">
            <Settings className="size-4" /> Настройки
          </a>
          <a className="flex items-center gap-2 hover:text-stone-900" href="#help">
            <HelpCircle className="size-4" /> Помощь
          </a>
          <button className="flex items-center gap-2 text-left hover:text-stone-900" type="button" onClick={loadSnapshot}>
            <RefreshCw className="size-4" /> Обновить
          </button>
        </div>
      </aside>

      <main className="min-w-0 overflow-x-auto">
        <header className="flex min-h-22 items-center justify-between border-b border-stone-200 px-10 py-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-stone-400">CRM расписания занятий</p>
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
            <div className="mb-3 flex h-12 items-center justify-between">
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
              <div className="text-xs font-extrabold uppercase tracking-wide text-stone-400">
                {scheduleView === "day" ? formatFullDate(selectedDate.toISOString()) : null}
                {scheduleView === "week" ? formatWeekRange(weekDays) : null}
                {scheduleView === "month" ? formatMonth(selectedDate) : null}
              </div>
              <Button variant="secondary" size="sm" onClick={loadSnapshot} disabled={loading}>
                {loading ? "Загрузка..." : "Синхронизировать"}
              </Button>
            </div>

            {scheduleView === "day" ? (
              <DayCalendar
                day={selectedDate}
                lessons={dayLessons}
                getStudent={getStudent}
                onAction={(action) => withRefresh(action)}
                onDeleteLesson={handleDeleteLesson}
              />
            ) : null}

            {scheduleView === "week" ? (
              <WeekCalendar
                weekDays={weekDays}
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
                  Создать занятие <Badge variant="teal">Можно группу</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleLessonSubmit}>
                  <Input name="startsAt" type="datetime-local" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Select name="lessonType" required defaultValue="individual">
                      <option value="individual">Индивидуальное</option>
                      <option value="group">Групповое</option>
                    </Select>
                    <Input name="durationMinutes" type="number" min="1" placeholder="Минут" />
                  </div>
                  <Select name="studentIds" multiple required>
                    {students
                      .filter((student) => student.status === "active")
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fullName}
                        </option>
                      ))}
                  </Select>
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
                <Badge variant="teal">{weekLessons.filter((lesson) => lesson.effectiveType === "group").length} групповых</Badge>
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
            onStudentSubmit={handleStudentSubmit}
            onDeleteStudent={handleDeleteStudent}
            onAction={(action) => withRefresh(action)}
          />
        ) : null}

        {activeSection === "payments" ? (
          <PaymentsView
            students={students}
            lessonPackages={lessonPackages}
            payments={payments}
            getStudent={getStudent}
            onPaymentSubmit={handlePaymentSubmit}
            onPackageSubmit={handlePackageSubmit}
          />
        ) : null}

        {activeSection === "sessions" ? (
          <SessionsView
            lessonPackages={lessonPackages}
            onPackageSubmit={handlePackageSubmit}
            onDeletePackage={handleDeletePackage}
          />
        ) : null}
      </main>
    </div>
  );
}

function SidebarLink({
  icon,
  active,
  onClick,
  children
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-ml-6 flex items-center gap-3 border-l-4 border-transparent bg-transparent py-0 pl-5 text-left text-sm font-bold text-stone-500 shadow-none transition-colors hover:bg-transparent hover:text-orange-600",
        active && "border-orange-600 text-orange-600"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ClientsView({
  students,
  getBalance,
  onStudentSubmit,
  onDeleteStudent,
  onAction
}: {
  students: Student[];
  getBalance: (studentId: string) => StudentBalance;
  onStudentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteStudent: (student: Student) => void;
  onAction: (action: () => Promise<string | void>) => void;
}) {
  return (
    <section className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Добавить ученика</CardTitle>
          <CardDescription>Ученики находятся отдельно от календаря занятий.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onStudentSubmit}>
            <Input name="fullName" placeholder="ФИО" required />
            <Input name="phone" placeholder="Телефон" required />
            <Input name="telegramUsername" placeholder="Имя пользователя в Telegram" />
            <Input name="telegramChatId" placeholder="Telegram chat id" />
            <Input name="defaultLessonPrice" type="number" min="0" placeholder="Цена разового занятия" />
            <Button type="submit">Добавить ученика</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Ученики <Badge variant="secondary">{students.length}</Badge>
          </CardTitle>
          <CardDescription>Баланс считается в целых занятиях.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {students.map((student) => {
            const balance = getBalance(student.id);
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
                    {student.phone} · {student.telegramUsername || "Telegram не подключен"}
                  </span>
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
  students,
  lessonPackages,
  payments,
  getStudent,
  onPaymentSubmit,
  onPackageSubmit
}: {
  students: Student[];
  lessonPackages: LessonPackage[];
  payments: Snapshot["payments"];
  getStudent: (studentId: string) => Student | undefined;
  onPaymentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPackageSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1">
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Добавить оплату</CardTitle>
            <CardDescription>Оплата может быть за одно занятие или за пакет.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm students={students} lessonPackages={lessonPackages} onSubmit={onPaymentSubmit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Добавить пакет</CardTitle>
            <CardDescription>Пакеты всегда содержат целое число занятий.</CardDescription>
          </CardHeader>
          <CardContent>
            <PackageForm onSubmit={onPackageSubmit} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            История оплат <Badge variant="secondary">{payments.length}</Badge>
          </CardTitle>
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
  onPackageSubmit,
  onDeletePackage
}: {
  lessonPackages: LessonPackage[];
  onPackageSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeletePackage: (lessonPackage: LessonPackage) => void;
}) {
  return (
    <section className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Добавить пакет</CardTitle>
          <CardDescription>Например, пакеты на 4 или 8 занятий.</CardDescription>
        </CardHeader>
        <CardContent>
          <PackageForm onSubmit={onPackageSubmit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Пакеты занятий <Badge variant="secondary">{lessonPackages.length}</Badge>
          </CardTitle>
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
              <Badge className="mt-3" variant="orange">
                {Math.round(lessonPackage.price / lessonPackage.lessonCount)} за занятие
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
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
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  return (
    <div className="grid min-h-[680px] grid-cols-[62px_minmax(240px,1fr)] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      <div className="grid justify-items-center border-b border-stone-300 pt-2">
        <strong className="text-xs uppercase text-stone-900">{formatWeekday(day)}</strong>
        <span className="text-[0.68rem] font-bold text-stone-400">{formatDay(day)}</span>
      </div>
      <TimeAxis />
      <DayColumn day={day} lessons={lessons} getStudent={getStudent} onAction={onAction} onDeleteLesson={onDeleteLesson} />
    </div>
  );
}

function WeekCalendar({
  weekDays,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  weekDays: Date[];
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  return (
    <div className="grid min-h-[680px] grid-cols-[62px_repeat(7,minmax(86px,1fr))] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      {weekDays.map((day, index) => (
        <div className="grid justify-items-center border-b border-stone-300 pt-2" key={day.toISOString()}>
          <strong className="text-xs uppercase text-stone-900">{weekDayLabels[index]}</strong>
          <span className="text-[0.68rem] font-bold text-stone-400">{formatDay(day)}</span>
        </div>
      ))}
      <TimeAxis />
      {weekDays.map((day) => (
        <DayColumn
          key={day.toISOString()}
          day={day}
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
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  return (
    <div
      className="relative min-h-[988px] border-l border-stone-100"
      style={{
        background: "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
      }}
    >
      <div className="absolute inset-x-2 bottom-[76px] top-[76px] bg-teal-100/70" />
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

function MonthCalendar({
  selectedDate,
  monthDays,
  lessons,
  getStudent,
  onDeleteLesson
}: {
  selectedDate: Date;
  monthDays: Date[];
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
        return (
          <div className="min-h-32 border-b border-r border-stone-100 p-2" key={day.toISOString()}>
            <div className={cn("mb-2 text-xs font-bold", isOutsideMonth ? "text-stone-300" : "text-stone-700")}>
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
  const monday = new Date(baseDate);
  const day = baseDate.getDay() || 7;
  monday.setDate(baseDate.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function getMonthGridDays(baseDate: Date): Date[] {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  const day = firstOfMonth.getDay() || 7;
  gridStart.setDate(firstOfMonth.getDate() - day + 1);
  gridStart.setHours(0, 0, 0, 0);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function sameDate(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
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
