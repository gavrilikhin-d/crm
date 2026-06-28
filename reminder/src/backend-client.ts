import type { Database, Lesson, Reminder, StudentBalance } from "@crm/shared";

const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

export async function getSnapshot(): Promise<Database> {
  return api<Database>("/api/snapshot");
}

export async function getBalances(): Promise<StudentBalance[]> {
  return api<StudentBalance[]>("/api/balances");
}

export async function upsertReminder(reminder: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
  return api<Reminder>("/internal/reminders", {
    method: "POST",
    body: reminder
  });
}

export async function updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
  return api<Reminder>(`/internal/reminders/${id}`, {
    method: "PATCH",
    body: patch
  });
}

export async function setParticipantStatus(input: {
  lesson: Lesson;
  studentId: string;
  status: string;
}): Promise<Lesson> {
  return api<Lesson>(`/api/lessons/${input.lesson.id}/participants/${input.studentId}/status`, {
    method: "POST",
    body: { status: input.status }
  });
}

async function api<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: options?.body ? { "content-type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
