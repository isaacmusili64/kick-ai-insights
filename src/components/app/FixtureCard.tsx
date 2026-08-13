import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Check } from "lucide-react";

import { ConfidenceBadge, EdgeBadge } from "./Badges";
import { Crest } from "./Crest";
import { ProbabilityBar } from "./ProbabilityBar";
import { useAcca } from "@/lib/acca";
import { bestEdge, EDGE_THRESHOLD } from "@/lib/edge";
import { kickoff } from "@/lib/format";
import { bestPick, bestPickAnyMarket, headlinePicks, pct, type MarketId } from "@/lib/markets";
import { FREE_ACCA_SELECTIONS, usePro } from "@/lib/pro";
import type { FeedFixture } from "@/lib/types";

export function FixtureCard({
  fixture,
  market,
}: {
  fixture: FeedFixture;
  market: MarketId | "all";
}) {
  const p = fixture.prediction;
  const acca = useAcca();
  const { isPro } = usePro();

  const focus = p
    ? market === "all"
      ? bestPickAnyMarket(p, fixture.home.name, fixture.away.name, isPro)
      : bestPick(market, p, fixture.home.name, fixture.away.name)
    : null;
  const chips = p ? headlinePicks(p, fixture.home.name, fixture.away.name) : [];
  const edge = p ? bestEdge(p, fixture.home.name, fixture.away.name) : null;
  const selected = focus ? acca.has(fixture.id, focus.label) : false;
  const limited = !isPro && acca.selections.length >= FREE_ACCA_SELECTIONS && !selected;

  return (
    <article className="card-surface overflow-hidden transition-shadow hover:shadow-lift">
      <Link
        to="/match/$matchId"
        params={{ matchId: String(fixture.id) }}
        className="block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="tabular font-semibold text-foreground">{kickoff(fixture.utcDate)}</span>
            <span className="truncate">{fixture.competition}</span>
          </div>
          {p ? <ConfidenceBadge confidence={p.confidence} /> : null}
        </div>

        <div className="mt-3 space-y-1.5">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Crest src={fixture[side].crest} name={fixture[side].name} />
                <span className="truncate text-sm font-semibold">{fixture[side].name}</span>
              </div>
              <span className="tabular text-xs text-muted-foreground">
                {p ? `${(side === "home" ? p.expectedHomeGoals : p.expectedAwayGoals).toFixed(2)} xG` : "—"}
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

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/60 px-4 py-2">
        <button
          type="button"
          disabled={!focus || limited}
          onClick={() => {
            if (!focus) return;
            if (selected) acca.remove(fixture.id, focus.label);
            else
              acca.add({
                matchId: fixture.id,
                fixture: `${fixture.home.name} v ${fixture.away.name}`,
                market: focus.market,
                label: focus.label,
                probability: focus.probability,
              });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5" />}
          {selected ? "In acca" : limited ? `Free limit ${FREE_ACCA_SELECTIONS}` : "Add to acca"}
        </button>
        <Link
          to="/match/$matchId"
          params={{ matchId: String(fixture.id) }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Full analysis <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}