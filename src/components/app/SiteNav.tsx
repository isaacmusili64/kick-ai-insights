import { Link } from "@tanstack/react-router";
import { Layers, LineChart, Sparkles } from "lucide-react";

import { useAcca } from "@/lib/acca";
import { usePro } from "@/lib/pro";

const LINKS = [
  { to: "/" as const, label: "Predictions", icon: LineChart },
  { to: "/acca" as const, label: "Smart acca", icon: Layers },
  { to: "/pro" as const, label: "Pro", icon: Sparkles },
];

export function SiteNav() {
  const { selections } = useAcca();
  const { isPro } = usePro();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
              PM
            </span>
            <span className="truncate text-sm font-bold tracking-tight">PitchModel</span>
            {isPro ? (
              <span className="rounded-full border border-gold/50 bg-gold/12 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                Pro
              </span>
            ) : null}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
                {l.to === "/acca" && selections.length ? (
                  <span className="ml-1.5 tabular text-primary">{selections.length}</span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-border bg-card/95 backdrop-blur sm:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/" }}
            activeProps={{ className: "text-primary" }}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground"
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 pb-24 sm:pb-8">
      <div className="mx-auto max-w-6xl space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">PitchModel</p>
        <p>
          Probabilities come from a Poisson / Dixon-Coles model fitted to live league data from
          football-data.org. Model output is statistical analysis, not betting advice. 18+.
        </p>
      </div>
    </footer>
  );
}