import { captureSentryLog } from "./sentry-log";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  child: (context: Record<string, unknown>) => Logger;
};

type LoggerOptions = {
  service: string;
  context?: Record<string, unknown>;
  minLevel?: LogLevel;
  write?: (line: string, level: LogLevel) => void;
};

function resolveMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_ORDER) {
    return env as LogLevel;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function pushToLoki(line: string): void {
  const url = process.env.LOKI_PUSH_URL;
  if (!url) {
    return;
  }

  try {
    const entry = JSON.parse(line) as Record<string, unknown>;
    const labels = {
      service: String(entry.service ?? "unknown"),
      level: String(entry.level ?? "info")
    };
    const body = JSON.stringify({
      streams: [
        {
          stream: labels,
          values: [[`${Date.now()}000000`, line]]
        }
      ]
    });

    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    }).catch(() => undefined);
  } catch {
    // Ignore malformed log lines.
  }
}

function createLogger(service: string, options: Partial<LoggerOptions> = {}): Logger {
  const minLevel = options.minLevel ?? resolveMinLevel();
  const baseContext = options.context ?? {};
  const write =
    options.write ??
    ((line: string, level: LogLevel) => {
      const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
      stream.write(`${line}\n`);
      pushToLoki(line);
    });

  function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
      return;
    }

    const { err, ...rest } = context;
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      service,
      msg: message,
      ...baseContext,
      ...rest
    };

    const serialized = serializeError(err);
    if (serialized) {
      entry.err = serialized;
    }

    write(JSON.stringify(entry), level);

    if (level === "info" || level === "warn" || level === "error") {
      captureSentryLog(service, level, message, context);
    }
  }

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    child: (context) =>
      createLogger(service, {
        minLevel,
        context: { ...baseContext, ...context },
        write
      })
  };
}

export { createLogger, pushToLoki, resolveMinLevel, type LogLevel, type Logger };
