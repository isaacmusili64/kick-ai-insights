import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Lock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCompetitionFeed } from "@/hooks/useCompetitionFeed";
import { accaPool, buildAutoAccas } from "@/lib/autoacca";
import { ALL_CODES, FREE_CODES } from "@/lib/competitions";
import { dayLabel, fixtureDateLine } from "@/lib/format";
import { pct } from "@/lib/markets";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/acca")({
  head: () => ({
    meta: [
      { title: "Today's Ready-Made Accas — PitchModel" },
      {
        name: "description",
        content:
          "Ready-made accumulators built automatically from today's strongest model picks, with the combined chance and fair price worked out for you.",
      },
      { property: "og:title", content: "Today's Ready-Made Accas — PitchModel" },
      {
        property: "og:description",
        content: "Accumulators built from today's best model picks — combined chance and fair odds included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccaPage,
});

function AccaPage() {
  const { isPro } = usePro();
  const codes = isPro ? [...ALL_CODES] : [...FREE_CODES];
  const { fixtures, isPending, isLoadingMore, loaded, total } = useCompetitionFeed(codes);
  const accas = buildAutoAccas(fixtures, isPro);
  const { dayKey } = accaPool(fixtures);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold">
          {dayKey ? `${dayLabel(dayKey)}'s ready-made accas` : "Ready-made accas"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Built for you from the strongest calls on the next match day — no picking required. Each
          slip shows the combined chance of every leg landing and the fair price that goes with it.
        </p>
      </header>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : accas.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          Nothing strong enough on the card yet. Check back closer to kick-off, or browse{" "}
          <Link to="/" className="font-semibold text-primary">
            today&apos;s predictions
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {isLoadingMore ? (
            <p className="text-xs text-muted-foreground">
              Still checking competitions… {loaded} of {total} ready.
            </p>
          ) : null}
          {accas.map((a) => (
            <section key={a.id} className="card-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Layers className="h-4 w-4 text-primary" /> {a.name}
                </h2>
                <span className="tabular rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold">
                  {a.legs.length} legs · {pct(a.combined)} chance · fair odds{" "}
                  {a.fairOdds ? a.fairOdds.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>

              <ul className="mt-4 space-y-2">
                {a.legs.map((l) => (
                  <li key={`${a.id}-${l.matchId}`}>
                    <Link
                      to="/match/$matchId"
                      params={{ matchId: String(l.matchId) }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{l.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {l.fixture} · {l.competition} · {fixtureDateLine(l.kickoff)}
                        </span>
                      </span>
                      <span className="tabular font-bold text-primary">{pct(l.probability)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!isPro ? (
        <p className="card-surface flex items-start gap-2 border-gold/40 p-4 text-xs text-gold">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Free gives you two slips a day from the four open leagues.{" "}
            <Link to="/pro" className="font-bold underline">
              A Pro pass
            </Link>{" "}
            adds bigger multi-leg slips, value slips and every competition on the board.
          </span>
        </p>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Statistical analysis, not betting advice. 18+. See our{" "}
        <Link to="/refund-policy" className="underline">
          refund policy
        </Link>
        .
      </p>
    </main>
  );
}