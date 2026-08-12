import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COMPETITION_LIST } from "@/lib/competitions";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "PitchModel Pro — All leagues, all markets" },
      {
        name: "description",
        content:
          "PitchModel Pro unlocks every league, all ten markets, unlimited acca legs and full model edge tables for $7.99 a month.",
      },
      { property: "og:title", content: "PitchModel Pro — All leagues, all markets" },
      {
        property: "og:description",
        content: "Every league, every market, unlimited accas and full model edge for $7.99 a month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

const FREE = ["4 free leagues", "Match result, double chance, O/U 2.5, BTTS", "3-leg smart acca", "AI analysis"];
const PRO = [
  `All ${COMPETITION_LIST.length} competitions`,
  "All 10 markets incl. correct score, handicap, team goals",
  "Unlimited acca legs and style presets",
  "Full model edge tables and edge-only filter",
  "Priority AI analysis",
];

function ProPage() {
  const { isPro, setPro } = usePro();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-24">
      <header className="text-center">
        <h1 className="text-3xl font-bold">PitchModel Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The full model: every league, every market, every edge.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Free</h2>
          <p className="tabular mt-2 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface border-gold/40 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold">Pro</h2>
          <p className="tabular mt-2 text-3xl font-bold">
            $7.99 <span className="text-sm font-normal text-muted-foreground">/ month</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {f}
              </li>
            ))}
          </ul>
          <Button className="mt-5 w-full" onClick={() => setPro(!isPro)}>
            {isPro ? "Turn off Pro preview" : "Try Pro features now"}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Payments are not connected yet — this unlocks Pro features locally so you can preview them.
          </p>
        </section>
      </div>
    </main>
  );
}