import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FixtureCard } from "./FixtureCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useCompetitionFeed } from "@/hooks/useCompetitionFeed";
import { ALL_CODES, COMPETITION_LIST, FREE_CODES, MAX_FEED_CODES, competitionName } from "@/lib/competitions";
import { applyFilters, DEFAULT_FILTERS, SORTS, type FilterState } from "@/lib/filters";
import { boardDayKeys, dayLabel, dayLabelShort, groupByDay, todayKey } from "@/lib/format";
import { MARKETS } from "@/lib/markets";
import { usePro } from "@/lib/pro";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

const selectClass =
  "w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function FixtureFeed({ limit }: { limit?: number }) {
  const { isPro } = usePro();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const set = (patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch }));
  // Board opens on Today (Nairobi); user can switch Yesterday / Tomorrow / Day after.
  const [activeDay, setActiveDay] = useState<string>(() => todayKey());

  const codes = filters.codes.length ? filters.codes.slice(0, MAX_FEED_CODES) : [...FREE_CODES];
  const { fixtures, isPending, isLoadingMore, loaded, total } = useCompetitionFeed(codes);
  const filtered = useMemo(() => applyFilters(fixtures, filters), [fixtures, filters]);
  const dayTabs = boardDayKeys();
  const groupedAll = useMemo(() => groupByDay(filtered), [filtered]);
  const byKey = useMemo(() => {
    const m = new Map<string, (typeof groupedAll)[number]>();
    for (const g of groupedAll) m.set(g.key, g);
    return m;
  }, [groupedAll]);
  // Home / limited strip: still only a couple of days; full board uses the day tabs.
  const grouped = useMemo(() => {
    if (limit) return groupByDay(filtered).slice(0, 2);
    const g = byKey.get(activeDay);
    return g ? [g] : [];
  }, [filtered, limit, activeDay, byKey]);

  const competitionValue =
    filters.codes.length > 1 ? "all" : filters.codes.length === 1 ? filters.codes[0]! : "free";

  const controls = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Competition">
        <select
          className={selectClass}
          value={competitionValue}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "free") set({ codes: [] });
            else if (value === "all") set({ codes: isPro ? [...ALL_CODES] : [...FREE_CODES] });
            else set({ codes: [value] });
          }}
        >
          <option value="free">Free leagues (4)</option>
          <option value="all">All competitions{isPro ? "" : " · Pro"}</option>
          {COMPETITION_LIST.map((c) => (
            <option key={c.code} value={c.code} disabled={!c.free && !isPro}>
              {c.name}
              {!c.free && !isPro ? " · Pro" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Market">
        <select
          className={selectClass}
          value={filters.market}
          onChange={(e) => set({ market: e.target.value as FilterState["market"] })}
        >
          {MARKETS.map((m) => (
            <option key={m.id} value={m.id} disabled={m.pro && !isPro}>
              {m.short}
              {m.pro && !isPro ? " · Pro" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Confidence">
        <select
          className={selectClass}
          value={filters.confidence}
          onChange={(e) => set({ confidence: e.target.value as FilterState["confidence"] })}
        >
          <option value="any">Any</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </Field>
      <Field label="Sort">
        <select
          className={selectClass}
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value as FilterState["sort"] })}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Min probability ${filters.minProb}%`}>
        <span className="flex h-9 items-center px-1">
          <Slider
            value={[filters.minProb]}
            min={0}
            max={90}
            step={5}
            onValueChange={([v]) => set({ minProb: v ?? 0 })}
          />
        </span>
      </Field>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Sticky day navigation */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => set({ day: "all" })}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filters.day === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            All dates
          </button>
          {days.map((d) => (
            <button
              key={d.key}
              onClick={() => set({ day: d.key })}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filters.day === d.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {dayLabelShort(d.key)}
              <span className="ml-1.5 tabular opacity-70">{d.fixtures.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters: horizontal bar on desktop, sheet on mobile */}
      <div className="hidden lg:block">{controls}</div>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="p-4">{controls}</div>
          </SheetContent>
        </Sheet>
        <span className="tabular text-xs text-muted-foreground">{filtered.length} fixtures</span>
      </div>

      {(filters.minProb > 0 || filters.confidence !== "any" || filters.codes.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.codes.map((c) => (
            <button
              key={c}
              onClick={() => set({ codes: [] })}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]"
            >
              {competitionName(c)} <X className="h-3 w-3" />
            </button>
          ))}
          {filters.minProb > 0 && (
            <button
              onClick={() => set({ minProb: 0 })}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]"
            >
              {filters.minProb}%+ <X className="h-3 w-3" />
            </button>
          )}
          {filters.confidence !== "any" && (
            <button
              onClick={() => set({ confidence: "any" })}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]"
            >
              {filters.confidence} confidence <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-[11px] font-semibold text-primary"
          >
            Reset all
          </button>
        </div>
      )}

      {!limit ? (
        <div className="flex flex-wrap gap-2">
          {dayTabs.map((key) => {
            const count = byKey.get(key)?.fixtures.length ?? 0;
            const active = key === activeDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDay(key)}
                className={
                  active
                    ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }
              >
                {dayLabelShort(key)}
                <span className="ml-1.5 tabular opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          {limit
            ? "No fixtures match these filters. Loosen the probability or confidence filter, or pick a different date."
            : `No fixtures for ${dayLabel(activeDay)} with the current filters. Try another day tab or loosen filters.`}
        </p>
      ) : (
        <>
        {isLoadingMore ? (
          <p className="text-xs text-muted-foreground">
            Loading competitions… {loaded} of {total} ready.
          </p>
        ) : null}
        {grouped.map((day) => (
          <section key={day.key} className="space-y-3">
            <h3 className="flex items-center gap-3 pt-2 text-sm font-bold">
              {dayLabel(day.key)}
              <span className="tabular text-xs font-normal text-muted-foreground">
                {day.fixtures.length} fixtures
              </span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(limit ? day.fixtures.slice(0, limit) : day.fixtures).map((f) => (
                <FixtureCard key={f.id} fixture={f} market={filters.market} />
              ))}
            </div>
          </section>
        ))}
        </>
      )}
    </div>
  );
}