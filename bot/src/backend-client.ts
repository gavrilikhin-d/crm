import type { Lesson, Student, TelegramStudentProfile } from "@crm/shared";
import { log } from "./logger";

const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
const internalToken = process.env.INTERNAL_API_TOKEN ?? "";

function internalHeaders(body?: unknown): HeadersInit {
  const headers: Record<string, string> = {
    authorization: `Bearer ${internalToken}`
  };
  if (body) {
    headers["content-type"] = "application/json";
  }
  return headers;
}

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
  action?: "attend" | "decline";
}): Promise<Lesson> {
  const body: { status: string; action?: "attend" | "decline" } = { status: input.status };
  if (input.action) {
    body.action = input.action;
  }

  return api<Lesson>(`/internal/lessons/${input.lessonId}/participants/${input.studentId}/status`, {
    method: "POST",
    body
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
