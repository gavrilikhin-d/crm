import { afterEach, describe, expect, test } from "bun:test";
import { hourHeight } from "../../dashboard/constants";
import { getLessonStartsAtFromOffset, toIsoFromDateTimeLocal } from "./datetime-local";

const fullDayCalendarRange = {
  startHour: 0,
  endHour: 24
};

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("toIsoFromDateTimeLocal", () => {
  test("converts local datetime string to UTC ISO", () => {
    process.env.TZ = "Europe/Moscow";
    expect(toIsoFromDateTimeLocal("2024-04-01T10:00")).toBe("2024-04-01T07:00:00.000Z");
  });

  test("keeps UTC ISO strings unchanged", () => {
    expect(toIsoFromDateTimeLocal("2024-04-01T07:00:00.000Z")).toBe("2024-04-01T07:00:00.000Z");
  });
});

describe("lesson drag reschedule timezone", () => {
  test("dropping a lesson at 10:00 local stays at 10:00 after save", () => {
    process.env.TZ = "Europe/Moscow";

    const day = new Date(2024, 3, 1);
    const draggedStartsAt = getLessonStartsAtFromOffset(day, 10 * hourHeight, 60, fullDayCalendarRange);
    expect(draggedStartsAt).toBe("2024-04-01T10:00");

    const storedStartsAt = toIsoFromDateTimeLocal(draggedStartsAt);
    expect(storedStartsAt).toBe("2024-04-01T07:00:00.000Z");

    const displayed = new Date(storedStartsAt);
    expect(displayed.getHours()).toBe(10);
    expect(displayed.getMinutes()).toBe(0);
  });

  test("sending unconverted drag time to a UTC server would shift lesson to 13:00", () => {
    process.env.TZ = "Europe/Moscow";

    const day = new Date(2024, 3, 1);
    const draggedStartsAt = getLessonStartsAtFromOffset(day, 10 * hourHeight, 60, fullDayCalendarRange);

    process.env.TZ = "UTC";
    const buggyStoredStartsAt = new Date(draggedStartsAt).toISOString();
    process.env.TZ = "Europe/Moscow";

    expect(new Date(buggyStoredStartsAt).getHours()).toBe(13);
  });
});
