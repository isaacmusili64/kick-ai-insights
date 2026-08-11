import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TrendingUp } from "lucide-react";

import { FormPips } from "./FormPips";
import { ProbabilityBar } from "./ProbabilityBar";
import { getAiInsight, getPrediction } from "@/lib/football.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Market({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-display">{value}</p>
    </div>
  );
}

export function PredictionPanel({ matchId }: { matchId: number }) {
  const predictFn = useServerFn(getPrediction);
  const insightFn = useServerFn(getAiInsight);

  const { data, isPending, error } = useQuery({
    queryKey: ["prediction", matchId],
    queryFn: () => predictFn({ data: { matchId } }),
    staleTime: 5 * 60_000,
  });

  const insight = useMutation({
    mutationFn: (payload: string) => insightFn({ data: { matchId, payload } }),
  });

  if (isPending) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  if (error || !data || data.error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {data?.error === "MISSING_KEY"
          ? "Add your football-data.org API key to run the model."
          : data?.error === "RATE_LIMITED"
            ? "The free data tier is rate limited (10 requests/min). Wait a moment and try again."
            : "Could not build a model for this match yet."}
      </div>
    );
  }

  const { fixture, prediction, teams, h2h, leagueAvgGoals } = data;
  const best = [
    { label: `${fixture.home.name} win`, p: prediction.homeWin },
    { label: "Draw", p: prediction.draw },
    { label: `${fixture.away.name} win`, p: prediction.awayWin },
  ].sort((a, b) => b.p - a.p)[0]!;
  const topScore = prediction.topScores[0]!;

  const payload = [
    `Fixture: ${fixture.home.name} vs ${fixture.away.name} (${fixture.competition}, ${new Date(fixture.utcDate).toUTCString()})`,
    `Model probabilities: home ${pct(prediction.homeWin)}, draw ${pct(prediction.draw)}, away ${pct(prediction.awayWin)}`,
    `Expected goals: ${prediction.expectedHomeGoals.toFixed(2)} - ${prediction.expectedAwayGoals.toFixed(2)} (league baseline ${leagueAvgGoals.toFixed(2)} per team)`,
    `Most likely scorelines: ${prediction.topScores.map((s) => `${s.score} (${pct(s.probability)})`).join(", ")}`,
    `Over 2.5 goals ${pct(prediction.over25)}, BTTS ${pct(prediction.bttsYes)}, clean sheet home ${pct(prediction.cleanSheetHome)}, clean sheet away ${pct(prediction.cleanSheetAway)}`,
    `${fixture.home.name}: form ${teams.home.form.join("")} (${teams.home.formPoints}/15 pts), scoring ${teams.home.avgScored.toFixed(2)}, conceding ${teams.home.avgConceded.toFixed(2)}, attack index ${teams.home.attack.toFixed(2)}, defence index ${teams.home.defence.toFixed(2)}`,
    `${fixture.away.name}: form ${teams.away.form.join("")} (${teams.away.formPoints}/15 pts), scoring ${teams.away.avgScored.toFixed(2)}, conceding ${teams.away.avgConceded.toFixed(2)}, attack index ${teams.away.attack.toFixed(2)}, defence index ${teams.away.defence.toFixed(2)}`,
    h2h.length
      ? `Head to head: ${h2h.map((m) => `${m.home} ${m.score} ${m.away}`).join("; ")}`
      : "Head to head: no recent meetings.",
  ].join("\n");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {fixture.competition}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {fixture.home.name} <span className="text-muted-foreground">vs</span>{" "}
              {fixture.away.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(fixture.utcDate).toLocaleString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-secondary-foreground">
              Confidence
            </p>
            <p className="text-xl font-bold tabular text-primary">{prediction.confidence}</p>
          </div>
        </div>

        <div className="mt-5">
          <ProbabilityBar
            home={prediction.homeWin}
            draw={prediction.draw}
            away={prediction.awayWin}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/70 p-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Model call: <strong>{best.label}</strong> at {pct(best.p)}, most likely score{" "}
            <strong className="tabular">{topScore.score}</strong> ({pct(topScore.probability)})
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Market
            label="Expected goals"
            value={`${prediction.expectedHomeGoals.toFixed(2)} - ${prediction.expectedAwayGoals.toFixed(2)}`}
          />
          <Market label="Over 2.5" value={pct(prediction.over25)} />
          <Market label="Both teams score" value={pct(prediction.bttsYes)} />
          <Market label="Double chance 1X" value={pct(prediction.doubleChanceHome)} />
          <Market label="Under 2.5" value={pct(prediction.under25)} />
          <Market label="BTTS no" value={pct(prediction.bttsNo)} />
          <Market label="Clean sheet home" value={pct(prediction.cleanSheetHome)} />
          <Market label="Double chance X2" value={pct(prediction.doubleChanceAway)} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{fixture[side].name}</p>
                <FormPips form={teams[side].form} />
              </div>
              <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Goals scored / game</dt>
                  <dd className="tabular text-foreground">{teams[side].avgScored.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Goals conceded / game</dt>
                  <dd className="tabular text-foreground">{teams[side].avgConceded.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Attack index</dt>
                  <dd className="tabular text-foreground">{teams[side].attack.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Defence index</dt>
                  <dd className="tabular text-foreground">{teams[side].defence.toFixed(2)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Most likely scorelines
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prediction.topScores.map((s) => (
              <span
                key={s.score}
                className="rounded-lg border border-border px-3 py-1.5 text-sm tabular"
              >
                {s.score} · {pct(s.probability)}
              </span>
            ))}
          </div>
        </div>

        {h2h.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Head to head</p>
            <ul className="mt-2 space-y-1 text-sm">
              {h2h.map((m) => (
                <li key={`${m.date}-${m.score}`} className="flex justify-between border-b border-border/60 pb-1">
                  <span>
                    {m.home} vs {m.away}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {m.score} · {new Date(m.date).getFullYear()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-4 w-4 text-gold" /> AI insight
          </h3>
          <Button
            size="sm"
            onClick={() => insight.mutate(payload)}
            disabled={insight.isPending}
          >
            {insight.isPending ? "Analysing…" : insight.data ? "Regenerate" : "Generate"}
          </Button>
        </div>
        {insight.data?.insight ? (
          <div className="mt-4 space-y-3 text-sm leading-relaxed">
            {insight.data.insight.split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {insight.data?.error ??
              (insight.isError
                ? "AI insight failed to generate."
                : "Turn the model output into a readable read on the game.")}
          </p>
        )}
      </div>
    </div>
  );
}