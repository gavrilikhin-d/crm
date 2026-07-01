import type { CalendarRange } from "@/screens/dashboard/types";
import { formatHour } from "@/screens/schedule/utils/calendar";

export function TimeAxis({ calendarRange }: { calendarRange: CalendarRange }) {
  return (
    <div className="col-start-1 row-start-2">
      {calendarRange.hours.map((hour) => (
        <div className="h-[76px] pt-1 text-xs font-bold text-stone-400" key={hour}>
          {formatHour(hour)}
        </div>
      ))}
    </div>
  );
}
