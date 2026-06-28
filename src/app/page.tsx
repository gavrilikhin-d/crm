"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, GraduationCap, HelpCircle, RefreshCw, Settings, Users } from "lucide-react";
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

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  cancelled_by_student: "Student cancelled",
  cancelled_by_teacher: "Teacher cancelled",
  completed: "Completed",
  missed: "Missed",
  awaiting: "Awaiting",
  declined: "Declined",
  attended: "Attended"
};

const typeLabels: Record<string, string> = {
  individual: "Individual",
  group: "Group"
};

const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const visibleHours = Array.from({ length: 13 }, (_, index) => index + 9);
const calendarStartHour = 9;
const hourHeight = 76;

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("schedule");

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
  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const weekLessons = useMemo(
    () =>
      lessons.filter((lesson) => {
        const lessonDate = new Date(lesson.startsAt);
        return weekDays.some((day) => sameDate(day, lessonDate));
      }),
    [lessons, weekDays]
  );

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function loadSnapshot() {
    setLoading(true);
    try {
      setSnapshot(await api<Snapshot>("/api/snapshot"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load data.");
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
      setMessage(error instanceof Error ? error.message : "Action failed.");
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
      return "Student added.";
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
      return "Lesson scheduled.";
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
      return "Payment added.";
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
      return "Package added.";
    });
  }

  const debtLessons = snapshot?.balances.reduce((sum, balance) => sum + balance.debtLessons, 0) ?? 0;
  const activeTitle: Record<ActiveSection, string> = {
    schedule: "Teacher schedule",
    clients: "Clients",
    payments: "Payments",
    sessions: "Lesson packages"
  };

  return (
    <div className="grid min-h-screen w-screen grid-cols-[132px_minmax(0,1fr)] bg-white max-[900px]:grid-cols-1">
      <aside className="flex min-h-screen flex-col border-r border-stone-200 px-6 py-8 max-[900px]:min-h-0 max-[900px]:border-b max-[900px]:border-r-0">
        <div className="mb-20 text-lg font-black tracking-[0.42em] text-orange-600 max-[900px]:mb-6">VOCAL</div>
        <nav className="grid gap-5 max-[900px]:flex max-[900px]:flex-wrap" aria-label="Main navigation">
          <SidebarLink
            icon={<CreditCard className="size-4" />}
            active={activeSection === "payments"}
            onClick={() => setActiveSection("payments")}
          >
            Payments
          </SidebarLink>
          <SidebarLink
            icon={<Users className="size-4" />}
            active={activeSection === "clients"}
            onClick={() => setActiveSection("clients")}
          >
            Clients
          </SidebarLink>
          <SidebarLink
            icon={<CalendarDays className="size-4" />}
            active={activeSection === "schedule"}
            onClick={() => setActiveSection("schedule")}
          >
            Schedule
          </SidebarLink>
          <SidebarLink
            icon={<GraduationCap className="size-4" />}
            active={activeSection === "sessions"}
            onClick={() => setActiveSection("sessions")}
          >
            Sessions
          </SidebarLink>
        </nav>
        <div className="mt-auto grid gap-3 text-sm text-stone-500 max-[900px]:mt-6 max-[900px]:flex">
          <a className="flex items-center gap-2 hover:text-stone-900" href="#settings">
            <Settings className="size-4" /> Settings
          </a>
          <a className="flex items-center gap-2 hover:text-stone-900" href="#help">
            <HelpCircle className="size-4" /> Help
          </a>
          <button className="flex items-center gap-2 text-left hover:text-stone-900" type="button" onClick={loadSnapshot}>
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>
      </aside>

      <main className="min-w-0 overflow-x-auto">
        <header className="flex min-h-22 items-center justify-between border-b border-stone-200 px-10 py-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-stone-400">Lesson Scheduling CRM</p>
            <h1 className="mt-1 text-lg font-bold text-stone-900">{activeTitle[activeSection]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{snapshot?.dashboard.studentsCount ?? 0} students</Badge>
            <Badge variant={debtLessons > 0 ? "destructive" : "secondary"}>{debtLessons} unpaid lessons</Badge>
            <Button type="button" onClick={() => setActiveSection("schedule")}>
              Schedule lesson
            </Button>
          </div>
        </header>

        <div className="flex h-13 items-center gap-8 border-b border-stone-200 px-10">
          <Button variant="ghost" className="h-full rounded-none px-0 text-stone-400">
            Details
          </Button>
          <Button variant="ghost" className="h-full rounded-none border-b-2 border-orange-600 px-0 text-stone-900">
            {activeTitle[activeSection]}
          </Button>
          <Button variant="ghost" className="h-full rounded-none px-0 text-stone-400">
            Past sessions
          </Button>
        </div>

        {message ? (
          <div className="border-b border-orange-100 bg-orange-50 px-10 py-3 text-sm text-orange-900">{message}</div>
        ) : null}

        {activeSection === "schedule" ? (
        <section className="grid grid-cols-[minmax(720px,1fr)_330px] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1" id="schedule">
          <div className="min-w-0">
            <div className="mb-3 flex h-12 items-center justify-between">
              <Button variant="secondary" size="sm">
                Today
              </Button>
              <div className="text-xs font-extrabold uppercase tracking-wide text-stone-400">{formatWeekRange(weekDays)}</div>
              <Button variant="secondary" size="sm" onClick={loadSnapshot} disabled={loading}>
                {loading ? "Loading..." : "Sync"}
              </Button>
            </div>

            <div className="grid min-h-[680px] grid-cols-[62px_repeat(7,minmax(86px,1fr))] grid-rows-[58px_auto]">
              <div className="border-b border-stone-300" />
              {weekDays.map((day, index) => (
                <div className="grid justify-items-center border-b border-stone-300 pt-2" key={day.toISOString()}>
                  <strong className="text-xs uppercase text-stone-900">{weekDayLabels[index]}</strong>
                  <span className="text-[0.68rem] font-bold text-stone-400">{formatDay(day)}</span>
                </div>
              ))}

              <div className="col-start-1 row-start-2">
                {visibleHours.map((hour) => (
                  <div className="h-[76px] pt-1 text-xs font-bold text-stone-400" key={hour}>
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {weekDays.map((day, dayIndex) => (
                <div
                  className="relative min-h-[988px] border-l border-stone-100"
                  key={day.toISOString()}
                  style={{
                    background:
                      "repeating-linear-gradient(to bottom, transparent 0, transparent 75px, #ebe8e5 75px, #ebe8e5 76px)"
                  }}
                >
                  <div className="absolute inset-x-2 bottom-[76px] top-[76px] bg-teal-100/70" />
                  {weekLessons
                    .filter((lesson) => sameDate(new Date(lesson.startsAt), day))
                    .map((lesson) => (
                      <CalendarLesson
                        key={lesson.id}
                        lesson={lesson}
                        dayIndex={dayIndex}
                        getStudent={getStudent}
                        onAction={(action) => withRefresh(action)}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <Card id="new-session">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  Schedule session <Badge variant="teal">Group ready</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleLessonSubmit}>
                  <Input name="startsAt" type="datetime-local" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Select name="lessonType" required defaultValue="individual">
                      <option value="individual">Individual</option>
                      <option value="group">Group</option>
                    </Select>
                    <Input name="durationMinutes" type="number" min="1" placeholder="Min" />
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
                  <Button type="submit">Add to calendar</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Week overview</CardTitle>
                <CardDescription>{weekLessons.length} sessions scheduled this week.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Badge variant="teal">{weekLessons.filter((lesson) => lesson.effectiveType === "group").length} group</Badge>
                <Badge variant="secondary">
                  {weekLessons.filter((lesson) => lesson.effectiveType === "individual").length} individual
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
          <SessionsView lessonPackages={lessonPackages} onPackageSubmit={handlePackageSubmit} />
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
  onAction
}: {
  students: Student[];
  getBalance: (studentId: string) => StudentBalance;
  onStudentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAction: (action: () => Promise<string | void>) => void;
}) {
  return (
    <section className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Add client</CardTitle>
          <CardDescription>Students live here, separate from the weekly schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onStudentSubmit}>
            <Input name="fullName" placeholder="Full name" required />
            <Input name="phone" placeholder="Phone" required />
            <Input name="telegramUsername" placeholder="Telegram username" />
            <Input name="telegramChatId" placeholder="Telegram chat id" />
            <Input name="defaultLessonPrice" type="number" min="0" placeholder="Single lesson price" />
            <Button type="submit">Add client</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Clients <Badge variant="secondary">{students.length}</Badge>
          </CardTitle>
          <CardDescription>Balances are counted in whole lessons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {students.map((student) => {
            const balance = getBalance(student.id);
            const canSendPaymentReminder =
              Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
            return (
              <div
                className="grid grid-cols-[minmax(0,1fr)_160px_140px] items-center gap-4 rounded-lg border border-stone-200 p-4"
                key={student.id}
              >
                <div>
                  <strong className="block text-stone-900">{student.fullName}</strong>
                  <span className="text-sm text-stone-500">
                    {student.phone} · {student.telegramUsername || "Telegram not connected"}
                  </span>
                </div>
                <div className="text-sm text-stone-600">
                  <span className="block font-semibold">{balance.remainingLessons} left</span>
                  <span>{balance.chargedLessons} used</span>
                </div>
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
                      return result.sent ? "Payment reminder sent." : result.reason || "Reminder skipped.";
                    })
                  }
                >
                  Remind pay
                </Button>
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
            <CardTitle>Add payment</CardTitle>
            <CardDescription>Payments can buy one lesson or a package.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentForm students={students} lessonPackages={lessonPackages} onSubmit={onPaymentSubmit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add package</CardTitle>
            <CardDescription>Packages always contain whole lessons.</CardDescription>
          </CardHeader>
          <CardContent>
            <PackageForm onSubmit={onPackageSubmit} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Payment history <Badge variant="secondary">{payments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {payments.map((payment) => (
            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] rounded-lg border border-stone-200 p-4" key={payment.id}>
              <div>
                <strong className="block">{getStudent(payment.studentId)?.fullName ?? "Deleted client"}</strong>
                <span className="text-sm text-stone-500">{formatFullDate(payment.paidAt)}</span>
              </div>
              <span className="text-sm font-semibold text-stone-700">{payment.lessonCount} lessons</span>
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
  onPackageSubmit
}: {
  lessonPackages: LessonPackage[];
  onPackageSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="grid grid-cols-[360px_minmax(0,1fr)] gap-6 p-6 px-10 pb-10 max-[900px]:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Add package</CardTitle>
          <CardDescription>Useful for 4 and 8 lesson bundles.</CardDescription>
        </CardHeader>
        <CardContent>
          <PackageForm onSubmit={onPackageSubmit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Lesson packages <Badge variant="secondary">{lessonPackages.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {lessonPackages.map((lessonPackage) => (
            <div className="rounded-lg border border-stone-200 p-4" key={lessonPackage.id}>
              <strong>{lessonPackage.name}</strong>
              <p className="mt-2 text-sm text-stone-500">
                {lessonPackage.lessonCount} lessons · {lessonPackage.price}
              </p>
              <Badge className="mt-3" variant="orange">
                {Math.round(lessonPackage.price / lessonPackage.lessonCount)} per lesson
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
        <option value="">Client</option>
        {students
          .filter((student) => student.status === "active")
          .map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
      </Select>
      <Select name="packageId" defaultValue="">
        <option value="">No package</option>
        {lessonPackages
          .filter((item) => item.active)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}: {item.lessonCount} / {item.price}
            </option>
          ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input name="lessonCount" type="number" min="1" placeholder="Lessons" />
        <Input name="amount" type="number" min="0" placeholder="Amount" />
      </div>
      <Select name="method" required defaultValue="transfer">
        <option value="transfer">Transfer</option>
        <option value="cash">Cash</option>
        <option value="other">Other</option>
      </Select>
      <Button type="submit">Add payment</Button>
    </form>
  );
}

function PackageForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Input name="name" placeholder="Package name" required />
      <div className="grid grid-cols-2 gap-3">
        <Input name="lessonCount" type="number" min="1" placeholder="Lessons" required />
        <Input name="price" type="number" min="0" placeholder="Price" required />
      </div>
      <Button type="submit">Add package</Button>
    </form>
  );
}

function CalendarLesson({
  lesson,
  getStudent,
  onAction
}: {
  lesson: Lesson;
  dayIndex: number;
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
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
      <strong className="text-xs leading-tight">{primaryStudent?.fullName ?? "Lesson"}</strong>
      <span className="text-[0.66rem] leading-tight">
        {formatTime(date)} · {typeLabels[lesson.effectiveType]}
      </span>
      <small className="text-[0.66rem] leading-tight">{lesson.participants.length} participant(s)</small>
      {converted ? <em className="text-[0.66rem] leading-tight">Converted to individual</em> : null}
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
          Done
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

function getCurrentWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
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
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function formatWeekRange(days: Date[]): string {
  return `${formatDay(days[0])} - ${formatDay(days[6])}`;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const normalized = hour > 12 ? hour - 12 : hour;
  return `${normalized} ${suffix}`;
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
