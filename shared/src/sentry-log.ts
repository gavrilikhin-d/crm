type LogLevel = "debug" | "info" | "warn" | "error";

type SentryModule = typeof import("@sentry/node");

let sentryModule: SentryModule | null = null;
let sentryEnabled = false;

export function bindSentryNode(sentry: SentryModule, enabled: boolean): void {
  sentryModule = sentry;
  sentryEnabled = enabled;
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export function captureSentryLog(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): void {
  if (!sentryEnabled || !sentryModule) {
    return;
  }

  const Sentry = sentryModule;
  const { err, ...rest } = context;
  const extra = rest as Record<string, unknown>;

  if (level === "error") {
    if (err instanceof Error) {
      Sentry.captureException(err, {
        extra: { ...extra, msg: message }
      });
      return;
    }

    Sentry.captureMessage(message, {
      level: "error",
      extra
    });
    return;
  }

  if (level === "warn") {
    Sentry.captureMessage(message, {
      level: "warning",
      extra
    });
  }
}

export function suppressSentryTracing<T>(fn: () => T | Promise<T>): T | Promise<T> {
  if (!sentryEnabled || !sentryModule) {
    return fn();
  }

  return sentryModule.suppressTracing(fn);
}
