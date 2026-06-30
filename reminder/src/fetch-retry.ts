function isBackendUnreachableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === "fetch failed" || error.name === "AbortError") {
    return true;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code?: string }).code);
    return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"].includes(code);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = fetch
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(15_000)
      });
    } catch (error) {
      lastError = error;
      if (!isBackendUnreachableError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(attempt * 500);
    }
  }

  throw lastError;
}

export { fetchWithRetry, isBackendUnreachableError, sleep };
