import * as Sentry from "@sentry/nextjs";
import { SENTRY_CONSOLE_LOG_LEVELS } from "@crm/shared/sentry-logging";
import { tracesSampler } from "@crm/shared/sentry-sampling";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.consoleLoggingIntegration({ levels: [...SENTRY_CONSOLE_LOG_LEVELS] })],
    tracesSampler,
    ignoreSpans: [/health/i, /monitoring/i],
    enableLogs: true
  });
}
