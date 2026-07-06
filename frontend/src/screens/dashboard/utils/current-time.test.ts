import { describe, expect, test } from "vitest";
import { getMillisecondsUntilNextMinute } from "./current-time";

describe("getMillisecondsUntilNextMinute", () => {
  test("returns the delay until the upcoming minute boundary", () => {
    expect(getMillisecondsUntilNextMinute(new Date(2026, 6, 6, 12, 47, 0, 0))).toBe(60_000);
    expect(getMillisecondsUntilNextMinute(new Date(2026, 6, 6, 12, 47, 42, 250))).toBe(17_750);
    expect(getMillisecondsUntilNextMinute(new Date(2026, 6, 6, 12, 47, 59, 999))).toBe(1);
    expect(getMillisecondsUntilNextMinute(new Date(2026, 6, 6, 12, 48, 0, 0))).toBe(60_000);
  });
});
