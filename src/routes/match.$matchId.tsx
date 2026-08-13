import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfidenceBadge, EdgeBadge, ProBadge } from "@/components/app/Badges";
import { Crest } from "@/components/app/Crest";
import { FormPips } from "@/components/app/FormPips";
import { ProbabilityBar } from "@/components/app/ProbabilityBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcca } from "@/lib/acca";
import { edgeRows } from "@/lib/edge";
import { fixtureDateLine } from "@/lib/format";
import { getAiInsight, getAnalysis } from "@/lib/football.functions";
import { useHistory } from "@/lib/history";
import { MARKETS, pct, picksFor, type MarketId } from "@/lib/markets";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Match analysis — PitchModel" },
      {
        name: "description",
        content:
          "Full model breakdown for this fixture: win probabilities, expected goals, correct score grid, every market and AI analysis.",
      },
      { property: "og:title", content: "Match analysis — PitchModel" },
      {
        property: "og:description",
        content: "Model probabilities across ten markets, model edge and AI analysis for this fixture.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function Panel({ title, children, pro }: { title: string; children: React.ReactNode; pro?: boolean }) {
  return (
    <section className="card-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
        {title} {pro ? <ProBadge /> : null}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MatchPage() {
  const { matchId } = Route.useParams();
  const id = Number(matchId);
  const { isPro } = usePro();
  const acca = useAcca();
  const history = useHistory();
  const [market, setMarket] = useState<MarketId>("1x2");

  const analysisFn = useServerFn(getAnalysis);
  const insightFn = useServerFn(getAiInsight);

  const { data, isPending } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => analysisFn({ data: { matchId: id } }),
    staleTime: 5 * 60_000,
  });

  const insight = useMutation({
    mutationFn: (payload: string) => insightFn({ data: { matchId: id, payload } }),
  });

  const fixture = data?.fixture;
  const p = data?.prediction;

  useEffect(() => {
    if (!fixture || !p) return;
    history.log({
      matchId: fixture.id,
      home: fixture.home.name,
      away: fixture.away.name,
      competition: fixture.competition,
      utcDate: fixture.utcDate,
      homeWin: p.homeWin,
      draw: p.draw,
      awayWin: p.awayWin,
      confidence: p.confidence,
    });
    // Only log once per fixture load — history.log itself dedupes by matchId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture?.id, p]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </main>
    );
  }

  if (!fixture || !p) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Model unavailable for this fixture</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live data is rate limited on the free tier, or this competition has no league table to fit
          the model to.
        </p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to predictions
        </Link>
      </main>
    );
  }

  const rows = edgeRows(p, fixture.home.name, fixture.away.name);
  const picks = picksFor(market, p, fixture.home.name, fixture.away.name);
  const maxCell = Math.max(...p.scoreMatrix.flat());

  const payload = [
    `Fixture: ${fixture.home.name} vs ${fixture.away.name} (${fixture.competition}, ${fixture.utcDate})`,
    `Model: home ${pct(p.homeWin)}, draw ${pct(p.draw)}, away ${pct(p.awayWin)}, confidence ${p.confidence}/100`,
    `Expected goals ${p.expectedHomeGoals.toFixed(2)} - ${p.expectedAwayGoals.toFixed(2)}; over 2.5 ${pct(p.over25)}, BTTS ${pct(p.bttsYes)}`,
    `Likely scores: ${p.topScores.map((s) => `${s.score} ${pct(s.probability)}`).join(", ")}`,
    data?.table?.home
      ? `Table: ${fixture.home.name} P${data.table.home.position} ${data.table.home.points}pts (${data.table.home.goalsFor}:${data.table.home.goalsAgainst}); ${fixture.away.name} P${data.table.away?.position ?? "?"} ${data.table.away?.points ?? "?"}pts`
      : "Table: unavailable",
    `Model edge vs market baseline: ${rows.map((r) => `${r.label} ${(r.edge * 100).toFixed(1)}%`).join(", ")}`,
  ].join("\n");

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 pb-24">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All fixtures
      </Link>

      <header className="card-surface p-5 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {fixture.competition} · {fixtureDateLine(fixture.utcDate)}
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
              <Crest src={fixture.home.crest} name={fixture.home.name} />
              {fixture.home.name}
              <span className="text-muted-foreground">v</span>
              <Crest src={fixture.away.crest} name={fixture.away.name} />
              {fixture.away.name}
            </h1>
          </div>
          <ConfidenceBadge confidence={p.confidence} />
        </div>
        <div className="mt-5">
          <ProbabilityBar
            home={p.homeWin}
            draw={p.draw}
            away={p.awayWin}
            homeName={fixture.home.name}
            awayName={fixture.away.name}
            size="lg"
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Expected goals", `${p.expectedHomeGoals.toFixed(2)} – ${p.expectedAwayGoals.toFixed(2)}`],
            ["Most likely score", p.topScores[0]?.score ?? "—"],
            ["Over 2.5", pct(p.over25)],
            ["BTTS", pct(p.bttsYes)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="tabular mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </header>

      <Panel title="Markets">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          {MARKETS.map((m) => {
            const locked = m.pro && !isPro;
            return (
              <button
                key={m.id}
                onClick={() => !locked && setMarket(m.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  market === m.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                } ${locked ? "opacity-50" : ""}`}
              >
                {locked ? <Lock className="mr-1 inline h-3 w-3" /> : null}
                {m.short}
              </button>
            );
          })}
        </div>
        <ul className="mt-3 space-y-2">
          {picks.map((pick) => (
            <li
              key={pick.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pick.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{pick.explain}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular text-lg font-bold">{pct(pick.probability)}</span>
                <Button
                  size="sm"
                  variant={acca.has(fixture.id, pick.label) ? "secondary" : "outline"}
                  onClick={() =>
                    acca.has(fixture.id, pick.label)
                      ? acca.remove(fixture.id, pick.label)
                      : acca.add({
                          matchId: fixture.id,
                          fixture: `${fixture.home.name} v ${fixture.away.name}`,
                          market: pick.market,
                          label: pick.label,
                          probability: pick.probability,
                        })
                  }
                >
                  {acca.has(fixture.id, pick.label) ? "In acca" : "Add"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Model edge">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 text-left font-medium">Outcome</th>
              <th className="pb-2 text-right font-medium">Model</th>
              <th className="pb-2 text-right font-medium">Market</th>
              <th className="pb-2 text-right font-medium">Fair odds</th>
              <th className="pb-2 text-right font-medium">Edge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/60">
                <td className="py-2 font-medium">{r.label}</td>
                <td className="tabular py-2 text-right">{pct(r.model)}</td>
                <td className="tabular py-2 text-right text-muted-foreground">{pct(r.implied)}</td>
                <td className="tabular py-2 text-right">{r.fairOdds.toFixed(2)}</td>
                <td className="py-2 text-right">
                  <EdgeBadge edge={r.edge} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Market column is a transparent baseline: model probabilities shrunk toward league averages
          with a 5% overround. PitchModel has no live odds feed.
        </p>
      </Panel>

      <Panel title="Correct score grid">
        <div className="overflow-x-auto">
          <div className="inline-grid grid-cols-[auto_repeat(6,minmax(2.5rem,1fr))] gap-1 text-[11px]">
            <span />
            {[0, 1, 2, 3, 4, 5].map((a) => (
              <span key={a} className="text-center text-muted-foreground">
                {a}
              </span>
            ))}
            {p.scoreMatrix.slice(0, 6).map((row, h) => (
              <div key={h} className="contents">
                <span className="pr-1 text-right text-muted-foreground">{h}</span>
                {row.slice(0, 6).map((cell, a) => (
                  <span
                    key={a}
                    className="tabular grid aspect-square place-items-center rounded-md border border-border/60 font-semibold"
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round((cell / maxCell) * 70)}%, transparent)`,
                    }}
                    title={`${h}-${a}: ${pct(cell)}`}
                  >
                    {Math.round(cell * 100)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Rows: {fixture.home.name} goals. Columns: {fixture.away.name} goals. Values are percentages.
        </p>
      </Panel>

      <Panel title="AI analysis">
        <Button onClick={() => insight.mutate(payload)} disabled={insight.isPending} size="sm">
          <Sparkles className="h-4 w-4" />
          {insight.isPending ? "Analysing…" : insight.data?.insight ? "Regenerate" : "Generate analysis"}
        </Button>
        {insight.data?.insight ? (
          <div className="mt-4 space-y-3 text-sm leading-relaxed">
            {insight.data.insight
              .split("\n")
              .filter(Boolean)
              .map((par, i) => (
                <p key={i}>{par}</p>
              ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {insight.data?.error ?? "Turn the model output into a readable read on the game."}
          </p>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["home", "away"] as const).map((side) => {
          const row = side === "home" ? data?.table?.home : data?.table?.away;
          const history = side === "home" ? data?.history.home ?? [] : data?.history.away ?? [];
          return (
            <Panel key={side} title={fixture[side].name}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Recent form</span>
                <FormPips form={history.map((m) => m.result)} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                {[
                  ["League position", row ? `${row.position}` : "—"],
                  ["Points", row ? `${row.points} in ${row.playedGames}` : "—"],
                  ["Goals for / against", row ? `${row.goalsFor} : ${row.goalsAgainst}` : "—"],
                  [
                    "Model xG this game",
                    (side === "home" ? p.expectedHomeGoals : p.expectedAwayGoals).toFixed(2),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-border/50 pb-1">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          );
        })}
      </div>

      {data?.h2h?.length ? (
        <Panel title="Head to head">
          <ul className="space-y-1 text-sm">
            {data.h2h.map((m) => (
              <li key={`${m.date}-${m.score}`} className="flex justify-between border-b border-border/50 pb-1">
                <span className="truncate">
                  {m.home} v {m.away}
                </span>
                <span className="tabular text-muted-foreground">
                  {m.score} · {new Date(m.date).getFullYear()}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </main>
  );
}