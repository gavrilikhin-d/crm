import { afterEach, describe, expect, test } from "bun:test";
import { createLogger, resolveMinLevel } from "./logger";

describe("createLogger", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("writes structured JSON with service and message", () => {
    const lines: string[] = [];
    const log = createLogger("bot", {
      minLevel: "debug",
      write: (line) => lines.push(line)
    });

    log.info("Telegram linked", { studentId: "s1", chatId: 42 });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.service).toBe("bot");
    expect(entry.msg).toBe("Telegram linked");
    expect(entry.studentId).toBe("s1");
    expect(entry.chatId).toBe(42);
    expect(typeof entry.ts).toBe("string");
  });

  test("respects min log level", () => {
    const lines: string[] = [];
    const log = createLogger("reminder", {
      minLevel: "warn",
      write: (line) => lines.push(line)
    });

    log.debug("hidden");
    log.info("hidden");
    log.warn("visible");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).level).toBe("warn");
  });

  test("serializes Error in err field", () => {
    const lines: string[] = [];
    const log = createLogger("reminder", {
      minLevel: "error",
      write: (line) => lines.push(line)
    });

    log.error("tick failed", { err: new Error("backend down") });

    const entry = JSON.parse(lines[0]!) as { err: { name: string; message: string } };
    expect(entry.err.name).toBe("Error");
    expect(entry.err.message).toBe("backend down");
  });

  test("child logger merges context", () => {
    const lines: string[] = [];
    const log = createLogger("bot", {
      minLevel: "info",
      write: (line) => lines.push(line)
    }).child({ requestId: "req-1" });

    log.info("handled command", { command: "/schedule" });

    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry.requestId).toBe("req-1");
    expect(entry.command).toBe("/schedule");
  });
});

describe("resolveMinLevel", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("uses LOG_LEVEL when set", () => {
    process.env.LOG_LEVEL = "warn";
    expect(resolveMinLevel()).toBe("warn");
  });

  test("defaults to info in production", () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "production";
    expect(resolveMinLevel()).toBe("info");
  });
});
