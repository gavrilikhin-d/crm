type ApiOptions = {
  method?: string;
  body?: Record<string, unknown>;
};

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch("/api/auth/token");
  if (!response.ok) {
    cachedToken = null;
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
    const error = new Error(payload.error ?? `Request failed: ${response.status}`) as Error & { code?: string };
    error.code = payload.code;
    throw error;
  }

  return response.json() as Promise<T>;
}

export { api, type ApiOptions };
