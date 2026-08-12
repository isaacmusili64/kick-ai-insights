import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { ACCA_STYLES, useAcca } from "@/lib/acca";
import { Button } from "@/components/ui/button";
import { pct } from "@/lib/markets";
import { FREE_ACCA_SELECTIONS, usePro } from "@/lib/pro";

export const Route = createFileRoute("/acca")({
  head: () => ({
    meta: [
      { title: "Smart Acca Builder — PitchModel" },
      {
        name: "description",
        content:
          "Combine model selections into an accumulator and see the true combined model probability and fair price.",
      },
      { property: "og:title", content: "Smart Acca Builder — PitchModel" },
      {
        property: "og:description",
        content: "Build accumulators from model probabilities and see the combined chance and fair odds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccaPage,
});

function AccaPage() {
  const { selections, remove, clear, combined, style, setStyle } = useAcca();
  const { isPro } = usePro();
  const styleDef = ACCA_STYLES.find((s) => s.id === style)!;
  const flagged = selections.filter((s) => s.probability < styleDef.min);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold">Smart acca builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Model probabilities multiplied out, so you can see what an accumulator is really worth.
        </p>
      </header>

      <div className="card-surface p-5">
        <div className="flex flex-wrap gap-2">
          {ACCA_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                style === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{styleDef.note}</p>

        {selections.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No selections yet. Add picks from any{" "}
            <Link to="/" className="font-semibold text-primary">
              fixture card
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-5 space-y-2">
              {selections.map((s) => (
                <li
                  key={`${s.matchId}-${s.label}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{s.fixture}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`tabular font-bold ${s.probability < styleDef.min ? "text-destructive" : "text-primary"}`}
                    >
                      {pct(s.probability)}
                    </span>
                    <button onClick={() => remove(s.matchId, s.label)} aria-label="Remove selection">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["Legs", `${selections.length}`],
                ["Combined chance", pct(combined)],
                ["Fair odds", combined > 0 ? (1 / combined).toFixed(2) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="tabular mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {flagged.length ? (
              <p className="mt-3 text-xs text-destructive">
                {flagged.length} selection{flagged.length > 1 ? "s" : ""} below your {styleDef.label.toLowerCase()}{" "}
                threshold of {Math.round(styleDef.min * 100)}%.
              </p>
            ) : null}

            <Button variant="outline" size="sm" className="mt-4" onClick={clear}>
              Clear acca
            </Button>
          </>
        )}

        {!isPro ? (
          <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-gold">
            Free accas are capped at {FREE_ACCA_SELECTIONS} legs.{" "}
            <Link to="/pro" className="font-bold underline">
              PitchModel Pro
            </Link>{" "}
            unlocks unlimited legs and every market.
          </p>
        ) : null}
      </div>
    </main>
  );
}