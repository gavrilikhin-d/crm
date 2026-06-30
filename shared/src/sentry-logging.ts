export const SENTRY_CONSOLE_LOG_LEVELS = ["log", "warn", "error"] as const;

export function toSentryLogAttributes(
  service: string,
  context: Record<string, unknown> = {}
): Record<string, string | number | boolean> {
  const { err, ...rest } = context;
  const attributes: Record<string, string | number | boolean> = { service };

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
      continue;
    }

    attributes[key] = String(value);
  }

  if (err instanceof Error) {
    attributes.error_name = err.name;
    attributes.error_message = err.message;
    if (err.stack) {
      attributes.error_stack = err.stack;
    }
  }

  return attributes;
}
