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

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const students = snapshot?.students ?? [];
  const lessonPackages = snapshot?.lessonPackages ?? [];
  const lessons = useMemo(
    () => [...(snapshot?.lessons ?? [])].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [snapshot?.lessons]
  );
  const payments = useMemo(
    () => [...(snapshot?.payments ?? [])].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [snapshot?.payments]
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
      return "Занятие создано.";
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

  const debtLessons = snapshot?.balances.reduce((sum, balance) => sum + balance.debtLessons, 0) ?? 0;

  return (
    <>
      <header className="app-header">
        <div>
          <p className="eyebrow">Мини-CRM</p>
          <h1>Кабинет преподавателя</h1>
        </div>
        <button type="button" onClick={loadSnapshot} disabled={loading}>
          {loading ? "Загрузка..." : "Обновить"}
        </button>
      </header>

      <main>
        {message ? <p className="status-message">{message}</p> : null}

        <section className="grid grid-4">
          <StatCard label="Активные ученики" value={snapshot?.dashboard.studentsCount ?? 0} />
          <StatCard label="Занятий всего" value={snapshot?.dashboard.lessonsCount ?? 0} />
          <StatCard label="Должников" value={snapshot?.dashboard.debtors.length ?? 0} />
          <StatCard label="Долг в занятиях" value={debtLessons} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Ученики</h2>
          </div>
          <form className="form-grid" onSubmit={handleStudentSubmit}>
            <input name="fullName" placeholder="ФИО" required />
            <input name="phone" placeholder="Телефон" required />
            <input name="telegramUsername" placeholder="Telegram username" />
            <input name="telegramChatId" placeholder="Telegram chat id" />
            <input name="defaultLessonPrice" type="number" min="0" placeholder="Цена разового занятия" />
            <button type="submit">Добавить ученика</button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Telegram</th>
                  <th>Баланс</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const balance = getBalance(student.id);
                  const canSendPaymentReminder =
                    Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.fullName}</strong>
                        <br />
                        <span className="muted">{student.phone}</span>
                      </td>
                      <td>{student.telegramChatId ? `chat id: ${student.telegramChatId}` : student.telegramUsername || "не подключен"}</td>
                      <td>
                        {balance.remainingLessons} осталось, {balance.chargedLessons} использовано{" "}
                        <BalanceBadge balance={balance} />
                      </td>
                      <td>{student.status === "active" ? "Активен" : "Неактивен"}</td>
                      <td>
                        <button
                          className="secondary"
                          type="button"
                          disabled={!canSendPaymentReminder}
                          onClick={() =>
                            withRefresh(async () => {
                              const result = await api<{ sent: boolean; reason?: string }>(
                                `/api/payment-reminders/${student.id}`,
                                { method: "POST" }
                              );
                              return result.sent
                                ? "Напоминание отправлено."
                                : result.reason || "Напоминание не отправлено.";
                            })
                          }
                        >
                          Напомнить об оплате
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Расписание</h2>
          </div>
          <form className="form-grid" onSubmit={handleLessonSubmit}>
            <input name="startsAt" type="datetime-local" required />
            <select name="lessonType" required defaultValue="individual">
              <option value="individual">Индивидуальное</option>
              <option value="group">Групповое</option>
            </select>
            <input name="durationMinutes" type="number" min="1" placeholder="Длительность, мин" />
            <select name="studentIds" multiple required>
              {students
                .filter((student) => student.status === "active")
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
            </select>
            <button type="submit">Создать занятие</button>
          </form>

          <div className="cards">
            {lessons.length === 0 ? <p className="empty">Пока нет данных.</p> : null}
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                getStudent={getStudent}
                onAction={(action) => withRefresh(action)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-2">
          <div className="panel">
            <div className="panel-heading">
              <h2>Оплаты</h2>
            </div>
            <form className="form-grid" onSubmit={handlePaymentSubmit}>
              <select name="studentId" required defaultValue="">
                <option value="">Ученик</option>
                {students
                  .filter((student) => student.status === "active")
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
              </select>
              <select name="packageId" defaultValue="">
                <option value="">Без пакета</option>
                {lessonPackages
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}: {item.lessonCount} за {item.price}
                    </option>
                  ))}
              </select>
              <input name="lessonCount" type="number" min="1" placeholder="Занятий без пакета" />
              <input name="amount" type="number" min="0" placeholder="Сумма без пакета" />
              <select name="method" required defaultValue="transfer">
                <option value="transfer">Перевод</option>
                <option value="cash">Наличные</option>
                <option value="other">Другое</option>
              </select>
              <button type="submit">Добавить оплату</button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Ученик</th>
                    <th>Занятий</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.paidAt)}</td>
                      <td>{getStudent(payment.studentId)?.fullName ?? "Ученик удален"}</td>
                      <td>{payment.lessonCount}</td>
                      <td>{payment.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Пакеты</h2>
            </div>
            <form className="form-grid" onSubmit={handlePackageSubmit}>
              <input name="name" placeholder="Название пакета" required />
              <input name="lessonCount" type="number" min="1" placeholder="Количество занятий" required />
              <input name="price" type="number" min="0" placeholder="Цена пакета" required />
              <button type="submit">Добавить пакет</button>
            </form>
            <div className="cards compact">
              {lessonPackages.map((item) => (
                <PackageCard key={item.id} lessonPackage={item} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function LessonCard({
  lesson,
  getStudent,
  onAction
}: {
  lesson: Lesson;
  getStudent: (studentId: string) => Student | undefined;
  onAction: (action: () => Promise<void>) => void;
}) {
  const converted = lesson.originalType === "group" && lesson.effectiveType === "individual";

  return (
    <article className="lesson-card">
      <header>
        <div>
          <strong>{formatDate(lesson.startsAt)}</strong>
          <div className="muted">
            {typeLabels[lesson.effectiveType]} · {lesson.durationMinutes} мин · {statusLabels[lesson.status]}
          </div>
        </div>
        {converted ? (
          <span className="badge warn">перешло в индивидуальное</span>
        ) : (
          <span className="badge ok">{typeLabels[lesson.effectiveType]}</span>
        )}
      </header>
      <div className="participants">
        {lesson.participants.map((participant) => (
          <span className="participant" key={participant.id}>
            {getStudent(participant.studentId)?.fullName ?? "Ученик удален"}: {statusLabels[participant.status]}
            {participant.hasDebt ? " · долг" : ""}
          </span>
        ))}
      </div>
      <div className="actions">
        {lesson.participants.map((participant) => (
          <span className="actions" key={participant.id}>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                onAction(async () => {
                  await api(`/api/lessons/${lesson.id}/participants/${participant.studentId}/status`, {
                    method: "POST",
                    body: { status: "confirmed" }
                  });
                })
              }
            >
              Будет
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                onAction(async () => {
                  await api(`/api/lessons/${lesson.id}/participants/${participant.studentId}/status`, {
                    method: "POST",
                    body: { status: "declined" }
                  });
                })
              }
            >
              Не будет
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={lesson.status === "completed"}
          onClick={() =>
            onAction(async () => {
              await api(`/api/lessons/${lesson.id}/complete`, { method: "POST" });
            })
          }
        >
          Провести
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            onAction(async () => {
              await api(`/api/lessons/${lesson.id}/cancel`, { method: "POST" });
            })
          }
        >
          Отменить
        </button>
      </div>
    </article>
  );
}

function BalanceBadge({ balance }: { balance: StudentBalance }) {
  if (balance.debtLessons > 0) {
    return <span className="badge danger">долг {balance.debtLessons}</span>;
  }
  if (balance.remainingLessons < 1) {
    return <span className="badge warn">нет оплаченных занятий</span>;
  }
  return null;
}

function PackageCard({ lessonPackage }: { lessonPackage: LessonPackage }) {
  return (
    <article className="package-card">
      <strong>{lessonPackage.name}</strong>
      <p>
        {lessonPackage.lessonCount} занятий за {lessonPackage.price}
      </p>
      <p className="muted">{Math.round(lessonPackage.price / lessonPackage.lessonCount)} за занятие</p>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat-card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
