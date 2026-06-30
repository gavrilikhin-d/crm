import * as Sentry from "@sentry/nextjs";
import { tracesSampler } from "@crm/shared/sentry-sampling";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampler,
    ignoreSpans: [/health/i, /monitoring/i],
    enableLogs: true
  });
}
