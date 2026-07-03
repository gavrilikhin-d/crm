"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LessonOverviewSheet } from "@/components/lesson-overview-sheet";
import { StudentForm } from "@/components/student-form";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSnapshotAutoRefresh } from "@/hooks/use-snapshot-auto-refresh";
import { useI18n } from "@/i18n/context";
import { formatFullDate } from "@/i18n/format";
import { api } from "@/lib/api";
import { readFileAsDataUrl } from "@/lib/files";
import { dedupeLessonsByOccurrence } from "@crm/shared/lesson-dedupe";
import type {
  AppSettings,
  Lesson,
  LessonPackage,
  RecurringDeleteScope,
  Student
} from "@crm/shared";
import { resolveCurrency, type CurrencyCode } from "@crm/shared/currency";
import { ClientsView } from "@/screens/clients";
import { DashboardSidebar } from "@/screens/dashboard/components/dashboard-sidebar";
import { MobileFab } from "@/screens/dashboard/components/mobile-fab";
import { Modal } from "@/screens/dashboard/components/modal";
import { lessonDurationByType, pageHeaderClass } from "@/screens/dashboard/constants";
import type { ActiveModal, ActiveSection, ScheduleView, Snapshot } from "@/screens/dashboard/types";
import { formData } from "@/screens/dashboard/utils/form-data";
import { PaymentsView } from "@/screens/payments";
import { PaymentForm } from "@/screens/payments/components/payment-form";
import { ScheduleScreen } from "@/screens/schedule";
import {
  addToDate,
  getCalendarRangeWithCurrentTime,
  getCalendarScrollAnchor,
  getMonthGridDays,
  getWeekDays,
  sameDate,
  startOfDay
} from "@/screens/schedule/utils/calendar";
import { SessionsView } from "@/screens/sessions";
import { PackageForm } from "@/screens/sessions/components/package-form";
import { SettingsView } from "@/screens/settings";

export default function Home() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const hasMobileScheduleDefault = useRef(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    if (typeof window === "undefined") {
      return "schedule";
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("section") === "settings" ? "settings" : "schedule";
  });
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [currentTime, setCurrentTime] = useState(() => new Date());
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

  const students = useMemo(() => snapshot?.students ?? [], [snapshot?.students]);
  const lessonPackages = snapshot?.lessonPackages ?? [];
  const lessons = useMemo(() => {
    return dedupeLessonsByOccurrence([...(snapshot?.lessons ?? [])]).sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [snapshot?.lessons]);
  const scheduleLessons = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.status !== "cancelled_by_teacher" && lesson.status !== "cancelled_by_student"
      ),
    [lessons]
  );
  const payments = useMemo(
    () =>
      [...(snapshot?.payments ?? [])].sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      ),
    [snapshot?.payments]
  );
  const currency = resolveCurrency(snapshot?.settings.currency);
  const recurringSchedules = useMemo(() => snapshot?.recurringSchedules ?? [], [snapshot?.recurringSchedules]);
  const vacationPeriods = useMemo(() => snapshot?.vacationPeriods ?? [], [snapshot?.vacationPeriods]);
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
  const availableStudentsForSelectedLesson = useMemo(() => {
    if (!selectedLesson) {
      return [];
    }

    const participantIds = new Set(selectedLesson.participants.map((participant) => participant.studentId));
    return students.filter((student) => student.status === "active" && !participantIds.has(student.id));
  }, [selectedLesson, students]);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthDays = useMemo(() => getMonthGridDays(selectedDate), [selectedDate]);
  const weekLessons = useMemo(
    () =>
      scheduleLessons.filter((lesson) => {
        const lessonDate = new Date(lesson.startsAt);
        return weekDays.some((day) => sameDate(day, lessonDate));
      }),
    [scheduleLessons, weekDays]
  );
  const dayLessons = useMemo(
    () => scheduleLessons.filter((lesson) => sameDate(new Date(lesson.startsAt), selectedDate)),
    [scheduleLessons, selectedDate]
  );
  const dayCalendarRange = useMemo(
    () => getCalendarRangeWithCurrentTime(dayLessons, selectedDate, currentTime),
    [currentTime, dayLessons, selectedDate]
  );
  const dayScrollAnchor = useMemo(
    () => getCalendarScrollAnchor(dayCalendarRange, dayLessons, selectedDate, currentTime),
    [currentTime, selectedDate, dayCalendarRange, dayLessons]
  );
  const weekCalendarRange = useMemo(
    () => getCalendarRangeWithCurrentTime(weekLessons, weekDays[0] ?? selectedDate, currentTime),
    [currentTime, weekDays, weekLessons, selectedDate]
  );
  const weekScrollAnchor = useMemo(
    () =>
      getCalendarScrollAnchor(
        weekCalendarRange,
        weekLessons,
        weekDays.find((day) => currentTime && sameDate(day, currentTime)) ?? weekDays[0] ?? selectedDate,
        currentTime
      ),
    [currentTime, weekCalendarRange, weekDays, weekLessons, selectedDate]
  );
  const monthLessons = useMemo(
    () =>
      scheduleLessons.filter((lesson) => {
        const lessonDate = new Date(lesson.startsAt);
        return monthDays.some((day) => sameDate(day, lessonDate));
      }),
    [scheduleLessons, monthDays]
  );

  const loadSnapshot = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setSnapshot(await api<Snapshot>("/api/snapshot"));
    } catch (error) {
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : t("toast.loadFailed"));
      }
    }
  }, [t]);

  const { secondsUntilRefresh, connected, refreshing, lastRefreshedAt, refreshNow } =
    useSnapshotAutoRefresh({ loadSnapshot, onSnapshot: (nextSnapshot) => setSnapshot(nextSnapshot as Snapshot) });

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function withRefresh(action: () => Promise<string | void>) {
    try {
      const result = await action();
      if (result) {
        toast.success(result);
      }
      await refreshNow();
    } catch (error) {
      const apiError = error as Error & { code?: string };
      switch (apiError.code) {
        case "student_limit":
          toast.error(t("plan.limit.students"));
          break;
        case "lesson_limit":
          toast.error(t("plan.limit.lessons"));
          break;
        case "package_limit":
          toast.error(t("plan.limit.packages"));
          break;
        case "recurring_limit":
          toast.error(t("plan.limit.recurring"));
          break;
        case "recurring_disabled":
          toast.error(t("plan.limit.recurring"));
          break;
        default:
          toast.error(apiError.message || t("toast.actionFailed"));
      }
    }
  }

  function getStudent(studentId: string) {
    return students.find((student) => student.id === studentId);
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
    const isLastParticipant = selectedLesson?.participants.length === 1;
    const confirmKey = isLastParticipant ? "confirm.removeLastParticipant" : "confirm.removeParticipant";

    if (!window.confirm(t(confirmKey, { name: studentName }))) {
      return;
    }

    await withRefresh(async () => {
      const result = await api<Lesson | { ok: true }>(`/api/lessons/${lessonId}/participants/${studentId}`, {
        method: "DELETE"
      });

      if (!("participants" in result)) {
        setSelectedLessonId(null);
        return t("toast.lessonDeletedSingle");
      }

      return t("toast.participantRemoved", { name: studentName });
    });
  }

  async function handleSetParticipantStatus(
    lessonId: string,
    studentId: string,
    status: "confirmed" | "declined"
  ) {
    await withRefresh(async () => {
      await api<Lesson>(`/api/lessons/${lessonId}/participants/${studentId}/status`, {
        method: "POST",
        body: { status }
      });

      const student = students.find((item) => item.id === studentId);
      return t("toast.participantStatusUpdated", { name: student?.fullName ?? t("lessonOverview.deletedStudent") });
    });
  }

  async function handleAddParticipant(lessonId: string, studentIds: string[]) {
    const wasIndividual = selectedLesson?.originalType === "individual";

    await withRefresh(async () => {
      const lesson = await api<Lesson>(`/api/lessons/${lessonId}/participants`, {
        method: "POST",
        body: { studentIds }
      });

      if (studentIds.length > 1) {
        if (wasIndividual || lesson.effectiveType === "group") {
          return t("toast.participantsAddedGroup", { count: studentIds.length });
        }
        return t("toast.participantsAdded", { count: studentIds.length });
      }

      const student = students.find((item) => item.id === studentIds[0]);
      const name = student?.fullName ?? "Ученик";

      if (wasIndividual) {
        return t("toast.participantAddedGroup", { name });
      }
      return t("toast.participantAdded", { name });
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
      <DashboardSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <SidebarInset className="min-w-0 bg-white">
        <header className={pageHeaderClass}>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarTrigger className="-ml-2 shrink-0" />
            <h1 className="truncate text-base font-bold text-stone-900 sm:text-lg">{activeTitle[activeSection]}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button type="button" className="hidden sm:inline-flex" onClick={openLessonDialog}>
              {t("calendar.scheduleLesson")}
            </Button>
          </div>
        </header>

        {activeSection === "schedule" ? (
          <ScheduleScreen
            scheduleView={scheduleView}
            setScheduleView={setScheduleView}
            selectedDate={selectedDate}
            currentTime={currentTime}
            weekDays={weekDays}
            monthDays={monthDays}
            dayLessons={dayLessons}
            weekLessons={weekLessons}
            monthLessons={monthLessons}
            dayCalendarRange={dayCalendarRange}
            dayScrollAnchor={dayScrollAnchor}
            weekCalendarRange={weekCalendarRange}
            weekScrollAnchor={weekScrollAnchor}
            students={students}
            vacationPeriods={vacationPeriods}
            recurringEnabled={snapshot?.account?.limits.recurringEnabled ?? true}
            lessonFormKey={lessonFormKey}
            lessonDialogOpen={lessonDialogOpen}
            setLessonDialogOpen={setLessonDialogOpen}
            secondsUntilRefresh={secondsUntilRefresh}
            connected={connected}
            refreshing={refreshing}
            lastRefreshedAt={lastRefreshedAt}
            refreshNow={refreshNow}
            onShiftCalendar={shiftCalendar}
            onGoToToday={goToToday}
            getStudent={getStudent}
            onSelectLesson={openLessonOverview}
            onLessonSubmit={handleLessonSubmit}
          />
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
          <SettingsView
            accountInfo={snapshot?.account ?? null}
            currency={currency}
            onCurrencyChange={handleCurrencyChange}
            onRefresh={() => refreshNow()}
          />
        ) : null}

        <MobileFab
          activeSection={activeSection}
          onScheduleLesson={openLessonDialog}
          onAddStudent={() => {
            setStudentFormKey((key) => key + 1);
            setActiveModal("student");
          }}
          onAddPayment={() => {
            setPaymentFormKey((key) => key + 1);
            setActiveModal("payment");
          }}
          onAddPackage={() => setActiveModal("package")}
        />
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
        availableStudents={availableStudentsForSelectedLesson}
        onOpenChange={(open) => !open && setSelectedLessonId(null)}
        onAddParticipant={handleAddParticipant}
        onRemoveParticipant={handleRemoveParticipant}
        onSetParticipantStatus={handleSetParticipantStatus}
        onDeleteLesson={handleDeleteLessonFromSheet}
      />

      <Toaster />
    </SidebarProvider>
  );
}
