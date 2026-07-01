export function PlanUsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const value = limit === null ? `${used} / ∞` : `${used} / ${limit}`;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
