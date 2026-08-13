import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { COMPETITION_LIST, FREE_CODES, competitionName } from "@/lib/competitions";
import { getPerformance } from "@/lib/performance.functions";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Model performance history — PitchModel" },
      {
        name: "description",
        content:
          "How accurate are PitchModel predictions? Hit rate by market, calibration by probability band and every graded pick from matches already played.",
      },
      { property: "og:title", content: "Model performance history — PitchModel" },
      {
        property: "og:description",
        content:
          "Public scorecard: hit rate by market, predicted vs actual, goal-line accuracy and recent graded picks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TrackedRecord() {
  const { data, isPending } = useQuery({
    queryKey: ["tracked-performance"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("prediction_log")
        .select("market, pick, probability, correct, kickoff, home_team, away_team, actual_home, actual_away")
        .eq("status", "graded")
        .order("kickoff", { ascending: false })
        .limit(300);
      return rows ?? [];
    },
  });

  if (isPending) return <Skeleton className="h-32 rounded-2xl" />;
  const rows = data ?? [];

  if (!rows.length) {
    return (
      <p className="card-surface p-5 text-sm text-muted-foreground">
        Tracked results start building from today. Every prediction published on the board is stored
        and graded once the match finishes, so this table grows day by day. Until then the backtest
        below shows how the model scores on matches already played.
      </p>
    );
  }

  const hit = rows.filter((r) => r.correct).length / rows.length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Graded picks" value={String(rows.length)} />
        <Stat label="Hit rate" value={pct(hit)} hint="Tracked live since launch" />
        <Stat
          label="Average confidence"
          value={pct(rows.reduce((s, r) => s + Number(r.probability), 0) / rows.length)}
        />
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.slice(0, 20).map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.kickoff).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </td>
                <td className="px-3 py-2">
                  {r.home_team} v {r.away_team}
                </td>
                <td className="px-3 py-2 font-semibold">{r.pick}</td>
                <td className="tabular px-3 py-2 text-muted-foreground">{pct(Number(r.probability))}</td>
                <td className="tabular px-3 py-2">
                  {r.actual_home}-{r.actual_away}
                </td>
                <td className={`px-3 py-2 font-bold ${r.correct ? "text-home" : "text-destructive"}`}>
                  {r.correct ? "Hit" : "Miss"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerformancePage() {
  const { isPro } = usePro();
  const [code, setCode] = useState<string>(FREE_CODES[0] ?? "PL");
  const perfFn = useServerFn(getPerformance);

  const { data, isPending } = useQuery({
    queryKey: ["performance", code],
    staleTime: 30 * 60_000,
    queryFn: () => perfFn({ data: { codes: [code], days: 150 } }),
  });

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 pb-24">
      <header>
        <h1 className="text-3xl font-bold">How the predictions have done</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Two scorecards, both public. Tracked results grade every prediction we publish once the
          match ends. The season check re-runs the model over matches already played, so you can see
          the hit rate before you trust a pick.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">Tracked results</h2>
        <TrackedRecord />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Season check</h2>
          <select
            className="rounded-lg border border-border bg-card px-2.5 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            {COMPETITION_LIST.map((c) => (
              <option key={c.code} value={c.code} disabled={!c.free && !isPro}>
                {c.name}
                {!c.free && !isPro ? " · Pro" : ""}
              </option>
            ))}
          </select>
        </div>

        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : !data || data.matches === 0 ? (
          <p className="card-surface p-5 text-sm text-muted-foreground">
            No finished matches to score in {competitionName(code)} yet. Try another competition, or
            come back once more of the season has been played.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Matches scored" value={String(data.matches)} hint={competitionName(code)} />
              <Stat
                label="Match result hit rate"
                value={pct(data.markets.find((m) => m.market === "1x2")?.hitRate ?? 0)}
                hint={`Model expected ${pct(data.markets.find((m) => m.market === "1x2")?.expected ?? 0)}`}
              />
              <Stat
                label="Goals line hit rate"
                value={pct(data.markets.find((m) => m.market === "ou25")?.hitRate ?? 0)}
                hint="Over / under 2.5 calls"
              />
              <Stat
                label="Goals off per match"
                value={data.goalsError.toFixed(2)}
                hint="Predicted vs actual goals"
              />
            </div>

            <div className="card-surface overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-semibold">Market</th>
                    <th className="px-3 py-2 font-semibold">Picks</th>
                    <th className="px-3 py-2 font-semibold">Hit rate</th>
                    <th className="px-3 py-2 font-semibold">Model said</th>
                    <th className="px-3 py-2 font-semibold">Accuracy score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.markets.map((m) => (
                    <tr key={m.market} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-semibold">{m.label}</td>
                      <td className="tabular px-3 py-2">{m.picks}</td>
                      <td className="tabular px-3 py-2 font-bold text-primary">{pct(m.hitRate)}</td>
                      <td className="tabular px-3 py-2 text-muted-foreground">{pct(m.expected)}</td>
                      <td className="tabular px-3 py-2 text-muted-foreground">{m.brier.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-surface p-4">
              <h3 className="text-sm font-bold">Are the percentages honest?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                When the model says 60%, roughly 60% of those picks should land.
              </p>
              <ul className="mt-3 space-y-2">
                {data.confidence.map((b) => (
                  <li key={b.band} className="grid grid-cols-[5rem_minmax(0,1fr)_3rem] items-center gap-3">
                    <span className="tabular text-xs font-semibold">{b.band}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, b.hitRate * 100)}%` }}
                      />
                    </span>
                    <span className="tabular text-right text-xs">{pct(b.hitRate)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-surface overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.recent.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(r.date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2">{r.fixture}</td>
                      <td className="px-3 py-2 font-semibold">{r.pick}</td>
                      <td className="tabular px-3 py-2 text-muted-foreground">{pct(r.probability)}</td>
                      <td className="tabular px-3 py-2">{r.score}</td>
                      <td className={`px-3 py-2 font-bold ${r.correct ? "text-home" : "text-destructive"}`}>
                        {r.correct ? "Hit" : "Miss"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}