import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { SENTRY_CONSOLE_LOG_LEVELS } from "@crm/shared/sentry-logging";
import { tracesSampler } from "@crm/shared/sentry-sampling";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const sampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1.0;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: [...SENTRY_CONSOLE_LOG_LEVELS] }),
      nodeProfilingIntegration(),
      Sentry.nodeRuntimeMetricsIntegration()
    ],
    tracesSampler,
    ignoreSpans: [/health/i, /monitoring/i],
    profileSessionSampleRate: sampleRate,
    profileLifecycle: "trace",
    includeLocalVariables: true,
    enableLogs: true
  });
}
