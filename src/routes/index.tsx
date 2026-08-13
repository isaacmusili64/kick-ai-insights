import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Sparkles } from "lucide-react";

import pitchHero from "@/assets/pitch-hero.jpg";
import { EdgeBadge } from "@/components/app/Badges";
import { FixtureFeed } from "@/components/app/FixtureFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { FREE_CODES } from "@/lib/competitions";
import { bestEdge } from "@/lib/edge";
import { dayKeyOf, fixtureDateLine, todayKey } from "@/lib/format";
import { getFeed } from "@/lib/football.functions";
import { bestPick, pct } from "@/lib/markets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchModel — Football Predictions From A Model" },
      {
        name: "description",
        content:
          "Daily football predictions from a Poisson/Dixon-Coles model: win probabilities, expected goals, correct score, model edge and AI match analysis.",
      },
      { property: "og:title", content: "PitchModel — Football Predictions From A Model" },
      {
        property: "og:description",
        content:
          "Fixtures by day, model probabilities across every market, model edge and AI analysis. Free access to four leagues.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function TodaysModelCard() {
  const feedFn = useServerFn(getFeed);
  const { data, isPending } = useQuery({
    queryKey: ["feed", FREE_CODES.join(",")],
    queryFn: () => feedFn({ data: { codes: FREE_CODES, days: 21 } }),
    staleTime: 5 * 60_000,
  });

  const today = todayKey();
  const priced = (data?.fixtures ?? []).filter(
    (f) => f.prediction && dayKeyOf(f.utcDate) === today,
  );
  const top = [...priced]
    .sort((a, b) => (b.prediction!.confidence ?? 0) - (a.prediction!.confidence ?? 0))
    .slice(0, 3);
  const edges = [...priced]
    .sort(
      (a, b) =>
        bestEdge(b.prediction!, b.home.name, b.away.name).edge -
        bestEdge(a.prediction!, a.home.name, a.away.name).edge,
    )
    .slice(0, 3);

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (!priced.length)
    return (
      <p className="card-surface p-5 text-sm text-muted-foreground">
        No games kick off today. Scroll down for the next match days on the board.
      </p>
    );

  return (
    <div className="card-surface grid-lines overflow-hidden">
      <div className="grid gap-6 bg-gradient-to-br from-card via-card to-primary/8 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <Sparkles className="h-4 w-4 text-gold" /> Today&apos;s best calls
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Our most confident picks from today&apos;s games
          </p>
          <ul className="mt-4 space-y-2">
            {top.map((f) => {
              const pick = bestPick("1x2", f.prediction!, f.home.name, f.away.name)!;
              return (
                <li key={f.id}>
                  <Link
                    to="/match/$matchId"
                    params={{ matchId: String(f.id) }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{pick.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {f.home.name} v {f.away.name} · {fixtureDateLine(f.utcDate)}
                      </span>
                    </span>
                    <span className="tabular text-lg font-bold text-primary">
                      {pct(pick.probability)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Best value today</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Where our numbers disagree most with the typical price
          </p>
          <ul className="mt-4 space-y-2">
            {edges.map((f) => {
              const e = bestEdge(f.prediction!, f.home.name, f.away.name);
              return (
                <li key={f.id}>
                  <Link
                    to="/match/$matchId"
                    params={{ matchId: String(f.id) }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{e.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        Our number {pct(e.model)} · market {pct(e.implied)}
                      </span>
                    </span>
                    <EdgeBadge edge={e.edge} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Index() {
  return (
    <main className="pb-16">
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={pitchHero}
          alt="Floodlit football pitch seen from above"
          width={1920}
          height={912}
          className="h-[42vh] min-h-64 w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Today&apos;s games · every market · proven track record
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-[1.05] sm:text-5xl">
              Football predictions from a model, not a hunch.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Win chances, goals, scorelines and best value for every fixture — plus a plain-English
              read on each game and a public record of how the calls landed.
            </p>
            <Link
              to="/pro"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/12 px-4 py-2 text-sm font-semibold text-gold"
            >
              See Pro predictions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <TodaysModelCard />
        <FixtureFeed />
      </div>
    </main>
  );
}