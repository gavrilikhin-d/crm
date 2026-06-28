"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  HelpCircle,
  Plus,
  Pencil,
  RefreshCw,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/date-time-picker";
import { CurrencyInput } from "@/components/examples/input/special/currency-input";
import { AvatarPicker } from "@/components/avatar-picker";
import { StudentAvatar } from "@/components/student-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import { Toaster } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { AppSettings, Database, Lesson, LessonPackage, RecurringDeleteScope, Student, StudentBalance } from "@crm/shared";
import { CURRENCIES, formatMoney, resolveCurrency, type CurrencyCode } from "@crm/shared/currency";

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

type ActiveSection = "schedule" | "clients" | "payments" | "sessions" | "settings";
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
const defaultCalendarStartHour = 9;
const defaultCalendarEndHour = 22;
const hourHeight = 76;
const lessonDurationByType = {
  group: 90,
  individual: 60
} as const;

type CalendarRange = {
  startHour: number;
  endHour: number;
  hours: number[];
};

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("schedule");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonFormKey, setLessonFormKey] = useState(0);
  const [studentFormKey, setStudentFormKey] = useState(0);
  const [paymentFormKey, setPaymentFormKey] = useState(0);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<Lesson | null>(null);

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
  const currency = resolveCurrency(snapshot?.settings.currency);
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
  const dayCalendarRange = useMemo(
    () => getCalendarRange(dayLessons, currentTime && sameDate(selectedDate, currentTime) ? currentTime : undefined),
    [currentTime, dayLessons, selectedDate]
  );
  const weekCalendarRange = useMemo(
    () =>
      getCalendarRange(
        weekLessons,
        currentTime && weekDays.some((day) => sameDate(day, currentTime)) ? currentTime : undefined
      ),
    [currentTime, weekDays, weekLessons]
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
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }

  async function withRefresh(action: () => Promise<string | void>) {
    try {
      const result = await action();
      if (result) {
        toast.success(result);
      }
      await loadSnapshot();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Действие не выполнено.");
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

  async function handleStudentCreate(payload: { fullName: string; avatarFile: File | null }) {
    await withRefresh(async () => {
      const body: Record<string, unknown> = { fullName: payload.fullName.trim() };
      if (payload.avatarFile) {
        body.avatarDataUrl = await readFileAsDataUrl(payload.avatarFile);
      }
      await api("/api/students", { method: "POST", body });
      setActiveModal(null);
      return "Ученик добавлен.";
    });
  }

  async function handleStudentUpdate(
    studentId: string,
    payload: { fullName: string; avatarFile: File | null; removeAvatar: boolean }
  ) {
    await withRefresh(async () => {
      const body: Record<string, unknown> = { fullName: payload.fullName.trim() };
      if (payload.removeAvatar) {
        body.avatarDataUrl = null;
      } else if (payload.avatarFile) {
        body.avatarDataUrl = await readFileAsDataUrl(payload.avatarFile);
      }
      await api(`/api/students/${studentId}`, { method: "PATCH", body });
      setEditingStudent(null);
      return "Данные ученика обновлены.";
    });
  }

  async function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const studentIds = new FormData(form).getAll("studentIds").map(String);
    if (!studentIds.length) {
      toast.error("Выберите хотя бы одного ученика.");
      return;
    }
    const lessonType = studentIds.length > 1 ? "group" : "individual";
    const repeatWeekly = data.repeatWeekly === "on";
    const payload = {
      startsAt: String(data.startsAt),
      studentIds,
      lessonType,
      durationMinutes: lessonDurationByType[lessonType],
      repeatWeekly
    };

    await withRefresh(async () => {
      await api("/api/lessons", {
        method: "POST",
        body: payload
      });
      form.reset();
      setLessonFormKey((key) => key + 1);
      setLessonDialogOpen(false);
      return repeatWeekly ? "Создано повторяющееся занятие." : "Занятие добавлено.";
    });
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const hasPackage = Boolean(data.packageId);

    if (!hasPackage) {
      if (!data.lessonCount || !data.amount) {
        toast.error("Укажите количество занятий и сумму.");
        return;
      }
    }

    if (!hasPackage) {
      delete data.packageId;
      data.lessonCount = Number(data.lessonCount);
      data.amount = Number(data.amount);
    } else {
      delete data.lessonCount;
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

  async function handleCurrencyChange(nextCurrency: CurrencyCode) {
    if (nextCurrency === currency) {
      return;
    }
    await withRefresh(async () => {
      await api<AppSettings>("/api/settings", {
        method: "PATCH",
        body: { currency: nextCurrency }
      });
      return "Валюта обновлена.";
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
    if (lesson.recurringScheduleId) {
      setDeleteLessonTarget(lesson);
      return;
    }

    if (!window.confirm(`Удалить занятие ${formatFullDate(lesson.startsAt)}?`)) {
      return;
    }

    await deleteLessonWithScope(lesson, "single");
  }

  async function deleteLessonWithScope(lesson: Lesson, scope: RecurringDeleteScope) {
    const messages: Record<RecurringDeleteScope, string> = {
      single: "Занятие удалено.",
      following: "Это и последующие занятия удалены.",
      all: "Вся серия занятий удалена."
    };

    await withRefresh(async () => {
      await api(`/api/lessons/${lesson.id}?scope=${scope}`, { method: "DELETE" });
      return messages[scope];
    });
    setDeleteLessonTarget(null);
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

  function openLessonDialog() {
    setActiveSection("schedule");
    setLessonDialogOpen(true);
  }

  const activeTitle: Record<ActiveSection, string> = {
    schedule: "Расписание",
    clients: "Ученики",
    payments: "Оплаты",
    sessions: "Пакеты занятий",
    settings: "Настройки"
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
              <SidebarMenuButton
                tooltip="Настройки"
                isActive={activeSection === "settings"}
                onClick={() => setActiveSection("settings")}
              >
                <Settings className="size-4" />
                <span>Настройки</span>
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
          <div className="flex h-9 items-center gap-3">
            <SidebarTrigger className="-ml-2" />
            <h1 className="text-lg leading-none font-bold text-stone-900">{activeTitle[activeSection]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={openLessonDialog}>
              Запланировать занятие
            </Button>
          </div>
        </header>

        {activeSection === "schedule" ? (
        <section className="p-6 px-10 pb-10" id="schedule">
          <div className="min-w-0">
            <div className="mb-3 flex h-12 items-center justify-between gap-3">
              <ToggleGroup
                type="single"
                value={scheduleView}
                onValueChange={(value) => {
                  if (value) {
                    setScheduleView(value as ScheduleView);
                  }
                }}
                variant="outline"
                size="sm"
                spacing={0}
              >
                {(["day", "week", "month"] as const).map((view) => (
                  <ToggleGroupItem key={view} value={view} aria-label={scheduleViewLabels[view]}>
                    {scheduleViewLabels[view]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

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
                <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" type="button" aria-label="Создать занятие">
                      <Plus className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Создать занятие</DialogTitle>
                    </DialogHeader>
                    <LessonForm
                      key={lessonFormKey}
                      students={students}
                      defaultStartsAt={getDefaultLessonStartsAt(selectedDate)}
                      onSubmit={handleLessonSubmit}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {scheduleView === "day" ? (
              <DayCalendar
                day={selectedDate}
                calendarRange={dayCalendarRange}
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
                calendarRange={weekCalendarRange}
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
        </section>
        ) : null}

        {activeSection === "clients" ? (
          <ClientsView
            students={students}
            getBalance={getBalance}
            onAddStudent={() => {
              setStudentFormKey((key) => key + 1);
              setActiveModal("student");
            }}
            onEditStudent={setEditingStudent}
            onDeleteStudent={handleDeleteStudent}
            onAction={(action) => withRefresh(action)}
          />
        ) : null}

        {activeSection === "payments" ? (
          <PaymentsView
            payments={payments}
            currency={currency}
            getStudent={getStudent}
            onAddPayment={() => {
              setPaymentFormKey((key) => key + 1);
              setActiveModal("payment");
            }}
          />
        ) : null}

        {activeSection === "sessions" ? (
          <SessionsView
            lessonPackages={lessonPackages}
            currency={currency}
            onAddPackage={() => setActiveModal("package")}
            onDeletePackage={handleDeletePackage}
          />
        ) : null}

        {activeSection === "settings" ? (
          <SettingsView currency={currency} onCurrencyChange={handleCurrencyChange} />
        ) : null}
      </SidebarInset>

      <Modal open={activeModal === "student"} title="Добавить ученика" onClose={() => setActiveModal(null)}>
        <StudentForm key={studentFormKey} submitLabel="Добавить ученика" onSubmit={handleStudentCreate} />
      </Modal>

      <Modal open={!!editingStudent} title="Редактировать ученика" onClose={() => setEditingStudent(null)}>
        {editingStudent ? (
          <StudentForm
            key={editingStudent.id}
            student={editingStudent}
            submitLabel="Сохранить"
            onSubmit={(payload) => handleStudentUpdate(editingStudent.id, payload)}
          />
        ) : null}
      </Modal>

      <Modal open={activeModal === "payment"} title="Добавить оплату" onClose={() => setActiveModal(null)}>
        <PaymentForm
          key={paymentFormKey}
          students={students}
          lessonPackages={lessonPackages}
          currency={currency}
          onSubmit={handlePaymentSubmit}
        />
      </Modal>

      <Modal open={activeModal === "package"} title="Добавить пакет" onClose={() => setActiveModal(null)}>
        <PackageForm currency={currency} onSubmit={handlePackageSubmit} />
      </Modal>

      <Dialog open={!!deleteLessonTarget} onOpenChange={(open) => !open && setDeleteLessonTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить повторяющееся занятие</DialogTitle>
            <DialogDescription>
              {deleteLessonTarget ? formatFullDate(deleteLessonTarget.startsAt) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteLessonTarget && void deleteLessonWithScope(deleteLessonTarget, "single")}
            >
              Только это занятие
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteLessonTarget && void deleteLessonWithScope(deleteLessonTarget, "following")}
            >
              Это и все последующие
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteLessonTarget && void deleteLessonWithScope(deleteLessonTarget, "all")}
            >
              Все занятия серии
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDeleteLessonTarget(null)}>
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
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
  onEditStudent,
  onDeleteStudent,
  onAction
}: {
  students: Student[];
  getBalance: (studentId: string) => StudentBalance;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
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
        </CardHeader>
        <CardContent className="grid gap-3">
          {students.map((student) => {
            const balance = getBalance(student.id);
            const telegramBindUrl = getTelegramBindUrl(student);
            const telegramBindCopied = copiedTelegramStudentId === student.id;
            const canSendPaymentReminder =
              Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
            return (
              <Card key={student.id}>
                <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_160px_220px] items-center gap-4 p-4">
                <StudentAvatar student={student} size="lg" />
                <div>
                  <h3 className="font-semibold text-stone-900">{student.fullName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {student.telegramChatId
                      ? student.telegramUsername
                        ? `@${student.telegramUsername}`
                        : "Telegram подключен"
                      : "Telegram не подключен"}
                  </p>
                  {!student.telegramChatId ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {telegramBindUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => void copyTelegramBindText(student.id, telegramBindUrl)}
                        >
                          Скопировать ссылку Telegram
                        </Button>
                      ) : (
                        <Badge variant="secondary">Укажите Telegram bot username</Badge>
                      )}
                      {telegramBindCopied ? (
                        <Badge variant="secondary" aria-live="polite">
                          Скопировано
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{balance.remainingLessons} осталось</p>
                  <p>{balance.chargedLessons} использовано</p>
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
                  <Button variant="ghost" size="icon" type="button" onClick={() => onEditStudent(student)} aria-label={`Редактировать ${student.fullName}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" type="button" onClick={() => onDeleteStudent(student)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function PaymentsView({
  payments,
  currency,
  getStudent,
  onAddPayment
}: {
  payments: Snapshot["payments"];
  currency: CurrencyCode;
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ученик</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Занятий</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const student = getStudent(payment.studentId);
                return (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {student ? <StudentAvatar student={student} size="sm" /> : null}
                      <span>{student?.fullName ?? "Ученик удален"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatFullDate(payment.paidAt)}</TableCell>
                  <TableCell>{payment.lessonCount}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(payment.amount, currency)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function SessionsView({
  lessonPackages,
  currency,
  onAddPackage,
  onDeletePackage
}: {
  lessonPackages: LessonPackage[];
  currency: CurrencyCode;
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
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lessonPackages.map((lessonPackage) => {
            const unitPrice = Math.round(lessonPackage.price / lessonPackage.lessonCount);

            return (
              <div
                key={lessonPackage.id}
                className="flex items-center justify-between gap-4 rounded-3xl border-2 border-primary p-4"
              >
                <p className="text-lg font-medium">{lessonPackage.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-xl font-bold text-primary">
                      {formatMoney(lessonPackage.price, currency)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatMoney(unitPrice, currency)}/занятие
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="text-muted-foreground"
                    onClick={() => onDeletePackage(lessonPackage)}
                    aria-label={`Удалить пакет ${lessonPackage.name}`}
                  >
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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function StudentForm({
  student,
  submitLabel,
  onSubmit
}: {
  student?: Student;
  submitLabel: string;
  onSubmit: (payload: { fullName: string; avatarFile: File | null; removeAvatar: boolean }) => void | Promise<void>;
}) {
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
      toast.error("Укажите ФИО.");
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
          <FieldLabel htmlFor="student-full-name">ФИО</FieldLabel>
          <Input
            id="student-full-name"
            name="fullName"
            placeholder="ФИО"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <Button type="submit">{submitLabel}</Button>
      </FieldGroup>
    </form>
  );
}

function LessonForm({
  students,
  defaultStartsAt,
  onSubmit
}: {
  students: Student[];
  defaultStartsAt: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeStudents = students.filter((student) => student.status === "active");

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="lesson-starts-at">Дата и время</FieldLabel>
          <DateTimePicker id="lesson-starts-at" name="startsAt" defaultValue={defaultStartsAt} required />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Ученики</FieldLegend>
          <FieldGroup data-slot="checkbox-group" className="max-h-48 overflow-y-auto rounded-lg border p-2">
            {activeStudents.map((student) => (
              <Field key={student.id} orientation="horizontal" className="rounded-md px-2 py-1.5 hover:bg-muted/60">
                <Checkbox id={`lesson-student-${student.id}`} name="studentIds" value={student.id} />
                <FieldLabel htmlFor={`lesson-student-${student.id}`} className="flex items-center gap-2 font-normal">
                  <StudentAvatar student={student} size="sm" />
                  {student.fullName}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
        </FieldSet>

        <Field orientation="horizontal">
          <Checkbox id="lesson-repeat-weekly" name="repeatWeekly" />
          <FieldContent>
            <FieldLabel htmlFor="lesson-repeat-weekly">Повторять еженедельно</FieldLabel>
          </FieldContent>
        </Field>

        <Button type="submit" disabled={!activeStudents.length}>
          Добавить в календарь
        </Button>
      </FieldGroup>
    </form>
  );
}

function SettingsView({
  currency,
  onCurrencyChange
}: {
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
}) {
  return (
    <section className="p-6 px-10 pb-10" id="settings">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Общие параметры приложения.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-currency">Валюта</FieldLabel>
              <Select value={currency} onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}>
                <SelectTrigger id="settings-currency" className="w-full">
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CURRENCIES.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.label} ({item.code})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Суммы в оплатах и пакетах отображаются в выбранной валюте. По умолчанию — белорусский рубль.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </section>
  );
}

function PaymentForm({
  students,
  lessonPackages,
  currency,
  onSubmit
}: {
  students: Student[];
  lessonPackages: LessonPackage[];
  currency: CurrencyCode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const selectedPackage = lessonPackages.find((item) => item.id === selectedPackageId);

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="payment-student-id">Ученик</FieldLabel>
          <NativeSelect id="payment-student-id" name="studentId" required defaultValue="" className="w-full">
            <NativeSelectOption value="">Ученик</NativeSelectOption>
            {students
              .filter((student) => student.status === "active")
              .map((student) => (
                <NativeSelectOption key={student.id} value={student.id}>
                  {student.fullName}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="payment-package-id">Пакет</FieldLabel>
          <NativeSelect
            id="payment-package-id"
            name="packageId"
            value={selectedPackageId}
            onChange={(event) => setSelectedPackageId(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Без пакета</NativeSelectOption>
            {lessonPackages
              .filter((item) => item.active)
              .map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}: {item.lessonCount} / {formatMoney(item.price, currency)}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {selectedPackage ? (
            <FieldDescription>
              {selectedPackage.lessonCount} занятий · {formatMoney(selectedPackage.price, currency)}
            </FieldDescription>
          ) : null}
        </Field>
        {!selectedPackageId ? (
          <FieldGroup className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="payment-lesson-count">Занятий</FieldLabel>
              <Input id="payment-lesson-count" name="lessonCount" type="number" min="1" placeholder="Занятий" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">Сумма</FieldLabel>
              <CurrencyInput id="payment-amount" name="amount" currency={currency} placeholder="0" required />
            </Field>
          </FieldGroup>
        ) : null}
        <Field>
          <FieldLabel htmlFor="payment-method">Способ оплаты</FieldLabel>
          <NativeSelect id="payment-method" name="method" required defaultValue="transfer" className="w-full">
            <NativeSelectOption value="transfer">Перевод</NativeSelectOption>
            <NativeSelectOption value="cash">Наличные</NativeSelectOption>
            <NativeSelectOption value="other">Другое</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit">Добавить оплату</Button>
      </FieldGroup>
    </form>
  );
}

function PackageForm({
  currency,
  onSubmit
}: {
  currency: CurrencyCode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="package-name">Название пакета</FieldLabel>
          <Input id="package-name" name="name" placeholder="Название пакета" required />
        </Field>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="package-lesson-count">Занятий</FieldLabel>
            <Input id="package-lesson-count" name="lessonCount" type="number" min="1" placeholder="Занятий" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="package-price">Цена</FieldLabel>
            <CurrencyInput id="package-price" name="price" currency={currency} placeholder="0" required />
          </Field>
        </FieldGroup>
        <Button type="submit">Добавить пакет</Button>
      </FieldGroup>
    </form>
  );
}

function DayCalendar({
  day,
  calendarRange,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  calendarRange: CalendarRange;
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
      <TimeAxis calendarRange={calendarRange} />
      <DayColumn
        day={day}
        calendarRange={calendarRange}
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
  calendarRange,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  weekDays: Date[];
  calendarRange: CalendarRange;
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
      <TimeAxis calendarRange={calendarRange} />
      {weekDays.map((day) => (
        <DayColumn
          key={day.toISOString()}
          day={day}
          calendarRange={calendarRange}
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

function TimeAxis({ calendarRange }: { calendarRange: CalendarRange }) {
  return (
    <div className="col-start-1 row-start-2">
      {calendarRange.hours.map((hour) => (
        <div className="h-[76px] pt-1 text-xs font-bold text-stone-400" key={hour}>
          {formatHour(hour)}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  day,
  calendarRange,
  currentTime,
  lessons,
  getStudent,
  onAction,
  onDeleteLesson
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDeleteLesson: (lesson: Lesson) => void;
}) {
  const isToday = currentTime ? sameDate(day, currentTime) : false;
  const currentTimeOffset = currentTime && isToday ? getCurrentTimeOffset(currentTime, calendarRange) : null;
  const columnHeight = calendarRange.hours.length * hourHeight;

  return (
    <div
      className={cn("relative border-l border-stone-100", isToday && "bg-teal-50/40")}
      style={{
        minHeight: columnHeight,
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
            calendarRange={calendarRange}
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
                  <Button
                    key={lesson.id}
                    type="button"
                    size="sm"
                    className={cn(
                      "h-auto justify-start gap-2 rounded-md px-2 py-1 text-left text-[0.68rem] font-semibold text-white",
                      lesson.effectiveType === "group" ? "bg-teal-700" : "bg-teal-600"
                    )}
                    onClick={() => onDeleteLesson(lesson)}
                    title="Нажмите, чтобы удалить занятие"
                  >
                    {student ? <StudentAvatar student={student} size="sm" className="size-5 ring-1 ring-white/30" /> : null}
                    <span className="truncate">
                      {formatTime(new Date(lesson.startsAt))} {student?.fullName ?? "Занятие"}
                    </span>
                  </Button>
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
  calendarRange,
  getStudent,
  onAction,
  onDelete
}: {
  lesson: Lesson;
  calendarRange: CalendarRange;
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
  onDelete: () => void;
}) {
  const date = new Date(lesson.startsAt);
  const startsAtMinutes = date.getHours() * 60 + date.getMinutes();
  const top = Math.max(0, ((startsAtMinutes - calendarRange.startHour * 60) / 60) * hourHeight);
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
      <div className="flex items-center gap-2">
        {primaryStudent ? <StudentAvatar student={primaryStudent} size="sm" className="ring-2 ring-white/30" /> : null}
        <strong className="text-xs leading-tight">{primaryStudent?.fullName ?? "Занятие"}</strong>
      </div>
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Не удалось прочитать файл."));
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
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

function getDefaultLessonStartsAt(date: Date): string {
  return formatDateTimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0));
}

function formatDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function getCalendarRange(lessons: Lesson[], currentTime?: Date): CalendarRange {
  const lessonStartHours = lessons.map((lesson) => new Date(lesson.startsAt).getHours());
  const lessonEndHours = lessons.map((lesson) => {
    const startsAt = new Date(lesson.startsAt);
    const endMinutes = startsAt.getHours() * 60 + startsAt.getMinutes() + lesson.durationMinutes;
    return Math.ceil(endMinutes / 60);
  });
  const currentHour = currentTime?.getHours();
  const startHour = clamp(Math.min(defaultCalendarStartHour, ...lessonStartHours, currentHour ?? defaultCalendarStartHour), 0, 23);
  const endHour = clamp(
    Math.max(defaultCalendarEndHour, ...lessonEndHours, currentHour !== undefined ? currentHour + 1 : defaultCalendarEndHour),
    startHour + 1,
    24
  );

  return {
    startHour,
    endHour,
    hours: Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  };
}

function getCurrentTimeOffset(value: Date, calendarRange: CalendarRange): number | null {
  const currentMinutes = value.getHours() * 60 + value.getMinutes();
  const calendarStartMinutes = calendarRange.startHour * 60;
  const calendarEndMinutes = calendarRange.endHour * 60;

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
