import { hourHeight } from "../../dashboard/constants";
import type { CalendarRange } from "../../dashboard/types";

export function formatDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function toIsoFromDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid datetime");
  }
  return date.toISOString();
}

export function getLessonStartsAtFromOffset(
  day: Date,
  offset: number,
  durationMinutes: number,
  calendarRange: Pick<CalendarRange, "startHour" | "endHour">
): string {
  const snapMinutes = 5;
  const offsetMinutes = Math.round(((offset / hourHeight) * 60) / snapMinutes) * snapMinutes;
  const minMinutes = calendarRange.startHour * 60;
  const maxMinutes = Math.max(minMinutes, calendarRange.endHour * 60 - durationMinutes);
  const startsAtMinutes = Math.min(Math.max(minMinutes + offsetMinutes, minMinutes), maxMinutes);
  const startsAt = new Date(day);
  startsAt.setHours(0, startsAtMinutes, 0, 0);

  return formatDateTimeLocal(startsAt);
}
