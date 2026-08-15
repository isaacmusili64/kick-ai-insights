import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers } from "lucide-react";

import { ConfidenceBadge, EdgeBadge } from "./Badges";
import { Crest } from "./Crest";
import { LiveScoreline, StatusPill, resolveState } from "./LiveStatus";
import { ProbabilityBar } from "./ProbabilityBar";
import { bestEdge, EDGE_THRESHOLD } from "@/lib/edge";
import { kickoff } from "@/lib/format";
import { bestPick, headlinePicks, pct, type MarketId } from "@/lib/markets";
import type { FeedFixture } from "@/lib/types";

export function FixtureCard({ fixture, market }: { fixture: FeedFixture; market: MarketId }) {
  const p = fixture.prediction;
  const { state } = resolveState(fixture.status, fixture.utcDate, fixture.live);
  const goals =
    fixture.live && fixture.live.homeGoals !== null && fixture.live.awayGoals !== null
      ? { home: fixture.live.homeGoals, away: fixture.live.awayGoals }
      : null;

  const focus = p ? bestPick(market, p, fixture.home.name, fixture.away.name) : null;
  const chips = p ? headlinePicks(p, fixture.home.name, fixture.away.name) : [];
  const edge = p ? bestEdge(p, fixture.home.name, fixture.away.name) : null;

  return (
    <article className="card-surface overflow-hidden transition-shadow hover:shadow-lift">
      <Link
        to="/match/$matchId"
        params={{ matchId: String(fixture.id) }}
        className="block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="tabular text-[11px] font-semibold uppercase tracking-wide text-foreground">
            {kickoff(fixture.utcDate)}
          </span>
          <StatusPill status={fixture.status} utcDate={fixture.utcDate} live={fixture.live} />
          <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {fixture.competition}
          </span>
          {p ? <ConfidenceBadge confidence={p.confidence} /> : null}
        </div>

        <div className="mt-3 space-y-1.5">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Crest src={fixture[side].crest} name={fixture[side].name} />
                <span className="truncate text-sm font-semibold">{fixture[side].name}</span>
              </div>
              <span className="flex items-center gap-2">
                {goals ? (
                  <span className="tabular text-base font-bold">
                    {side === "home" ? goals.home : goals.away}
                  </span>
                ) : null}
                <span className="tabular text-xs text-muted-foreground">
                  {p
                    ? `${(side === "home" ? p.expectedHomeGoals : p.expectedAwayGoals).toFixed(2)} xG`
                    : "—"}
                </span>
              </span>
            </div>
          ))}
        </div>

        {p ? (
          <>
            <div className="mt-4">
              <ProbabilityBar
                home={p.homeWin}
                draw={p.draw}
                away={p.awayWin}
                homeName={fixture.home.name}
                awayName={fixture.away.name}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {focus ? (
                <span className="rounded-lg border border-primary/40 bg-primary/12 px-2 py-1 text-[11px] font-semibold text-primary">
                  {focus.label} · <span className="tabular">{pct(focus.probability)}</span>
                </span>
              ) : null}
              {chips
                .filter((c) => c.label !== focus?.label)
                .map((c) => (
                  <span
                    key={c.label}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {c.label} <span className="tabular text-foreground">{pct(c.probability)}</span>
                  </span>
                ))}
              <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground">
                Score <span className="tabular text-foreground">{p.topScores[0]?.score}</span>
              </span>
              {edge && edge.edge >= EDGE_THRESHOLD ? <EdgeBadge edge={edge.edge} /> : null}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            No standings data for this competition yet — the model needs a league table to price this
            fixture.
          </p>
        )}
      </Link>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/60 px-3 py-2 sm:px-4">
        <Link
          to="/acca"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Layers className="h-3.5 w-3.5" /> Today&apos;s accas
        </Link>
        <span className="flex items-center gap-2">
          {state === "live" || state === "finished" ? <LiveScoreline live={fixture.live} /> : null}
          <Link
            to="/match/$matchId"
            params={{ matchId: String(fixture.id) }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-primary"
          >
            Full analysis <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </span>
      </div>
    </article>
  );
}