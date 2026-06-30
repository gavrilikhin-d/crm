import { describe, expect, test } from "bun:test";
import { toSentryLogAttributes } from "./sentry-logging";

describe("toSentryLogAttributes", () => {
  test("includes service and scalar context fields", () => {
    expect(
      toSentryLogAttributes("bot", {
        studentId: "s1",
        chatId: 42,
        active: true
      })
    ).toEqual({
      service: "bot",
      studentId: "s1",
      chatId: 42,
      active: true
    });
  });

  test("serializes errors into attributes", () => {
    const attributes = toSentryLogAttributes("reminder", {
      err: new Error("backend down")
    });

    expect(attributes.service).toBe("reminder");
    expect(attributes.error_name).toBe("Error");
    expect(attributes.error_message).toBe("backend down");
    expect(typeof attributes.error_stack).toBe("string");
  });
});
