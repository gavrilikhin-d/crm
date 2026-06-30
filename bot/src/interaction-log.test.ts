import { describe, expect, test } from "bun:test";
import { logBotInteraction, replyMessageKind } from "./interaction-log";
import { log } from "./logger";

describe("replyMessageKind", () => {
  test("classifies plain and html replies", () => {
    expect(replyMessageKind("hello")).toBe("plain_text");
    expect(replyMessageKind({ text: "<b>hi</b>", parse_mode: "HTML" })).toBe("html_text");
  });
});

describe("logBotInteraction", () => {
  test("includes telegram user id and chat id when provided", () => {
    const lines: string[] = [];
    const originalInfo = log.info;
    log.info = (message, context) => {
      lines.push(JSON.stringify({ message, ...context }));
    };

    try {
      logBotInteraction({
        handler: "command:balance",
        chatKind: "private",
        userId: 123456789,
        chatId: 987654321,
        messageKinds: ["html_text"],
        outcome: "ok"
      });
    } finally {
      log.info = originalInfo;
    }

    const entry = JSON.parse(lines[0]!) as { userId: number; chatId: number };
    expect(entry.userId).toBe(123456789);
    expect(entry.chatId).toBe(987654321);
  });
});
