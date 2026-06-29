"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Plus,
  Pencil,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/date-time-picker";
import { CurrencyInput } from "@/components/examples/input/special/currency-input";
import { LessonOverviewSheet } from "@/components/lesson-overview-sheet";
import { LessonParticipantSummary } from "@/components/lesson-participant-summary";
import { ParticipantCardAvatar, ParticipantCardLabel } from "@/components/participant-card-label";
import { StudentCombobox } from "@/components/student-combobox";
import { StudentMultiCombobox } from "@/components/student-multi-combobox";
import { StudentForm } from "@/components/student-form";
import { TelegramIcon } from "@/components/icons/telegram-icon";
import { StudentLink } from "@/components/student-link";
import { StudentAvatar } from "@/components/student-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { readFileAsDataUrl } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n/context";
import {
  formatDateTime,
  formatDay,
  formatFullDate,
  formatMonth,
  formatTime,
  formatWeekRange,
  formatWeekday
} from "@/i18n/format";
import { getPaymentMethodLabel, getWeekdayShortLabels } from "@/i18n/labels";
import type {
  AppSettings,
  Database,
  Lesson,
  LessonPackage,
  RecurringDeleteScope,
  RecurringSchedule,
  Student,
  StudentBalance
} from "@crm/shared";
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

type ActiveSection = "schedule" | "clients" | "payments" | "sessions" | "settings";
type ScheduleView = "day" | "week" | "month";
type ActiveModal = "student" | "payment" | "package" | null;

const defaultCalendarStartHour = 9;
const defaultCalendarEndHour = 22;
const hourHeight = 76;
const pageHeaderClass =
  "flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5 lg:px-10";
const pageSectionClass = "px-3 py-3 pb-6 sm:p-6 sm:pb-10 lg:px-10";
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
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const hasMobileScheduleDefault = useRef(false);
  const scheduleViewLabels: Record<ScheduleView, string> = {
    day: t("calendar.view.day"),
    week: t("calendar.view.week"),
    month: t("calendar.view.month")
  };
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
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (isMobile && !hasMobileScheduleDefault.current) {
      hasMobileScheduleDefault.current = true;
      setScheduleView("day");
    }
  }, [isMobile]);

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
  const recurringSchedules = snapshot?.recurringSchedules ?? [];
  const selectedLesson = useMemo(
    () => (selectedLessonId ? lessons.find((lesson) => lesson.id === selectedLessonId) ?? null : null),
    [lessons, selectedLessonId]
  );
  const selectedRecurringSchedule = useMemo(
    () =>
      selectedLesson?.recurringScheduleId
        ? recurringSchedules.find((schedule) => schedule.id === selectedLesson.recurringScheduleId)
        : undefined,
    [recurringSchedules, selectedLesson]
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
    if (selectedLessonId && !selectedLesson) {
      setSelectedLessonId(null);
    }
  }, [selectedLessonId, selectedLesson]);

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
      toast.error(error instanceof Error ? error.message : t("toast.loadFailed"));
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
      toast.error(error instanceof Error ? error.message : t("toast.actionFailed"));
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
      return t("toast.studentAdded");
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
      return t("toast.studentUpdated");
    });
  }

  async function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const studentIds = new FormData(form).getAll("studentIds").map(String);
    if (!studentIds.length) {
      toast.error(t("toast.selectAtLeastOneStudent"));
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
      return repeatWeekly ? t("toast.recurringLessonCreated") : t("toast.lessonAdded");
    });
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const hasPackage = Boolean(data.packageId);

    if (!hasPackage) {
      if (!data.lessonCount || !data.amount) {
        toast.error(t("toast.enterLessonCountAndAmount"));
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
      return t("toast.paymentAdded");
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
      return t("toast.packageAdded");
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
      return t("toast.currencyUpdated");
    });
  }

  async function handleDeleteStudent(student: Student) {
    if (!window.confirm(t("confirm.deleteStudent", { name: student.fullName }))) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/students/${student.id}`, { method: "DELETE" });
      return t("toast.studentDeleted");
    });
  }

  function openLessonOverview(lesson: Lesson) {
    setSelectedLessonId(lesson.id);
  }

  async function handleRemoveParticipant(lessonId: string, studentId: string, studentName: string) {
    if (!window.confirm(t("confirm.removeParticipant", { name: studentName }))) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/lessons/${lessonId}/participants/${studentId}`, { method: "DELETE" });
      return t("toast.participantRemoved", { name: studentName });
    });
  }

  async function handleDeleteLessonFromSheet(lesson: Lesson, scope: RecurringDeleteScope) {
    if (!lesson.recurringScheduleId) {
      if (!window.confirm(t("confirm.deleteLesson", { date: formatFullDate(lesson.startsAt) }))) {
        return;
      }
    }

    await deleteLessonWithScope(lesson, scope);
    setSelectedLessonId(null);
  }

  async function deleteLessonWithScope(lesson: Lesson, scope: RecurringDeleteScope) {
    const messages: Record<RecurringDeleteScope, string> = {
      single: t("toast.lessonDeletedSingle"),
      following: t("toast.lessonDeletedFollowing"),
      all: t("toast.lessonDeletedAll")
    };

    await withRefresh(async () => {
      await api(`/api/lessons/${lesson.id}?scope=${scope}`, { method: "DELETE" });
      return messages[scope];
    });
  }

  async function handleDeletePackage(lessonPackage: LessonPackage) {
    if (!window.confirm(t("confirm.deletePackage", { name: lessonPackage.name }))) {
      return;
    }

    await withRefresh(async () => {
      await api(`/api/lesson-packages/${lessonPackage.id}`, { method: "DELETE" });
      return t("toast.packageDeleted");
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
    schedule: t("section.schedule"),
    clients: t("section.students"),
    payments: t("section.payments"),
    sessions: t("section.packages"),
    settings: t("section.settings")
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
              <SidebarMenu aria-label={t("nav.mainAria")}>
                <SidebarLink
                  icon={<CreditCard className="size-4" />}
                  active={activeSection === "payments"}
                  onClick={() => setActiveSection("payments")}
                >
                  {t("nav.payments")}
                </SidebarLink>
                <SidebarLink
                  icon={<Users className="size-4" />}
                  active={activeSection === "clients"}
                  onClick={() => setActiveSection("clients")}
                >
                  {t("nav.students")}
                </SidebarLink>
                <SidebarLink
                  icon={<CalendarDays className="size-4" />}
                  active={activeSection === "schedule"}
                  onClick={() => setActiveSection("schedule")}
                >
                  {t("nav.schedule")}
                </SidebarLink>
                <SidebarLink
                  icon={<GraduationCap className="size-4" />}
                  active={activeSection === "sessions"}
                  onClick={() => setActiveSection("sessions")}
                >
                  {t("nav.packages")}
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("nav.settings")}
                isActive={activeSection === "settings"}
                onClick={() => setActiveSection("settings")}
              >
                <Settings className="size-4" />
                <span>{t("nav.settings")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-white">
        <header className={pageHeaderClass}>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarTrigger className="-ml-2 shrink-0" />
            <h1 className="truncate text-base font-bold text-stone-900 sm:text-lg">{activeTitle[activeSection]}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button type="button" size="icon" className="sm:hidden" onClick={openLessonDialog} aria-label={t("calendar.scheduleLesson")}>
              <Plus className="size-4" />
            </Button>
            <Button type="button" className="hidden sm:inline-flex" onClick={openLessonDialog}>
              {t("calendar.scheduleLesson")}
            </Button>
          </div>
        </header>

        {activeSection === "schedule" ? (
        <section className={pageSectionClass} id="schedule">
          <div className="min-w-0">
            <div className="mb-3 flex flex-col gap-3 sm:h-12 sm:flex-row sm:items-center sm:justify-between">
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
                className="w-full sm:w-auto"
              >
                {(["day", "week", "month"] as const).map((view) => (
                  <ToggleGroupItem key={view} value={view} aria-label={scheduleViewLabels[view]} className="flex-1 sm:flex-none">
                    {scheduleViewLabels[view]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="text-center text-xs font-extrabold uppercase tracking-wide text-stone-400 sm:min-w-52">
                {scheduleView === "day" ? formatFullDate(selectedDate.toISOString()) : null}
                {scheduleView === "week" ? formatWeekRange(weekDays) : null}
                {scheduleView === "month" ? formatMonth(selectedDate) : null}
              </div>
              
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <Button variant="secondary" size="icon" type="button" onClick={() => shiftCalendar(-1)} aria-label={t("calendar.prevPeriod")}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={goToToday}>
                  {t("calendar.today")}
                </Button>
                <Button variant="secondary" size="icon" type="button" onClick={() => shiftCalendar(1)} aria-label={t("calendar.nextPeriod")}>
                  <ChevronRight className="size-4" />
                </Button>
                <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" type="button" aria-label={t("calendar.createLesson")}>
                      <Plus className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t("calendar.createLessonTitle")}</DialogTitle>
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
              <CalendarScrollArea>
                <DayCalendar
                  day={selectedDate}
                  calendarRange={dayCalendarRange}
                  currentTime={currentTime}
                  lessons={dayLessons}
                  getStudent={getStudent}
                  onSelectLesson={openLessonOverview}
                />
              </CalendarScrollArea>
            ) : null}

            {scheduleView === "week" ? (
              <CalendarScrollArea minWidth={664}>
                <WeekCalendar
                  weekDays={weekDays}
                  calendarRange={weekCalendarRange}
                  currentTime={currentTime}
                  lessons={weekLessons}
                  getStudent={getStudent}
                  onSelectLesson={openLessonOverview}
                />
              </CalendarScrollArea>
            ) : null}

            {scheduleView === "month" ? (
                <MonthCalendar
                  selectedDate={selectedDate}
                  monthDays={monthDays}
                  currentTime={currentTime}
                  lessons={monthLessons}
                  getStudent={getStudent}
                  onSelectLesson={openLessonOverview}
                />
            ) : null}
          </div>
        </section>
        ) : null}

        {activeSection === "clients" ? (
          <ClientsView
            students={students}
            onAddStudent={() => {
              setStudentFormKey((key) => key + 1);
              setActiveModal("student");
            }}
            onEditStudent={setEditingStudent}
            onDeleteStudent={handleDeleteStudent}
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

      <Modal open={activeModal === "student"} title={t("modal.addStudent")} onClose={() => setActiveModal(null)}>
        <StudentForm key={studentFormKey} submitLabel={t("form.addStudent")} onSubmit={handleStudentCreate} />
      </Modal>

      <Modal open={!!editingStudent} title={t("modal.editStudent")} onClose={() => setEditingStudent(null)}>
        {editingStudent ? (
          <StudentForm
            key={editingStudent.id}
            student={editingStudent}
            submitLabel={t("form.save")}
            onSubmit={(payload) => handleStudentUpdate(editingStudent.id, payload)}
          />
        ) : null}
      </Modal>

      <Modal open={activeModal === "payment"} title={t("modal.addPayment")} onClose={() => setActiveModal(null)}>
        <PaymentForm
          key={paymentFormKey}
          students={students}
          lessonPackages={lessonPackages}
          currency={currency}
          onSubmit={handlePaymentSubmit}
        />
      </Modal>

      <Modal open={activeModal === "package"} title={t("modal.addPackage")} onClose={() => setActiveModal(null)}>
        <PackageForm currency={currency} onSubmit={handlePackageSubmit} />
      </Modal>

      <LessonOverviewSheet
        lesson={selectedLesson}
        open={!!selectedLesson}
        recurringSchedule={selectedRecurringSchedule}
        getStudent={getStudent}
        onOpenChange={(open) => !open && setSelectedLessonId(null)}
        onRemoveParticipant={handleRemoveParticipant}
        onDeleteLesson={handleDeleteLessonFromSheet}
      />

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
            <Button size="icon-sm" type="button" onClick={onAddStudent} aria-label={t("clients.addStudentAria")}>
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
  const { t } = useI18n();

  return (
    <section className={pageSectionClass}>
      <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t("payments.title")} <Badge variant="secondary">{payments.length}</Badge>
            <Button size="icon-sm" type="button" onClick={onAddPayment} aria-label={t("payments.addPaymentAria")}>
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-3 sm:px-4">
          {payments.map((payment) => {
            const student = getStudent(payment.studentId);

            return (
              <div
                key={payment.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5"
              >
                {student ? (
                  <StudentLink studentId={student.id} className="shrink-0">
                    <StudentAvatar student={student} size="sm" />
                  </StudentLink>
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    ?
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900 sm:text-base">
                    {student ? (
                      <StudentLink studentId={student.id}>{student.fullName}</StudentLink>
                    ) : (
                      t("payments.studentDeleted")
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    <span className="sm:hidden">{formatDateTime(payment.paidAt)}</span>
                    <span className="hidden sm:inline">{formatFullDate(payment.paidAt)}</span>
                    {" · "}
                    {t("common.lessonsCount", { count: payment.lessonCount })}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold sm:text-base">
                  {formatMoney(payment.amount, currency)}
                </p>
              </div>
            );
          })}
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
  const { t } = useI18n();

  return (
    <section className={pageSectionClass}>
      <Card size="sm" className="gap-2 py-3 sm:gap-4 sm:py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t("section.packages")} <Badge variant="secondary">{lessonPackages.length}</Badge>
            <Button size="icon-sm" type="button" onClick={onAddPackage} aria-label={t("packages.addPackageAria")}>
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-3 sm:px-4">
          {lessonPackages.map((lessonPackage) => {
            const unitPrice = Math.round(lessonPackage.price / lessonPackage.lessonCount);

            return (
              <div
                key={lessonPackage.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg border border-primary px-2.5 py-2 sm:gap-3 sm:rounded-2xl sm:border-2 sm:px-3 sm:py-2.5"
              >
                <p className="truncate text-sm font-medium sm:text-lg">{lessonPackage.name}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary sm:text-xl">{formatMoney(lessonPackage.price, currency)}</p>
                  <p className="text-[0.6875rem] text-muted-foreground sm:text-sm">
                    {formatMoney(unitPrice, currency)}
                    {t("packages.perLesson")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => onDeletePackage(lessonPackage)}
                  aria-label={t("packages.deletePackageAria", { name: lessonPackage.name })}
                >
                  <Trash2 className="size-3.5 sm:size-4" />
                </Button>
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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

        <Field orientation="horizontal">
          <Checkbox id="lesson-repeat-weekly" name="repeatWeekly" />
          <FieldContent>
            <FieldLabel htmlFor="lesson-repeat-weekly">{t("form.repeatWeekly")}</FieldLabel>
          </FieldContent>
        </Field>

        <Button type="submit" disabled={!activeStudents.length || !selectedStudentIds.length}>
          {t("form.addToCalendar")}
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
  const { t } = useI18n();

  return (
    <section className={pageSectionClass} id="settings">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("settings.title")}</CardTitle>
          <CardDescription>{t("settings.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-currency">{t("settings.currency")}</FieldLabel>
              <Select value={currency} onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}>
                <SelectTrigger id="settings-currency" className="w-full">
                  <SelectValue placeholder={t("settings.selectCurrency")} />
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
              <FieldDescription>{t("settings.currencyHint")}</FieldDescription>
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
  const { t } = useI18n();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const selectedPackage = lessonPackages.find((item) => item.id === selectedPackageId);
  const activeStudents = students.filter((student) => student.status === "active");

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (!selectedStudentId) {
      event.preventDefault();
      toast.error(t("toast.selectStudent"));
      return;
    }
    onSubmit(event);
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="payment-student-id">{t("form.student")}</FieldLabel>
          <StudentCombobox
            id="payment-student-id"
            name="studentId"
            students={activeStudents}
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            placeholder={t("form.selectStudent")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="payment-package-id">{t("form.package")}</FieldLabel>
          <NativeSelect
            id="payment-package-id"
            name="packageId"
            value={selectedPackageId}
            onChange={(event) => setSelectedPackageId(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">{t("form.noPackage")}</NativeSelectOption>
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
              {t("packages.summary", {
                count: selectedPackage.lessonCount,
                price: formatMoney(selectedPackage.price, currency)
              })}
            </FieldDescription>
          ) : null}
        </Field>
        {!selectedPackageId ? (
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment-lesson-count">{t("form.lessonCount")}</FieldLabel>
              <Input id="payment-lesson-count" name="lessonCount" type="number" min="1" placeholder={t("form.lessonCount")} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">{t("form.amount")}</FieldLabel>
              <CurrencyInput id="payment-amount" name="amount" currency={currency} placeholder="0" required />
            </Field>
          </FieldGroup>
        ) : null}
        <Field>
          <FieldLabel htmlFor="payment-method">{t("form.paymentMethod")}</FieldLabel>
          <NativeSelect id="payment-method" name="method" required defaultValue="transfer" className="w-full">
            <NativeSelectOption value="transfer">{getPaymentMethodLabel("transfer")}</NativeSelectOption>
            <NativeSelectOption value="cash">{getPaymentMethodLabel("cash")}</NativeSelectOption>
            <NativeSelectOption value="other">{getPaymentMethodLabel("other")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit">{t("form.addPayment")}</Button>
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
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="package-name">{t("form.packageName")}</FieldLabel>
          <Input id="package-name" name="name" placeholder={t("form.packageName")} required />
        </Field>
        <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="package-lesson-count">{t("form.lessonCount")}</FieldLabel>
            <Input id="package-lesson-count" name="lessonCount" type="number" min="1" placeholder={t("form.lessonCount")} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="package-price">{t("form.price")}</FieldLabel>
            <CurrencyInput id="package-price" name="price" currency={currency} placeholder="0" required />
          </Field>
        </FieldGroup>
        <Button type="submit">{t("form.addPackage")}</Button>
      </FieldGroup>
    </form>
  );
}

function CalendarScrollArea({ children, minWidth }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div style={minWidth ? { minWidth } : undefined}>{children}</div>
    </div>
  );
}

function DayCalendar({
  day,
  calendarRange,
  currentTime,
  lessons,
  getStudent,
  onSelectLesson
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const isToday = currentTime ? sameDate(day, currentTime) : false;

  return (
    <div className="grid min-h-[680px] grid-cols-[62px_minmax(240px,1fr)] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      <div className={cn("grid justify-items-center border-b border-stone-300 pt-2", isToday && "bg-primary/5 dark:bg-primary/10")}>
        <strong className="text-xs uppercase text-stone-900">{formatWeekday(day)}</strong>
        <span
          className={cn(
            "flex items-center justify-center text-[0.68rem] font-bold",
            isToday ? "size-6 rounded-full bg-primary text-primary-foreground" : "text-stone-400"
          )}
        >
          {day.getDate()}
        </span>
      </div>
      <TimeAxis calendarRange={calendarRange} />
      <DayColumn
        day={day}
        calendarRange={calendarRange}
        currentTime={currentTime}
        lessons={lessons}
        getStudent={getStudent}
        onSelectLesson={onSelectLesson}
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
  onSelectLesson
}: {
  weekDays: Date[];
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const weekDayLabels = getWeekdayShortLabels("mon");

  return (
    <div className="grid min-h-[680px] grid-cols-[62px_repeat(7,minmax(86px,1fr))] grid-rows-[58px_auto]">
      <div className="border-b border-stone-300" />
      {weekDays.map((day, index) => {
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        return (
          <div
            className={cn(
              "grid justify-items-center border-b border-stone-300 pt-2",
              isToday && "bg-primary/5 dark:bg-primary/10"
            )}
            key={day.toISOString()}
          >
            <strong className="text-xs uppercase text-stone-900">{weekDayLabels[index]}</strong>
            <span
              className={cn(
                "flex items-center justify-center text-[0.68rem] font-bold",
                isToday ? "size-6 rounded-full bg-primary text-primary-foreground" : "text-stone-400"
              )}
            >
              {day.getDate()}
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
          onSelectLesson={onSelectLesson}
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
  onSelectLesson
}: {
  day: Date;
  calendarRange: CalendarRange;
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const isToday = currentTime ? sameDate(day, currentTime) : false;
  const currentTimeOffset = currentTime && isToday ? getCurrentTimeOffset(currentTime, calendarRange) : null;
  const columnHeight = calendarRange.hours.length * hourHeight;

  return (
    <div
      className={cn(
        "relative border-l border-stone-100",
        isToday && "bg-primary/5 dark:bg-primary/10"
      )}
      style={{
        minHeight: columnHeight,
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
      }}
    >
      {currentTimeOffset !== null ? <CurrentTimeMarker top={currentTimeOffset} /> : null}
      {lessons.map((lesson) => (
        <CalendarLesson
          key={lesson.id}
          lesson={lesson}
          calendarRange={calendarRange}
          getStudent={getStudent}
          onSelect={() => onSelectLesson(lesson)}
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
  onSelectLesson
}: {
  selectedDate: Date;
  monthDays: Date[];
  currentTime: Date | null;
  lessons: Lesson[];
  getStudent: (studentId: string) => Student | undefined;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const weekDayLabels = getWeekdayShortLabels("mon");
  const maxVisibleLessons = isMobile ? 2 : 4;

  return (
    <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] overflow-hidden rounded-xl border border-stone-200">
      {weekDayLabels.map((day) => (
        <div
          className="border-b border-stone-200 bg-stone-50 px-1 py-1 text-center text-[0.625rem] font-bold uppercase text-stone-500 sm:px-2 sm:py-2 sm:text-xs"
          key={day}
        >
          {day}
        </div>
      ))}
      {monthDays.map((day) => {
        const dayLessons = lessons.filter((lesson) => sameDate(new Date(lesson.startsAt), day));
        const isOutsideMonth = day.getMonth() !== selectedDate.getMonth();
        const isToday = currentTime ? sameDate(day, currentTime) : false;
        return (
          <div
            className={cn(
              "min-h-16 min-w-0 overflow-hidden border-b border-r border-stone-100 p-1 sm:min-h-28 sm:p-1.5 md:min-h-32 md:p-2",
              isToday && "ring-1 ring-inset ring-stone-200"
            )}
            key={day.toISOString()}
          >
            <div
              className={cn(
                "mb-1 inline-flex size-5 items-center justify-center rounded-full text-[0.625rem] font-bold sm:mb-2 sm:size-6 sm:text-xs",
                isToday ? "bg-stone-900 text-white" : isOutsideMonth ? "text-stone-300" : "text-stone-700"
              )}
            >
              {day.getDate()}
            </div>
            <div className="grid min-w-0 gap-0.5 sm:gap-1">
              {dayLessons.slice(0, maxVisibleLessons).map((lesson) => (
                <MonthLessonChip
                  key={lesson.id}
                  lesson={lesson}
                  compact={isMobile}
                  getStudent={getStudent}
                  onSelect={() => onSelectLesson(lesson)}
                />
              ))}
              {dayLessons.length > maxVisibleLessons ? (
                <span className="truncate text-[0.625rem] text-stone-400 sm:text-[0.68rem]">
                  {t("calendar.moreLessons", { count: dayLessons.length - maxVisibleLessons })}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getLessonPosition(lesson: Lesson, calendarRange: CalendarRange) {
  const startsAt = new Date(lesson.startsAt);
  const startsAtMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const top = ((startsAtMinutes - calendarRange.startHour * 60) / 60) * hourHeight;
  const height = (lesson.durationMinutes / 60) * hourHeight;

  return { top, height };
}

function formatTimeRange(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function CalendarLesson({
  lesson,
  calendarRange,
  getStudent,
  onSelect
}: {
  lesson: Lesson;
  calendarRange: CalendarRange;
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const startsAt = new Date(lesson.startsAt);
  const { top, height } = getLessonPosition(lesson, calendarRange);
  const compact = height < 52;

  return (
    <button
      type="button"
      className="absolute inset-x-1.5 z-10 flex cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border bg-card p-1.5 text-left shadow-sm transition-shadow hover:shadow-md"
      style={{ top, height }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="shrink-0 text-[0.68rem] font-semibold tabular-nums leading-tight">
          {formatTimeRange(startsAt, lesson.durationMinutes)}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact={compact} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1 pr-0.5">
        {lesson.participants.map((participant) => {
          const student = getStudent(participant.studentId);
          if (!student) {
            return null;
          }

          return (
            <div
              key={participant.id}
              className={cn("flex shrink-0 min-w-0 items-center gap-1.5", compact ? "min-h-6" : "min-h-7")}
            >
              <ParticipantCardAvatar student={student} status={participant.status} compact={compact} />
              <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
                <div className="min-w-0 flex-1">
                  <ParticipantCardLabel name={student.fullName} studentId={student.id} compact={compact} />
                </div>
                {participant.hasDebt ? (
                  <Badge
                    variant="destructive"
                    className={cn("shrink-0 px-1 py-0", compact ? "text-[0.5rem]" : "text-[0.55rem]")}
                  >
                    {t("badge.debt")}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function MonthLessonChip({
  lesson,
  compact,
  getStudent,
  onSelect
}: {
  lesson: Lesson;
  compact?: boolean;
  getStudent: (studentId: string) => Student | undefined;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const startsAt = new Date(lesson.startsAt);

  if (compact) {
    const firstStudent = lesson.participants
      .map((participant) => getStudent(participant.studentId))
      .find(Boolean);

    return (
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border bg-card px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
        onClick={onSelect}
      >
        <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums leading-none">
          {formatTime(startsAt)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.625rem] leading-none text-muted-foreground">
          {firstStudent?.fullName.split(/\s+/)[0] ?? t("calendar.lessonFallback")}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border bg-card px-2 py-1 text-left transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <span className="truncate text-[0.62rem] font-semibold tabular-nums leading-tight">
          {formatTimeRange(startsAt, lesson.durationMinutes)}
        </span>
        <LessonParticipantSummary participants={lesson.participants} compact />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 pb-1 pr-0.5">
        {lesson.participants.map((participant) => {
          const student = getStudent(participant.studentId);
          if (!student) {
            return null;
          }

          return (
            <div key={participant.id} className="flex min-h-6 min-w-0 shrink-0 items-center gap-1">
              <ParticipantCardAvatar student={student} status={participant.status} compact />
              <div className="min-w-0 flex-1">
                <ParticipantCardLabel name={student.fullName} studentId={student.id} compact />
              </div>
              {participant.hasDebt ? (
                <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[0.5rem]">
                  {t("badge.debt")}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>
    </button>
  );
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

function formatHour(hour: number): string {
  return `${hour}:00`;
}
