import { describe, expect, test } from "bun:test";
import {
  getVacationDayOverlay,
  getVacationIntervalBounds,
  isValidDateKey,
  isWithinVacation,
  lessonOverlapsVacationPeriod,
  normalizeVacationPeriod,
  toLocalDateKey,
  vacationAffectsDay
} from "./vacation";
import type { VacationPeriod } from "./types";

function createPeriod(overrides: Partial<VacationPeriod> & Pick<VacationPeriod, "startsOn" | "endsOn">): VacationPeriod {
  return {
    id: "vacation-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("vacation helpers", () => {
  test("validates date keys", () => {
    expect(isValidDateKey("2026-07-07")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });

  test("detects full-day vacation lessons", () => {
    const period = createPeriod({ startsOn: "2026-07-01", endsOn: "2026-07-10" });
    expect(isWithinVacation("2026-07-07T16:30:00", [period], 60)).toBe(true);
    expect(isWithinVacation("2026-07-11T10:00:00", [period], 60)).toBe(false);
  });

  test("detects partial-day vacation overlap", () => {
    const period = createPeriod({
      startsOn: "2026-07-07",
      endsOn: "2026-07-07",
      startsAtTime: "14:00",
      endsAtTime: "16:00"
    });

    expect(lessonOverlapsVacationPeriod("2026-07-07T15:00:00", 60, period)).toBe(true);
    expect(lessonOverlapsVacationPeriod("2026-07-07T12:00:00", 60, period)).toBe(false);
    expect(lessonOverlapsVacationPeriod("2026-07-07T15:30:00", 90, period)).toBe(true);
  });

  test("timed vacation does not treat all lessons on start and end dates as cancelled", () => {
    const period = createPeriod({
      startsOn: "2026-07-07",
      endsOn: "2026-07-08",
      startsAtTime: "14:00",
      endsAtTime: "12:00"
    });

    expect(lessonOverlapsVacationPeriod("2026-07-07T10:00:00", 60, period)).toBe(false);
    expect(lessonOverlapsVacationPeriod("2026-07-07T15:00:00", 60, period)).toBe(true);
    expect(lessonOverlapsVacationPeriod("2026-07-08T11:00:00", 60, period)).toBe(true);
    expect(lessonOverlapsVacationPeriod("2026-07-08T14:00:00", 60, period)).toBe(false);
    expect(isWithinVacation("2026-07-07T10:00:00", [period], 60)).toBe(false);
    expect(isWithinVacation("2026-07-08T14:00:00", [period], 60)).toBe(false);
  });

  test("normalizes vacation period with optional times", () => {
    expect(
      normalizeVacationPeriod({
        startsOn: "2026-07-01",
        endsOn: "2026-07-10",
        startsAtTime: "14:00",
        endsAtTime: "12:00"
      })
    ).toEqual({
      startsOn: "2026-07-01",
      endsOn: "2026-07-10",
      startsAtTime: "14:00",
      endsAtTime: "12:00"
    });
  });

  test("rejects invalid vacation ranges", () => {
    expect(() => normalizeVacationPeriod({ startsOn: "2026-07-10", endsOn: "2026-07-01" })).toThrow(
      "Vacation start date must be on or before the end date"
    );
    expect(() =>
      normalizeVacationPeriod({
        startsOn: "2026-07-07",
        endsOn: "2026-07-07",
        startsAtTime: "16:00",
        endsAtTime: "14:00"
      })
    ).toThrow("Vacation end time must be after the start time");
  });

  test("builds interval bounds for multi-day timed vacation", () => {
    const period = createPeriod({
      startsOn: "2026-07-01",
      endsOn: "2026-07-03",
      startsAtTime: "14:00",
      endsAtTime: "12:00"
    });
    const { start, end } = getVacationIntervalBounds(period);
    expect(toLocalDateKey(start)).toBe("2026-07-01");
    expect(start.getHours()).toBe(14);
    expect(toLocalDateKey(new Date(end.getTime() - 1))).toBe("2026-07-03");
    expect(end.getHours()).toBe(12);
  });

  test("computes day overlay for partial vacation", () => {
    const period = createPeriod({
      startsOn: "2026-07-07",
      endsOn: "2026-07-07",
      startsAtTime: "14:00",
      endsAtTime: "16:00"
    });
    const overlay = getVacationDayOverlay(new Date(2026, 6, 7), period);
    expect(overlay).toEqual({
      topMinutes: 14 * 60,
      heightMinutes: 120,
      isFullDay: false
    });
  });

  test("marks middle days as full-day vacation", () => {
    const period = createPeriod({
      startsOn: "2026-07-01",
      endsOn: "2026-07-03",
      startsAtTime: "14:00",
      endsAtTime: "12:00"
    });
    expect(vacationAffectsDay(new Date(2026, 6, 2), period)).toBe(true);
    expect(getVacationDayOverlay(new Date(2026, 6, 2), period)?.isFullDay).toBe(true);
  });
});
