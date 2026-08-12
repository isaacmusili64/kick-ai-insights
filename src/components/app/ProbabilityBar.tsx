import { pct } from "@/lib/markets";

type Props = {
  home: number;
  draw: number;
  away: number;
  homeName: string;
  awayName: string;
  size?: "sm" | "lg";
};

export function ProbabilityBar({ home, draw, away, homeName, awayName, size = "sm" }: Props) {
  const total = home + draw + away || 1;
  const w = (n: number) => `${(n / total) * 100}%`;
  const top = Math.max(home, draw, away);

  const value = (n: number, name: string, tone: string) => (
    <div className="min-w-0">
      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{name}</p>
      <p
        className={`tabular font-semibold ${tone} ${
          size === "lg" ? "text-3xl sm:text-4xl" : "text-lg"
        } ${n === top ? "" : "opacity-70"}`}
      >
        {pct(n)}
      </p>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
        {value(home, homeName, "text-home")}
        <div className="text-center">{value(draw, "Draw", "text-foreground")}</div>
        <div className="text-right">{value(away, awayName, "text-away")}</div>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
        <div className="bg-home transition-[width] duration-500" style={{ width: w(home) }} />
        <div className="bg-draw/70 transition-[width] duration-500" style={{ width: w(draw) }} />
        <div className="bg-away transition-[width] duration-500" style={{ width: w(away) }} />
      </div>
    </div>
  );
}