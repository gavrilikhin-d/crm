import type { Lesson, Student, TelegramStudentProfile } from "@crm/shared";

const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

export async function bindTelegramChat(input: {
  token: string;
  chatId: number | string;
  userId: number | string;
  username?: string;
}): Promise<Student> {
  return api<Student>("/internal/telegram/bind", {
    method: "POST",
    body: input
  });
}

export async function getTelegramStudentProfile(
  userId: number | string,
  options?: { days?: number }
): Promise<TelegramStudentProfile> {
  const params = new URLSearchParams({ userId: String(userId) });
  if (options?.days !== undefined) {
    params.set("days", String(options.days));
  }

  return api<TelegramStudentProfile>(`/internal/telegram/profile?${params.toString()}`);
}

export async function setParticipantStatus(input: {
  lessonId: string;
  studentId: string;
  status: string;
  action: "attend" | "decline";
}): Promise<Lesson> {
  return api<Lesson>(`/api/lessons/${input.lessonId}/participants/${input.studentId}/status`, {
    method: "POST",
    body: {
      status: input.status,
      action: input.action
    }
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
