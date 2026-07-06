import { signOut } from "next-auth/react";

type ApiOptions = {
  method?: string;
  body?: Record<string, unknown>;
};

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

export const STALE_SESSION_ERROR_CODE = "STALE_SESSION";

let cachedToken: { value: string; expiresAt: number } | null = null;
let reauthInProgress = false;

function clearAccessTokenCache(): void {
  cachedToken = null;
}

function handleStaleSession(): void {
  if (reauthInProgress) {
    return;
  }

  reauthInProgress = true;
  clearAccessTokenCache();
  void signOut({ callbackUrl: "/login" });
}

function createStaleSessionError(): Error & { code: string } {
  const error = new Error("Session expired") as Error & { code: string };
  error.code = STALE_SESSION_ERROR_CODE;
  return error;
}

function isStaleSessionResponse(status: number, payload: ApiErrorPayload): boolean {
  return status === 401 || payload.error === "Account not found" || payload.error === "Unauthorized";
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch("/api/auth/token");
  if (!response.ok) {
    clearAccessTokenCache();
    if (response.status === 401) {
      handleStaleSession();
    }
    return null;
  }

  const payload = (await response.json()) as { token: string };
  cachedToken = {
    value: payload.token,
    expiresAt: Date.now() + 5 * 60_000
  };
  return payload.token;
}

async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    if (isStaleSessionResponse(response.status, payload)) {
      handleStaleSession();
      throw createStaleSessionError();
    }

    const error = new Error(payload.error ?? `Request failed: ${response.status}`) as Error & { code?: string };
    error.code = payload.code;
    throw error;
  }

  return response.json() as Promise<T>;
}

export { api, clearAccessTokenCache, getAccessToken, type ApiOptions };
