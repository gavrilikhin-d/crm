import * as Sentry from "@sentry/node";
import type { LogLevel } from "./logger";

let enabled = false;

export function initSentryNode(service: string, dsnOverride?: string): void {
  const dsn = (dsnOverride ?? process.env.SENTRY_DSN)?.trim();
  if (!dsn || enabled) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    includeLocalVariables: true,
    enableLogs: true
  });

  Sentry.getCurrentScope().setTag("service", service);
  enabled = true;
}

export function captureSentryLog(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): void {
  if (!enabled) {
    return;
  }

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

export function isSentryEnabled(): boolean {
  return enabled;
}
