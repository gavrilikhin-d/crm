function formatCurrentTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function CurrentTimeMarker({ top, currentTime }: { top: number; currentTime: Date }) {
  return (
    <div className="pointer-events-none absolute inset-x-1 z-20 flex -translate-y-1/2 items-center gap-1" style={{ top }}>
      <span className="rounded-full bg-background px-1 text-[0.65rem] font-semibold leading-none text-rose-600 shadow-sm">
        {formatCurrentTime(currentTime)}
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-rose-500 shadow-sm" />
    </div>
  );
}
