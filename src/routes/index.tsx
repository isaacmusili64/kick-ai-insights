import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import pitchHero from "@/assets/pitch-hero.jpg";
import { PredictionPanel } from "@/components/app/PredictionPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { getFixtures } from "@/lib/football.functions";

const COMPETITIONS = [
  { code: "PL", name: "Premier League" },
  { code: "ELC", name: "Championship" },
  { code: "PD", name: "La Liga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
  { code: "DED", name: "Eredivisie" },
  { code: "PPL", name: "Primeira Liga" },
  { code: "BSA", name: "Brasileirão" },
  { code: "CL", name: "Champions League" },
  { code: "EC", name: "Euros" },
  { code: "WC", name: "World Cup" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchModel — ML Football Match Predictions" },
      {
        name: "description",
        content:
          "Free football predictions from a Poisson/Dixon-Coles model on live football-data.org stats, with AI match insights. No sign-up.",
      },
      { property: "og:title", content: "PitchModel — ML Football Match Predictions" },
      {
        property: "og:description",
        content:
          "Win probabilities, expected goals, scorelines and AI insight for upcoming fixtures across Europe's top leagues.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [code, setCode] = useState("PL");
  const [selected, setSelected] = useState<number | null>(null);
  const fixturesFn = useServerFn(getFixtures);

  const { data, isPending } = useQuery({
    queryKey: ["fixtures", code],
    queryFn: () => fixturesFn({ data: { code } }),
    staleTime: 2 * 60_000,
  });

  const fixtures = data?.fixtures ?? [];

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden">
        <img
          src={pitchHero}
          alt="Sunlit football pitch with mown grass stripes"
          width={1920}
          height={912}
          className="h-[46vh] min-h-72 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-5xl px-5 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              PitchModel
            </p>
            <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl">
              Match predictions from a model, not a hunch.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Live stats from football-data.org run through a Poisson/Dixon-Coles engine, with an
              AI read on every fixture. Free and open — no account needed.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {COMPETITIONS.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCode(c.code);
                setSelected(null);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                code === c.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming fixtures
            </h2>
            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : data?.error ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                {data.error === "MISSING_KEY"
                  ? "Add your football-data.org API key to load fixtures."
                  : data.error === "RATE_LIMITED"
                    ? "The free data tier is rate limited (10 requests/min). Try again in a minute."
                    : "No fixture data available for this competition right now."}
              </p>
            ) : fixtures.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No scheduled matches in the next three weeks.
              </p>
            ) : (
              <ul className="space-y-2">
                {fixtures.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setSelected(f.id)}
                      className={`w-full rounded-xl border bg-card p-3 text-left transition-colors ${
                        selected === f.id
                          ? "border-primary ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {new Date(f.utcDate).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {f.home.name} <span className="text-muted-foreground">v</span> {f.away.name}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            {selected ? (
              <PredictionPanel matchId={selected} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="text-lg font-semibold">Pick a fixture</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The model rebuilds attack and defence strengths from each side's last 12 results,
                  then simulates every scoreline.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
