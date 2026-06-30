import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { LogLevel } from "./logger";
import { tracesSampler } from "./sentry-sampling";

let enabled = false;

function sampleRate(): number {
  return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
}

function tracePropagationTargets(): Array<string | RegExp> {
  const targets: Array<string | RegExp> = ["localhost", /^http:\/\/localhost:\d+/];

  for (const key of ["BACKEND_INTERNAL_URL", "REMINDER_INTERNAL_URL", "APP_BASE_URL"] as const) {
    const value = process.env[key]?.trim();
    if (value) {
      targets.push(value);
    }
  }

  return targets;
}

function registerProfilerShutdown(): void {
  const stop = (): void => {
    Sentry.profiler.stopProfiler();
  };

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

export function initSentryNode(service: string, dsnOverride?: string): void {
  const dsn = (dsnOverride ?? process.env.SENTRY_DSN)?.trim();
  if (!dsn || enabled) {
    return;
  }

  const rate = sampleRate();

  const options: Sentry.NodeOptions = {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    integrations: [
      ...Sentry.getDefaultIntegrations({ dsn }),
      nodeProfilingIntegration(),
      Sentry.nodeRuntimeMetricsIntegration(),
      ...(service === "backend" ? [Sentry.postgresJsIntegration()] : [])
    ],
    tracesSampler: tracesSampler,
    tracePropagationTargets: tracePropagationTargets(),
    ignoreSpans: [/health/i, /monitoring/i],
    profileSessionSampleRate: rate,
    profileLifecycle: "trace",
    includeLocalVariables: true,
    enableLogs: true
  };

  Sentry.init(options);

  Sentry.getCurrentScope().setTag("service", service);
  registerProfilerShutdown();
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

export function suppressSentryTracing<T>(fn: () => T | Promise<T>): T | Promise<T> {
  if (!enabled) {
    return fn();
  }

  return Sentry.suppressTracing(fn);
}
