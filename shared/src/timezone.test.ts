import { describe, expect, test } from "bun:test";
import {
  formatLessonDateTimeInTimeZone,
  formatLessonWhenInTimeZone,
  isValidTimeZone,
  resolveNotificationTimeZone,
  toDateKeyInTimeZone
} from "./timezone";

describe("isValidTimeZone", () => {
  test("accepts IANA timezones", () => {
    expect(isValidTimeZone("Europe/Moscow")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("resolveNotificationTimeZone", () => {
  test("prefers student override over teacher timezone", () => {
    expect(
      resolveNotificationTimeZone({
        studentTimeZone: "Europe/Moscow",
        teacherTimeZone: "Europe/Minsk"
      })
    ).toBe("Europe/Moscow");
  });

  test("falls back to teacher timezone", () => {
    expect(
      resolveNotificationTimeZone({
        studentTimeZone: null,
        teacherTimeZone: "America/New_York"
      })
    ).toBe("America/New_York");
  });

  test("falls back to default when nothing valid is provided", () => {
    expect(resolveNotificationTimeZone({})).toBe("Europe/Minsk");
  });
});

describe("telegram timezone formatting", () => {
  test("formats lesson reminder time in teacher timezone instead of UTC", () => {
    // 10:00 Europe/Moscow == 07:00 UTC
    const startsAt = "2024-04-01T07:00:00.000Z";
    const formatted = formatLessonDateTimeInTimeZone(startsAt, 60, "Europe/Moscow");

    expect(formatted.timeRange).toContain("10:00");
    expect(formatted.timeRange).not.toContain("07:00");
  });

  test("uses today/tomorrow labels in the target timezone", () => {
    const now = new Date("2024-04-01T20:00:00.000Z"); // 23:00 Moscow
    const moscowSameDay = new Date("2024-04-01T12:00:00.000Z"); // 15:00 Moscow Apr 1
    expect(formatLessonWhenInTimeZone(moscowSameDay, 60, "Europe/Moscow", now)).toContain("Сегодня");

    const moscowTomorrow = new Date("2024-04-02T10:00:00.000Z"); // 13:00 Moscow Apr 2
    expect(formatLessonWhenInTimeZone(moscowTomorrow, 60, "Europe/Moscow", now)).toContain("Завтра");
    expect(toDateKeyInTimeZone("2024-04-01T21:30:00.000Z", "Europe/Moscow")).toBe("2024-04-02");
  });
});
