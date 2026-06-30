import { describe, expect, test } from "bun:test";
import { isBackendUnreachableError } from "./fetch-retry";

describe("isBackendUnreachableError", () => {
  test("detects generic fetch failures", () => {
    expect(isBackendUnreachableError(new TypeError("fetch failed"))).toBe(true);
    expect(isBackendUnreachableError(new DOMException("Aborted", "AbortError"))).toBe(true);
  });

  test("detects connection error codes on cause", () => {
    const error = new TypeError("fetch failed", {
      cause: { code: "ECONNREFUSED" }
    });
    expect(isBackendUnreachableError(error)).toBe(true);
  });

  test("ignores application errors", () => {
    expect(isBackendUnreachableError(new Error("Student not found"))).toBe(false);
  });
});
