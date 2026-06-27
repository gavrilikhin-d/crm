"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Database, Lesson, LessonPackage, Student, StudentBalance } from "../types";

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
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
  const selectedTeacherName = students[0]?.fullName ?? "Teacher schedule";

  return (
    <div className="scheduler-shell">
      <aside className="sidebar">
        <div className="brand">VOCAL</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-item" href="#payments">
            <span>●</span> Payments
          </a>
          <a className="nav-item" href="#students">
            <span>●</span> Clients
          </a>
          <a className="nav-item active" href="#schedule">
            <span>●</span> Schedule
          </a>
          <a className="nav-item" href="#sessions">
            <span>●</span> Sessions
          </a>
        </nav>
        <div className="sidebar-footer">
          <a href="#settings">Settings</a>
          <a href="#help">Help</a>
          <button className="text-button" type="button" onClick={loadSnapshot} disabled={loading}>
            Refresh
          </button>
        </div>
      </aside>

      <main className="scheduler-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Lesson Scheduling CRM</p>
            <h1>{selectedTeacherName}</h1>
          </div>
          <div className="top-actions">
            <span className="top-pill">{snapshot?.dashboard.studentsCount ?? 0} students</span>
            <span className="top-pill danger">{debtLessons} unpaid lessons</span>
            <a className="primary-link" href="#new-session">
              Schedule lesson
            </a>
          </div>
        </header>

        <div className="tabs" role="tablist" aria-label="Teacher sections">
          <button className="tab" type="button">
            Details
          </button>
          <button className="tab active" type="button">
            Schedule
          </button>
          <button className="tab" type="button">
            Past sessions
          </button>
        </div>

        {message ? <p className="status-message">{message}</p> : null}

        <section className="schedule-layout" id="schedule">
          <div className="calendar-panel">
            <div className="calendar-toolbar">
              <button className="secondary compact-button" type="button">
                Today
              </button>
              <div className="week-range">{formatWeekRange(weekDays)}</div>
              <button className="secondary compact-button" type="button" onClick={loadSnapshot} disabled={loading}>
                {loading ? "Loading..." : "Sync"}
              </button>
            </div>

            <div className="calendar-grid">
              <div className="calendar-corner" />
              {weekDays.map((day, index) => (
                <div className="day-heading" key={day.toISOString()}>
                  <strong>{weekDayLabels[index]}</strong>
                  <span>{formatDay(day)}</span>
                </div>
              ))}

              <div className="time-axis">
                {visibleHours.map((hour) => (
                  <div className="time-label" key={hour}>
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {weekDays.map((day, dayIndex) => (
                <div className="day-column" key={day.toISOString()}>
                  <div className="availability-band" />
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

          <aside className="right-rail">
            <section className="quick-card" id="new-session">
              <div className="card-heading">
                <h2>Schedule session</h2>
                <span>{typeLabels.group} ready</span>
              </div>
              <form className="stacked-form" onSubmit={handleLessonSubmit}>
                <input name="startsAt" type="datetime-local" required />
                <div className="inline-fields">
                  <select name="lessonType" required defaultValue="individual">
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                  </select>
                  <input name="durationMinutes" type="number" min="1" placeholder="Min" />
                </div>
                <select name="studentIds" multiple required>
                  {students
                    .filter((student) => student.status === "active")
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName}
                      </option>
                    ))}
                </select>
                <button type="submit">Add to calendar</button>
              </form>
            </section>

            <section className="quick-card" id="students">
              <div className="card-heading">
                <h2>Clients</h2>
                <span>{students.length}</span>
              </div>
              <form className="stacked-form" onSubmit={handleStudentSubmit}>
                <input name="fullName" placeholder="Full name" required />
                <input name="phone" placeholder="Phone" required />
                <input name="telegramUsername" placeholder="Telegram username" />
                <input name="telegramChatId" placeholder="Telegram chat id" />
                <input name="defaultLessonPrice" type="number" min="0" placeholder="Single lesson price" />
                <button className="secondary" type="submit">
                  Add client
                </button>
              </form>
              <div className="client-list">
                {students.slice(0, 5).map((student) => {
                  const balance = getBalance(student.id);
                  const canSendPaymentReminder =
                    Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
                  return (
                    <div className="client-row" key={student.id}>
                      <div>
                        <strong>{student.fullName}</strong>
                        <span>{balance.remainingLessons} lessons left</span>
                      </div>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={!canSendPaymentReminder}
                        title="Remind about payment"
                        onClick={() =>
                          withRefresh(async () => {
                            const result = await api<{ sent: boolean; reason?: string }>(
                              `/api/payment-reminders/${student.id}`,
                              { method: "POST" }
                            );
                            return result.sent ? "Payment reminder sent." : result.reason || "Reminder skipped.";
                          })
                        }
                      >
                        Pay
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="quick-card" id="payments">
              <div className="card-heading">
                <h2>Payments</h2>
                <span>{payments.length}</span>
              </div>
              <form className="stacked-form" onSubmit={handlePaymentSubmit}>
                <select name="studentId" required defaultValue="">
                  <option value="">Client</option>
                  {students
                    .filter((student) => student.status === "active")
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName}
                      </option>
                    ))}
                </select>
                <select name="packageId" defaultValue="">
                  <option value="">No package</option>
                  {lessonPackages
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}: {item.lessonCount} / {item.price}
                      </option>
                    ))}
                </select>
                <div className="inline-fields">
                  <input name="lessonCount" type="number" min="1" placeholder="Lessons" />
                  <input name="amount" type="number" min="0" placeholder="Amount" />
                </div>
                <select name="method" required defaultValue="transfer">
                  <option value="transfer">Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
                <button className="secondary" type="submit">
                  Add payment
                </button>
              </form>
            </section>

            <section className="quick-card" id="sessions">
              <div className="card-heading">
                <h2>Packages</h2>
                <span>{lessonPackages.length}</span>
              </div>
              <form className="stacked-form" onSubmit={handlePackageSubmit}>
                <input name="name" placeholder="Package name" required />
                <div className="inline-fields">
                  <input name="lessonCount" type="number" min="1" placeholder="Lessons" required />
                  <input name="price" type="number" min="0" placeholder="Price" required />
                </div>
                <button className="secondary" type="submit">
                  Add package
                </button>
              </form>
            </section>
          </aside>
        </section>
      </main>
    </div>
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
      className={`calendar-lesson ${lesson.effectiveType} ${hasDebt ? "has-debt" : ""}`}
      style={{ top, minHeight: height }}
    >
      <strong>{primaryStudent?.fullName ?? "Lesson"}</strong>
      <span>
        {formatTime(date)} · {typeLabels[lesson.effectiveType]}
      </span>
      <small>{lesson.participants.length} participant(s)</small>
      {converted ? <em>Converted to individual</em> : null}
      <div className="lesson-actions">
        {lesson.participants.slice(0, 2).map((participant) => (
          <button
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
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onAction(async () => {
              await api(`/api/lessons/${lesson.id}/complete`, { method: "POST" });
            })
          }
        >
          Done
        </button>
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
