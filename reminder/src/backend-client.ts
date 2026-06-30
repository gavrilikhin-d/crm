import type { Database, Lesson, Reminder, StudentBalance } from "@crm/shared";
import { log } from "./logger";

const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
const internalToken = process.env.INTERNAL_API_TOKEN ?? "";

type WorkerSnapshot = {
  accountId: string;
  snapshot: Database;
  balances: StudentBalance[];
  settings: Database["settings"];
};

function internalHeaders(body?: unknown): HeadersInit {
  const headers: Record<string, string> = {
    authorization: `Bearer ${internalToken}`
  };
  if (body) {
    headers["content-type"] = "application/json";
  }
  return headers;
}

export async function getWorkerSnapshots(): Promise<WorkerSnapshot[]> {
  return api<WorkerSnapshot[]>("/internal/worker/snapshots");
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
  return api<Lesson>(`/internal/lessons/${input.lesson.id}/participants/${input.studentId}/status`, {
    method: "POST",
    body: { status: input.status }
  });
}

async function api<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: internalHeaders(options?.body),
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    const message = payload.error ?? `Backend request failed: ${response.status}`;
    log.warn("Backend request failed", {
      path,
      method: options?.method ?? "GET",
      status: response.status,
      error: message
    });
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
