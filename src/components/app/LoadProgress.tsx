/** Slim progress bar with a percentage, used while match data loads. */
export function LoadProgress({
  loaded,
  total,
  label = "Loading matches",
}: {
  loaded: number;
  total: number;
  label?: string;
}) {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.round((loaded / safeTotal) * 100));

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>{label}…</span>
        <span className="tabular text-foreground">{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
