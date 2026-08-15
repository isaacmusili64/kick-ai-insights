import { stateFromFixture, stateLabel, type LiveScore, type MatchState } from "@/lib/live";

export function resolveState(
  status: string,
  utcDate: string,
  live?: LiveScore | null,
): { state: MatchState; detail: string | null } {
  if (live && live.state !== "scheduled") return { state: live.state, detail: live.detail };
  return { state: stateFromFixture(status, utcDate), detail: live?.detail ?? null };
}

const TONE: Record<MatchState, string> = {
  live: "border-destructive/50 bg-destructive/12 text-destructive",
  soon: "border-gold/50 bg-gold/12 text-gold",
  finished: "border-border bg-secondary text-muted-foreground",
  postponed: "border-border bg-secondary text-muted-foreground",
  scheduled: "border-border bg-secondary text-muted-foreground",
};

export function StatusPill({
  status,
  utcDate,
  live,
  className = "",
}: {
  status: string;
  utcDate: string;
  live?: LiveScore | null;
  className?: string;
}) {
  const { state, detail } = resolveState(status, utcDate, live);
  const label = state === "scheduled" ? "Not started" : stateLabel(state, detail, utcDate);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[state]} ${className}`}
    >
      {state === "live" ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
        </span>
      ) : null}
      {label}
    </span>
  );
}

/** Live/final scoreline, or null when the match hasn't produced one yet. */
export function LiveScoreline({
  live,
  className = "",
}: {
  live?: LiveScore | null;
  className?: string;
}) {
  if (!live || live.homeGoals === null || live.awayGoals === null) return null;
  return (
    <span className={`tabular rounded-lg bg-secondary px-2 py-0.5 text-sm font-bold ${className}`}>
      {live.homeGoals}–{live.awayGoals}
    </span>
  );
}