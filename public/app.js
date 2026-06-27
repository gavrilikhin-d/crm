const state = {
  students: [],
  lessonPackages: [],
  lessons: [],
  payments: [],
  balances: [],
  dashboard: null
};

const statusLabels = {
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

const typeLabels = {
  individual: "Индивидуальное",
  group: "Групповое"
};

document.getElementById("refreshButton").addEventListener("click", loadSnapshot);
document.getElementById("studentForm").addEventListener("submit", handleStudentSubmit);
document.getElementById("lessonForm").addEventListener("submit", handleLessonSubmit);
document.getElementById("paymentForm").addEventListener("submit", handlePaymentSubmit);
document.getElementById("packageForm").addEventListener("submit", handlePackageSubmit);

await loadSnapshot();

async function loadSnapshot() {
  const snapshot = await api("/api/snapshot");
  Object.assign(state, snapshot);
  render();
}

function render() {
  renderDashboard();
  renderStudents();
  renderSelects();
  renderLessons();
  renderPayments();
  renderPackages();
}

function renderDashboard() {
  const dashboard = document.getElementById("dashboard");
  const debtLessons = state.balances.reduce((sum, balance) => sum + balance.debtLessons, 0);
  dashboard.innerHTML = [
    statCard("Активные ученики", state.dashboard?.studentsCount ?? 0),
    statCard("Занятий всего", state.dashboard?.lessonsCount ?? 0),
    statCard("Должников", state.dashboard?.debtors?.length ?? 0),
    statCard("Долг в занятиях", debtLessons)
  ].join("");
}

function renderStudents() {
  const tbody = document.getElementById("studentsTable");
  tbody.innerHTML = state.students
    .map((student) => {
      const balance = getBalance(student.id);
      const canSendPaymentReminder =
        Boolean(student.telegramChatId) && (balance.remainingLessons < 1 || balance.debtLessons > 0);
      const telegram = student.telegramChatId
        ? `chat id: ${escapeHtml(student.telegramChatId)}`
        : escapeHtml(student.telegramUsername || "не подключен");
      const debt =
        balance.debtLessons > 0
          ? `<span class="badge danger">долг ${balance.debtLessons}</span>`
          : balance.remainingLessons < 1
            ? '<span class="badge warn">нет оплаченных занятий</span>'
            : "";

      return `
        <tr>
          <td><strong>${escapeHtml(student.fullName)}</strong><br><span class="muted">${escapeHtml(student.phone)}</span></td>
          <td>${telegram}</td>
          <td>${balance.remainingLessons} осталось, ${balance.chargedLessons} использовано ${debt}</td>
          <td>${student.status === "active" ? "Активен" : "Неактивен"}</td>
          <td>
            <button class="secondary" data-payment-reminder="${student.id}" ${canSendPaymentReminder ? "" : "disabled"}>
              Напомнить об оплате
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-payment-reminder]").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = await api(`/api/payment-reminders/${button.dataset.paymentReminder}`, { method: "POST" });
      alert(result.sent ? "Напоминание отправлено." : result.reason || "Напоминание не отправлено.");
      await loadSnapshot();
    });
  });
}

function renderSelects() {
  const studentOptions = state.students
    .filter((student) => student.status === "active")
    .map((student) => `<option value="${student.id}">${escapeHtml(student.fullName)}</option>`)
    .join("");

  document.getElementById("lessonStudents").innerHTML = studentOptions;
  document.getElementById("paymentStudent").innerHTML = `<option value="">Ученик</option>${studentOptions}`;

  document.getElementById("paymentPackage").innerHTML = [
    '<option value="">Без пакета</option>',
    ...state.lessonPackages
      .filter((item) => item.active)
      .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}: ${item.lessonCount} за ${item.price}</option>`)
  ].join("");
}

function renderLessons() {
  const list = document.getElementById("lessonsList");
  const lessons = [...state.lessons].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  list.innerHTML =
    lessons
      .map((lesson) => {
        const participants = lesson.participants
          .map((participant) => {
            const student = getStudent(participant.studentId);
            const debt = participant.hasDebt ? " · долг" : "";
            return `
              <span class="participant">
                ${escapeHtml(student?.fullName ?? "Ученик удален")}:
                ${statusLabels[participant.status]}${debt}
              </span>
            `;
          })
          .join("");

        const converted =
          lesson.originalType === "group" && lesson.effectiveType === "individual"
            ? '<span class="badge warn">перешло в индивидуальное</span>'
            : "";

        return `
          <article class="lesson-card">
            <header>
              <div>
                <strong>${formatDate(lesson.startsAt)}</strong>
                <div class="muted">
                  ${typeLabels[lesson.effectiveType]} · ${lesson.durationMinutes} мин · ${statusLabels[lesson.status]}
                </div>
              </div>
              ${converted || `<span class="badge ok">${typeLabels[lesson.effectiveType]}</span>`}
            </header>
            <div class="participants">${participants}</div>
            <div class="actions">
              ${lesson.participants
                .map(
                  (participant) => `
                  <button class="secondary" data-status="${lesson.id}:${participant.studentId}:confirmed">Будет</button>
                  <button class="secondary" data-status="${lesson.id}:${participant.studentId}:declined">Не будет</button>
                `
                )
                .join("")}
              <button data-complete="${lesson.id}" ${lesson.status === "completed" ? "disabled" : ""}>Провести</button>
              <button class="secondary" data-cancel="${lesson.id}">Отменить</button>
            </div>
          </article>
        `;
      })
      .join("") || emptyHtml();

  list.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [lessonId, studentId, status] = button.dataset.status.split(":");
      await api(`/api/lessons/${lessonId}/participants/${studentId}/status`, {
        method: "POST",
        body: { status }
      });
      await loadSnapshot();
    });
  });

  list.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/lessons/${button.dataset.complete}/complete`, { method: "POST" });
      await loadSnapshot();
    });
  });

  list.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/lessons/${button.dataset.cancel}/cancel`, { method: "POST" });
      await loadSnapshot();
    });
  });
}

function renderPayments() {
  const tbody = document.getElementById("paymentsTable");
  tbody.innerHTML =
    [...state.payments]
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
      .map((payment) => {
        const student = getStudent(payment.studentId);
        return `
          <tr>
            <td>${formatDate(payment.paidAt)}</td>
            <td>${escapeHtml(student?.fullName ?? "Ученик удален")}</td>
            <td>${payment.lessonCount}</td>
            <td>${payment.amount}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="4">${emptyHtml()}</td></tr>`;
}

function renderPackages() {
  const list = document.getElementById("packagesList");
  list.innerHTML =
    state.lessonPackages
      .map(
        (item) => `
        <article class="package-card">
          <strong>${escapeHtml(item.name)}</strong>
          <p>${item.lessonCount} занятий за ${item.price}</p>
          <p class="muted">${Math.round(item.price / item.lessonCount)} за занятие</p>
        </article>
      `
      )
      .join("") || emptyHtml();
}

async function handleStudentSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (data.defaultLessonPrice) {
    data.defaultLessonPrice = Number(data.defaultLessonPrice);
  } else {
    delete data.defaultLessonPrice;
  }
  await api("/api/students", { method: "POST", body: data });
  event.currentTarget.reset();
  await loadSnapshot();
}

async function handleLessonSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const selectedStudents = [...event.currentTarget.elements.studentIds.selectedOptions].map((option) => option.value);
  data.studentIds = selectedStudents;
  if (data.durationMinutes) {
    data.durationMinutes = Number(data.durationMinutes);
  } else {
    delete data.durationMinutes;
  }
  await api("/api/lessons", { method: "POST", body: data });
  event.currentTarget.reset();
  await loadSnapshot();
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
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
  await api("/api/payments", { method: "POST", body: data });
  event.currentTarget.reset();
  await loadSnapshot();
}

async function handlePackageSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  data.lessonCount = Number(data.lessonCount);
  data.price = Number(data.price);
  await api("/api/lesson-packages", { method: "POST", body: data });
  event.currentTarget.reset();
  await loadSnapshot();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function getStudent(studentId) {
  return state.students.find((student) => student.id === studentId);
}

function getBalance(studentId) {
  return (
    state.balances.find((balance) => balance.studentId === studentId) ?? {
      paidLessons: 0,
      chargedLessons: 0,
      remainingLessons: 0,
      debtLessons: 0
    }
  );
}

function statCard(label, value) {
  return `<article class="stat-card"><span class="muted">${label}</span><strong>${value}</strong></article>`;
}

function emptyHtml() {
  return document.getElementById("emptyTemplate").innerHTML;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
