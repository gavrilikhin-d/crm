export const DEFAULT_APP_TIMEZONE = "Europe/Minsk";

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveNotificationTimeZone(input: {
  studentTimeZone?: string | null;
  teacherTimeZone?: string | null;
  fallback?: string;
}): string {
  const studentTimeZone = input.studentTimeZone?.trim();
  if (studentTimeZone && isValidTimeZone(studentTimeZone)) {
    return studentTimeZone;
  }

  const teacherTimeZone = input.teacherTimeZone?.trim();
  if (teacherTimeZone && isValidTimeZone(teacherTimeZone)) {
    return teacherTimeZone;
  }

  const fallback = input.fallback?.trim();
  if (fallback && isValidTimeZone(fallback)) {
    return fallback;
  }

  return DEFAULT_APP_TIMEZONE;
}

export function formatInTimeZone(
  value: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("ru-RU", { ...options, timeZone }).format(new Date(value));
}

export function toDateKeyInTimeZone(value: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function sameDayInTimeZone(left: Date | string, right: Date | string, timeZone: string): boolean {
  return toDateKeyInTimeZone(left, timeZone) === toDateKeyInTimeZone(right, timeZone);
}

export function formatLessonTimeRangeInTimeZone(
  startsAt: Date | string,
  durationMinutes: number,
  timeZone: string
): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

export function formatLessonWhenInTimeZone(
  startsAt: Date | string,
  durationMinutes: number,
  timeZone: string,
  now: Date = new Date()
): string {
  const start = new Date(startsAt);
  const timeRange = formatLessonTimeRangeInTimeZone(start, durationMinutes, timeZone);
  const startKey = toDateKeyInTimeZone(start, timeZone);
  const nowKey = toDateKeyInTimeZone(now, timeZone);

  if (startKey === nowKey) {
    return `Сегодня · ${timeRange}`;
  }

  if (startKey === nextDateKey(nowKey)) {
    return `Завтра · ${timeRange}`;
  }

  const weekday = capitalize(
    formatInTimeZone(start, timeZone, {
      weekday: "short"
    })
  );
  const dayMonth = formatInTimeZone(start, timeZone, {
    day: "numeric",
    month: "short"
  });
  return `${weekday}, ${dayMonth} · ${timeRange}`;
}

export function formatLessonDateTimeInTimeZone(
  startsAt: Date | string,
  durationMinutes: number,
  timeZone: string
): { date: string; timeRange: string } {
  const start = new Date(startsAt);
  return {
    date: formatInTimeZone(start, timeZone, { dateStyle: "medium" }),
    timeRange: formatLessonTimeRangeInTimeZone(start, durationMinutes, timeZone)
  };
}

export function formatAttendanceWhenInTimeZone(startsAt: Date | string, timeZone: string): string {
  return formatInTimeZone(startsAt, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
