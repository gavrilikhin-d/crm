import { toSentryLogAttributes } from "./sentry-logging";

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
  service: string,
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): void {
  if (!sentryEnabled || !sentryModule) {
    return;
  }

  const Sentry = sentryModule;
  const attributes = toSentryLogAttributes(service, context);

  switch (level) {
    case "debug":
      Sentry.logger.debug(message, attributes);
      return;
    case "info":
      Sentry.logger.info(message, attributes);
      return;
    case "warn":
      Sentry.logger.warn(message, attributes);
      return;
    case "error": {
      Sentry.logger.error(message, attributes);
      const { err } = context;
      if (err instanceof Error) {
        Sentry.captureException(err, {
          extra: { ...attributes, msg: message }
        });
      }
    }
  }
}

export function suppressSentryTracing<T>(fn: () => T | Promise<T>): T | Promise<T> {
  if (!sentryEnabled || !sentryModule) {
    return fn();
  }

  return sentryModule.suppressTracing(fn);
}
