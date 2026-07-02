import * as Sentry from "@sentry/node";
import { SENTRY_CONSOLE_LOG_LEVELS } from "./sentry-logging";
import { tracesSampler } from "./sentry-sampling";
import { bindSentryNode, captureSentryLog, isSentryEnabled, suppressSentryTracing } from "./sentry-log";

export { captureSentryLog, isSentryEnabled, suppressSentryTracing };

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
  if (!Sentry.profiler) {
    return;
  }

  const stop = (): void => {
    Sentry.profiler.stopProfiler();
  };

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

async function loadProfilingIntegration(): Promise<Sentry.Integration | null> {
  try {
    const { nodeProfilingIntegration } = await import("@sentry/profiling-node");
    return nodeProfilingIntegration();
  } catch {
    return null;
  }
}

export async function initSentryNode(service: string, dsnOverride?: string): Promise<void> {
  const dsn = (dsnOverride ?? process.env.SENTRY_DSN)?.trim();
  if (!dsn || enabled) {
    return;
  }

  const rate = sampleRate();
  const profilingIntegration = await loadProfilingIntegration();

  const options: Sentry.NodeOptions = {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    integrations: [
      ...Sentry.getDefaultIntegrations({ dsn }),
      Sentry.consoleLoggingIntegration({ levels: [...SENTRY_CONSOLE_LOG_LEVELS] }),
      ...(profilingIntegration ? [profilingIntegration] : []),
      Sentry.nodeRuntimeMetricsIntegration(),
      ...(service === "backend" ? [Sentry.postgresJsIntegration()] : [])
    ],
    tracesSampler: tracesSampler,
    tracePropagationTargets: tracePropagationTargets(),
    ignoreSpans: [/health/i, /monitoring/i],
    ...(profilingIntegration
      ? {
          profileSessionSampleRate: rate,
          profileLifecycle: "trace" as const
        }
      : {}),
    includeLocalVariables: true,
    enableLogs: true
  };

  Sentry.init(options);

  Sentry.getCurrentScope().setTag("service", service);
  registerProfilerShutdown();
  bindSentryNode(Sentry, true);
  enabled = true;
}
