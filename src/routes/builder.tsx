import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Lock, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { LoadProgress } from "@/components/app/LoadProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompetitionFeed } from "@/hooks/useCompetitionFeed";
import { ALL_CODES, FREE_CODES } from "@/lib/competitions";
import { dayLabel, dayKeyOf, fixtureDateLine, groupByDay } from "@/lib/format";
import { useAcca } from "@/lib/acca";
import { bestPick, pct, type MarketId } from "@/lib/markets";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Build your own acca — PitchModel" },
      {
        name: "description",
        content:
          "Pick your own selections from today's model calls and see the combined chance of your acca landing, plus the fair price for it.",
      },
      { property: "og:title", content: "Build your own acca — PitchModel" },
      {
        property: "og:description",
        content:
          "Choose the games and picks you like, and we work out the combined chance and fair odds instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuilderPage,
});

const MARKET_CHOICES: MarketId[] = ["1x2", "dc", "ou25", "btts"];
const FREE_LEG_LIMIT = 4;
const PRO_LEG_LIMIT = 12;

function BuilderPage() {
  const { isPro } = usePro();
  const codes = isPro ? [...ALL_CODES] : [...FREE_CODES];
  const { fixtures, isPending, isLoadingMore, loaded, total } = useCompetitionFeed(codes);
  const { selections, add, remove, clear, has, combined } = useAcca();
  const [day, setDay] = useState<string | null>(null);

  const legLimit = isPro ? PRO_LEG_LIMIT : FREE_LEG_LIMIT;
  const days = useMemo(() => groupByDay(fixtures.filter((f) => f.prediction)), [fixtures]);
  const activeDay = day ?? days[0]?.key ?? null;
  const shown = days.find((d) => d.key === activeDay)?.fixtures ?? [];
  const fairOdds = combined > 0 ? 1 / combined : 0;
  const atLimit = selections.length >= legLimit;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-40">
      <header>
        <h1 className="text-2xl font-bold">Build your own acca</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the games and calls you like. We work out the combined chance of the whole slip landing
          and the fair price that goes with it. Prefer it done for you? See the{" "}
          <Link to="/acca" className="font-semibold text-primary">
            ready-made slips
          </Link>
          .
        </p>
      </header>

      {isLoadingMore || isPending ? (
        <LoadProgress loaded={loaded} total={total} label="Loading matches" />
      ) : null}

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : days.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          No priced games on the board right now. Check back closer to kick-off.
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.key}
                onClick={() => setDay(d.key)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeDay === d.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {dayLabel(d.key)}
                <span className="ml-1.5 tabular opacity-70">{d.fixtures.length}</span>
              </button>
            ))}
          </div>

          {!isPro ? (
            <p className="card-surface flex items-start gap-2 p-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              <span>
                Free slips hold up to {FREE_LEG_LIMIT} picks from four leagues.{" "}
                <Link to="/pro" className="font-semibold text-primary">
                  Pro predictions
                </Link>{" "}
                unlock every league and up to {PRO_LEG_LIMIT} picks.
              </span>
            </p>
          ) : null}

          <div className="space-y-3">
            {shown.map((f) => {
              const p = f.prediction!;
              const picks = MARKET_CHOICES.map((m) => bestPick(m, p, f.home.name, f.away.name)).filter(
                (x): x is NonNullable<typeof x> => Boolean(x),
              );
              return (
                <section key={f.id} className="card-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {f.home.name} v {f.away.name}
                    </h2>
                    <span className="text-[11px] text-muted-foreground">
                      {f.competition} · {fixtureDateLine(f.utcDate)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {picks.map((pick) => {
                      const picked = has(f.id, pick.label);
                      const disabled = !picked && atLimit;
                      return (
                        <button
                          key={pick.label}
                          disabled={disabled}
                          onClick={() =>
                            picked
                              ? remove(f.id, pick.label)
                              : add({
                                  matchId: f.id,
                                  fixture: `${f.home.name} v ${f.away.name}`,
                                  market: pick.market,
                                  label: pick.label,
                                  probability: pick.probability,
                                })
                          }
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                            picked
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-surface text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {pick.label} <span className="tabular">{pct(pick.probability)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {selections.length ? (
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:bottom-0">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Layers className="h-4 w-4 text-primary" />
                {selections.length} of {legLimit} picks · {pct(combined)} chance
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Fair odds {fairOdds ? fairOdds.toFixed(2) : "—"} ·{" "}
                {selections.map((s) => s.label).join(" + ")}
              </p>
            </div>
            <button
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        </div>
      ) : null}

      {activeDay && dayKeyOf(new Date().toISOString()) === activeDay ? null : null}
    </main>
  );
}
