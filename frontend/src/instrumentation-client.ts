import * as Sentry from "@sentry/nextjs";
import { SENTRY_CONSOLE_LOG_LEVELS } from "@crm/shared/sentry-logging";
import { parameterizeSpanName, tracesSampler } from "@crm/shared/sentry-sampling";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1.0;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: [...SENTRY_CONSOLE_LOG_LEVELS] }),
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) => !url.includes("/health") && !url.includes("/monitoring"),
        beforeStartSpan: (context) => ({
          ...context,
          name: parameterizeSpanName(context.name)
        })
      }),
      Sentry.browserProfilingIntegration()
    ],
    tracesSampler,
    tracePropagationTargets: ["localhost", /^\//],
    ignoreSpans: [/health/i, /monitoring/i],
    profileSessionSampleRate: sampleRate,
    profileLifecycle: "trace",
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: true
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
