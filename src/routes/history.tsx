import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Trash2, X } from "lucide-react";
import { useEffect } from "react";

import { ConfidenceBadge } from "@/components/app/Badges";
import { Button } from "@/components/ui/button";
import { fixtureDateLine } from "@/lib/format";
import { getMatchResult } from "@/lib/football.functions";
import { useHistory, predictedOutcome, type HistoryEntry, type HistoryOutcome } from "@/lib/history";
import { pct } from "@/lib/markets";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Prediction History — PitchModel" },
      {
        name: "description",
        content: "Every match analysis you've opened, checked against the final result once it's played.",
      },
      { property: "og:title", content: "Prediction History — PitchModel" },
      {
        property: "og:description",
        content: "Track how the model's predictions actually played out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function outcomeLabel(outcome: HistoryOutcome, home: string, away: string): string {
  if (outcome === "HOME_WIN") return `${home} win`;
  if (outcome === "AWAY_WIN") return `${away} win`;
  return "Draw";
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { recordResult, remove } = useHistory();
  const resultFn = useServerFn(getMatchResult);

  const kickoffPassed = new Date(entry.utcDate).getTime() < Date.now();
  const { data } = useQuery({
    queryKey: ["match-result", entry.matchId],
    queryFn: () => resultFn({ data: { matchId: entry.matchId } }),
    enabled: !entry.result && kickoffPassed,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!data || entry.result) return;
    if (data.status === "FINISHED" && data.homeGoals !== null && data.awayGoals !== null) {
      recordResult(entry.matchId, { status: data.status, homeGoals: data.homeGoals, awayGoals: data.awayGoals });
    }
  }, [data, entry.matchId, entry.result, recordResult]);

  const predicted = outcomeLabel(predictedOutcome(entry), entry.home, entry.away);

  return (
    <li className="card-surface flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <Link
          to="/match/$matchId"
          params={{ matchId: String(entry.matchId) }}
          className="block truncate text-sm font-semibold hover:text-primary"
        >
          {entry.home} v {entry.away}
        </Link>
        <p className="truncate text-[11px] text-muted-foreground">
          {entry.competition} · {fixtureDateLine(entry.utcDate)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Predicted <span className="font-semibold text-foreground">{predicted}</span> ·{" "}
          <span className="tabular">
            {pct(Math.max(entry.homeWin, entry.draw, entry.awayWin))}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ConfidenceBadge confidence={entry.confidence} />
        {entry.result ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              entry.result.correct
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {entry.result.correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {entry.result.homeGoals}-{entry.result.awayGoals}
          </span>
        ) : kickoffPassed ? (
          <span className="text-[11px] text-muted-foreground">Checking…</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not played yet</span>
        )}
        <button
          onClick={() => remove(entry.matchId)}
          aria-label="Remove from history"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function HistoryPage() {
  const { entries, clear, accuracy } = useHistory();

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold">Prediction history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every match analysis you've opened is logged here automatically, then checked against the
          final score once the match has been played.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="card-surface p-6 text-center text-sm text-muted-foreground">
          No predictions logged yet. Open a{" "}
          <Link to="/" className="font-semibold text-primary">
            match analysis
          </Link>{" "}
          to start tracking it here.
        </p>
      ) : (
        <>
          <div className="card-surface grid grid-cols-4 gap-3 p-5">
            {[
              ["Logged", `${entries.length}`],
              ["Graded", `${accuracy.graded}`],
              ["Accuracy", accuracy.pct !== null ? pct(accuracy.pct) : "—"],
              ["Brier score", accuracy.brier !== null ? accuracy.brier.toFixed(3) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="tabular mt-1 text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
          {accuracy.brier !== null && (
            <p className="text-[11px] text-muted-foreground">
              Brier score measures how well-calibrated the probabilities are, not just whether the top
              pick won — lower is better. 0 is perfect, ~0.67 is uninformative guessing.
            </p>
          )}

          <ul className="space-y-2">
            {entries.map((entry) => (
              <HistoryRow key={entry.matchId} entry={entry} />
            ))}
          </ul>

          <Button variant="outline" size="sm" onClick={clear}>
            Clear history
          </Button>
        </>
      )}
    </main>
  );
}
