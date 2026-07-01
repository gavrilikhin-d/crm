export function CurrentTimeMarker({ top }: { top: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-1 z-20 flex items-center" style={{ top }}>
      <span className="size-2 rounded-full bg-rose-500 shadow-sm" />
      <span className="h-0.5 flex-1 rounded-full bg-rose-500 shadow-sm" />
    </div>
  );
}
