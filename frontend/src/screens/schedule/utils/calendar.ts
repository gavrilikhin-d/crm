import { formatTime } from "@/i18n/format";
import type { Locale } from "@/i18n/locale";
import type { Lesson } from "@crm/shared";
import { hourHeight } from "@/screens/dashboard/constants";
import type { CalendarRange, ScheduleView } from "@/screens/dashboard/types";

export type LessonLayout = {
  lesson: Lesson;
  lane: number;
  lanes: number;
};

export function getWeekDays(baseDate: Date): Date[] {
  const monday = startOfDay(baseDate);
  const day = baseDate.getDay() || 7;
  monday.setDate(baseDate.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

export function getMonthGridDays(baseDate: Date): Date[] {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = startOfDay(firstOfMonth);
  const day = firstOfMonth.getDay() || 7;
  gridStart.setDate(firstOfMonth.getDate() - day + 1);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addToDate(value: Date, view: ScheduleView, direction: -1 | 1): Date {
  const date = startOfDay(value);
  if (view === "day") {
    date.setDate(date.getDate() + direction);
  }
  if (view === "week") {
    date.setDate(date.getDate() + direction * 7);
  }
  if (view === "month") {
    date.setMonth(date.getMonth() + direction);
  }
  return date;
}

export function sameDate(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

const fullDayCalendarRange: CalendarRange = {
  startHour: 0,
  endHour: 24,
  hours: Array.from({ length: 24 }, (_, index) => index)
};

export function getDefaultLessonStartsAt(date: Date): string {
  return formatDateTimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0));
}

export function formatDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function getCalendarRangeWithCurrentTime(
  _lessons: Lesson[],
  _referenceDate: Date,
  _currentTime: Date | null
): CalendarRange {
  return fullDayCalendarRange;
}

export function getCalendarScrollAnchor(
  calendarRange: CalendarRange,
  lessons: Lesson[],
  anchorDate: Date,
  currentTime: Date | null
): number {
  const now = currentTime ?? new Date();
  const anchor = new Date(anchorDate);
  anchor.setHours(now.getHours(), now.getMinutes(), 0, 0);
  const currentOffset = getCurrentTimeOffset(anchor, calendarRange);
  if (currentOffset !== null) {
    return currentOffset;
  }

  if (lessons.length > 0) {
    const firstLesson = lessons.reduce((earliest, lesson) =>
      new Date(lesson.startsAt).getTime() < new Date(earliest.startsAt).getTime() ? lesson : earliest
    );
    return getLessonPosition(firstLesson, calendarRange).top;
  }

  return 0;
}

export function getCurrentTimeOffset(value: Date, calendarRange: CalendarRange): number | null {
  const currentMinutes = value.getHours() * 60 + value.getMinutes();
  const calendarStartMinutes = calendarRange.startHour * 60;
  const calendarEndMinutes = calendarRange.endHour * 60;

  if (currentMinutes < calendarStartMinutes || currentMinutes >= calendarEndMinutes) {
    return null;
  }

  return ((currentMinutes - calendarStartMinutes) / 60) * hourHeight;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function getLessonPosition(lesson: Lesson, calendarRange: CalendarRange) {
  const startsAt = new Date(lesson.startsAt);
  const startsAtMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const top = ((startsAtMinutes - calendarRange.startHour * 60) / 60) * hourHeight;
  const height = (lesson.durationMinutes / 60) * hourHeight;

  return { top, height };
}

export function getLessonStartsAtFromOffset(
  day: Date,
  offset: number,
  durationMinutes: number,
  calendarRange: CalendarRange
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

export function formatTimeRange(start: Date, durationMinutes: number, locale?: Locale): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}

function getLessonTimeRange(lesson: Lesson): { start: number; end: number } {
  const start = new Date(lesson.startsAt).getTime();
  return {
    start,
    end: start + lesson.durationMinutes * 60_000
  };
}

function lessonsOverlap(first: Lesson, second: Lesson): boolean {
  const firstRange = getLessonTimeRange(first);
  const secondRange = getLessonTimeRange(second);
  return firstRange.start < secondRange.end && firstRange.end > secondRange.start;
}

export function getLessonLayouts(lessons: Lesson[]): LessonLayout[] {
  const sortedLessons = [...lessons].sort((first, second) => {
    const firstRange = getLessonTimeRange(first);
    const secondRange = getLessonTimeRange(second);
    return firstRange.start - secondRange.start || firstRange.end - secondRange.end;
  });
  const layouts: LessonLayout[] = [];
  let activeCluster: LessonLayout[] = [];
  let activeClusterEnd = 0;

  const flushCluster = () => {
    if (activeCluster.length === 0) {
      return;
    }

    const lanes = Math.max(...activeCluster.map((item) => item.lane)) + 1;
    activeCluster.forEach((item) => {
      item.lanes = lanes;
    });
    activeCluster = [];
    activeClusterEnd = 0;
  };

  for (const lesson of sortedLessons) {
    const range = getLessonTimeRange(lesson);
    if (activeCluster.length > 0 && range.start >= activeClusterEnd) {
      flushCluster();
    }

    const usedLanes = new Set(
      activeCluster.filter((item) => lessonsOverlap(item.lesson, lesson)).map((item) => item.lane)
    );
    let lane = 0;
    while (usedLanes.has(lane)) {
      lane += 1;
    }

    const layout = { lesson, lane, lanes: 1 };
    layouts.push(layout);
    activeCluster.push(layout);
    activeClusterEnd = Math.max(activeClusterEnd, range.end);
  }

  flushCluster();

  return layouts;
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getVacationWatermarkStyle(label: string): {
  backgroundImage: string;
  backgroundSize: string;
} {
  const text = escapeSvgText(label.toUpperCase());
  const fontSize = 10;
  const padding = 14;
  const charWidth = 7.2;
  const labelWidth = text.length * charWidth + 8;
  const angleRadians = (40 * Math.PI) / 180;
  const textExtentX = labelWidth * Math.cos(angleRadians) + fontSize * Math.sin(angleRadians);
  const textExtentY = labelWidth * Math.sin(angleRadians) + fontSize * Math.cos(angleRadians);
  const tileWidth = Math.ceil(2 * (textExtentX + padding) + padding);
  const tileHeight = Math.ceil(textExtentY * 2 + padding * 2);
  const rowOneX = padding;
  const rowOneY = tileHeight - padding;
  const rowTwoX = Math.round(tileWidth / 2);
  const rowTwoY = Math.round(tileHeight / 2);
  const textAttrs = `fill='rgba(14,165,233,0.15)' font-size='${fontSize}' font-weight='600' font-family='system-ui,-apple-system,sans-serif' letter-spacing='0.08em'`;
  const svg = [
    `<svg xmlns='http://www.w3.org/2000/svg' width='${tileWidth}' height='${tileHeight}' viewBox='0 0 ${tileWidth} ${tileHeight}'>`,
    `<text x='${rowOneX}' y='${rowOneY}' ${textAttrs} transform='rotate(-40 ${rowOneX} ${rowOneY})'>${text}</text>`,
    `<text x='${rowTwoX}' y='${rowTwoY}' ${textAttrs} transform='rotate(-40 ${rowTwoX} ${rowTwoY})'>${text}</text>`,
    "</svg>"
  ].join("");

  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${tileWidth}px ${tileHeight}px`
  };
}
