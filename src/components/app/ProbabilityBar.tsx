type Props = {
  home: number;
  draw: number;
  away: number;
};

export function ProbabilityBar({ home, draw, away }: Props) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: pct(home) }} />
        <div className="bg-gold" style={{ width: pct(draw) }} />
        <div className="bg-foreground/70" style={{ width: pct(away) }} />
      </div>
      <div className="mt-2 flex justify-between text-xs tabular text-muted-foreground">
        <span className="font-medium text-primary">Home {pct(home)}</span>
        <span className="font-medium text-foreground">Draw {pct(draw)}</span>
        <span className="font-medium text-foreground">Away {pct(away)}</span>
      </div>
    </div>
  );
}