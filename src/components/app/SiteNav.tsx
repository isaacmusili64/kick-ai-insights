import { Link } from "@tanstack/react-router";
import { BookOpen, History, Layers, LineChart, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { usePro } from "@/lib/pro";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { to: "/" as const, label: "Predictions", icon: LineChart },
  { to: "/acca" as const, label: "Accas", icon: Layers },
  { to: "/blog" as const, label: "Blog", icon: BookOpen },
  { to: "/performance" as const, label: "Record", icon: History },
  { to: "/pro" as const, label: "Pro", icon: Sparkles },
];

export function SiteNav() {
  const { isPro } = usePro();
  const { user, signOut } = useAuth();

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
          <nav className="flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={() => void signOut()}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ next: undefined }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
            )}
            </div>
            {user ? (
              <Link
                to="/pro"
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground sm:hidden"
              >
                Account
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ next: undefined }}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground sm:hidden"
              >
                Sign in
              </Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/" }}
            activeProps={{ className: "text-primary" }}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight text-muted-foreground"
          >
            <l.icon className="h-[18px] w-[18px]" />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 pb-24 sm:pb-8">
      <div className="mx-auto grid max-w-6xl gap-8 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="space-y-3 sm:col-span-1">
          <p className="font-semibold text-foreground">PitchModel</p>
          <p>
            Every probability is worked out from live league data and checked against results on our
            public track record. Predictions are statistical analysis, not betting advice. 18+.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Site</p>
          <nav className="flex flex-col gap-1.5">
            <Link to="/blog" className="font-medium hover:text-foreground">
              Blog
            </Link>
            <Link to="/contact" className="font-medium hover:text-foreground">
              Contact
            </Link>
            <Link to="/performance" className="font-medium hover:text-foreground">
              Track record
            </Link>
            <Link to="/pro" className="font-medium hover:text-foreground">
              Pro passes
            </Link>
            <Link to="/privacy-policy" className="font-medium hover:text-foreground">
              Privacy policy
            </Link>
            <Link to="/refund-policy" className="font-medium hover:text-foreground">
              Refund policy (no refunds)
            </Link>
          </nav>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Resources</p>
          <nav className="flex flex-col gap-1.5">
            <a
              href="https://www.football-data.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground"
            >
              football-data.org
            </a>
            <a
              href="https://www.statsbomb.com/what-is-statsbomb-data/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground"
            >
              StatsBomb open data notes
            </a>
            <a
              href="https://en.wikipedia.org/wiki/Dixon%E2%80%93Coles_model"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground"
            >
              Dixon–Coles model (overview)
            </a>
            <Link
              to="/blog/$slug"
              params={{ slug: "how-pitchmodel-prices-a-match" }}
              className="font-medium hover:text-foreground"
            >
              How we price a match
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}