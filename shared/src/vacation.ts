import type { VacationPeriod } from "./types";

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateKey(value: string): boolean {
  if (!dateKeyPattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year!, month! - 1, day);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day;
}

export function isValidTimeKey(value: string): boolean {
  return timePattern.test(value);
}

export function toLocalDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateTimeLocal(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year!, month! - 1, day!, hours, minutes, 0, 0);
}

function startOfLocalDay(value: string | Date): Date {
  const dateKey = toLocalDateKey(value);
  return parseDateTimeLocal(dateKey, "00:00");
}

export function getVacationIntervalBounds(period: VacationPeriod): { start: Date; end: Date } {
  const start = parseDateTimeLocal(period.startsOn, period.startsAtTime ?? "00:00");
  let end: Date;

  if (period.endsAtTime) {
    end = parseDateTimeLocal(period.endsOn, period.endsAtTime);
    end.setMinutes(end.getMinutes() + 1);
  } else {
    end = parseDateTimeLocal(period.endsOn, "00:00");
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function vacationAffectsDay(day: Date | string, period: VacationPeriod): boolean {
  const dayStart = startOfLocalDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const { start, end } = getVacationIntervalBounds(period);
  return start < dayEnd && end > dayStart;
}

export function lessonOverlapsVacationPeriod(
  lessonStartsAt: string,
  durationMinutes: number,
  period: VacationPeriod
): boolean {
  const lessonStart = new Date(lessonStartsAt);
  const lessonEnd = new Date(lessonStart.getTime() + durationMinutes * 60_000);
  const { start, end } = getVacationIntervalBounds(period);
  return lessonStart < end && start < lessonEnd;
}

export function lessonOverlapsVacation(
  lessonStartsAt: string,
  durationMinutes: number,
  vacationPeriods: VacationPeriod[]
): boolean {
  return vacationPeriods.some((period) => lessonOverlapsVacationPeriod(lessonStartsAt, durationMinutes, period));
}

export function isWithinVacation(
  lessonStartsAt: string,
  vacationPeriods: VacationPeriod[],
  durationMinutes = 60
): boolean {
  return lessonOverlapsVacation(lessonStartsAt, durationMinutes, vacationPeriods);
}

export function getVacationPeriodForDate(
  value: string | Date,
  vacationPeriods: VacationPeriod[]
): VacationPeriod | undefined {
  return vacationPeriods.find((period) => vacationAffectsDay(value, period));
}

export type VacationDayOverlay = {
  topMinutes: number;
  heightMinutes: number;
  isFullDay: boolean;
};

export function getVacationDayOverlay(day: Date | string, period: VacationPeriod): VacationDayOverlay | null {
  if (!vacationAffectsDay(day, period)) {
    return null;
  }

  const dayStart = startOfLocalDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dateKey = toLocalDateKey(day);
  const { start, end } = getVacationIntervalBounds(period);
  const overlapStart = new Date(Math.max(dayStart.getTime(), start.getTime()));
  const overlapEnd = new Date(Math.min(dayEnd.getTime(), end.getTime()));

  if (overlapStart >= overlapEnd) {
    return null;
  }

  const startMinutes = overlapStart.getHours() * 60 + overlapStart.getMinutes();
  let endMinutes =
    overlapEnd.getTime() === dayEnd.getTime()
      ? 24 * 60
      : overlapEnd.getHours() * 60 + overlapEnd.getMinutes();

  if (period.endsAtTime && dateKey === period.endsOn) {
    const [hours, minutes] = period.endsAtTime.split(":").map(Number);
    endMinutes = hours! * 60 + minutes!;
  }

  const isMiddleDay = dateKey > period.startsOn && dateKey < period.endsOn;
  const isFullDay =
    isMiddleDay || (!period.startsAtTime && !period.endsAtTime) || endMinutes - startMinutes >= 23 * 60;

  return {
    topMinutes: startMinutes,
    heightMinutes: Math.max(0, endMinutes - startMinutes),
    isFullDay
  };
}

export function formatVacationTime(time: string): string {
  return time;
}

export function normalizeVacationPeriod(input: {
  startsOn: string;
  endsOn: string;
  startsAtTime?: string;
  endsAtTime?: string;
}): Pick<VacationPeriod, "startsOn" | "endsOn" | "startsAtTime" | "endsAtTime"> {
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn.trim();
  const startsAtTime = input.startsAtTime?.trim() || undefined;
  const endsAtTime = input.endsAtTime?.trim() || undefined;

  if (!isValidDateKey(startsOn) || !isValidDateKey(endsOn)) {
    throw new Error("Vacation dates must use YYYY-MM-DD format");
  }

  if (startsOn > endsOn) {
    throw new Error("Vacation start date must be on or before the end date");
  }

  if (startsAtTime && !isValidTimeKey(startsAtTime)) {
    throw new Error("Vacation start time must use HH:mm format");
  }

  if (endsAtTime && !isValidTimeKey(endsAtTime)) {
    throw new Error("Vacation end time must use HH:mm format");
  }

  if (startsOn === endsOn && startsAtTime && endsAtTime && startsAtTime >= endsAtTime) {
    throw new Error("Vacation end time must be after the start time");
  }

  const { start, end } = getVacationIntervalBounds({
    id: "validation",
    startsOn,
    endsOn,
    startsAtTime,
    endsAtTime,
    createdAt: "",
    updatedAt: ""
  });

  if (start >= end) {
    throw new Error("Vacation period must have a positive duration");
  }

  return { startsOn, endsOn, startsAtTime, endsAtTime };
}
