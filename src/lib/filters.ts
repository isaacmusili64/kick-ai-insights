import { bestPick, confidenceTier, type ConfidenceTier, type MarketId } from "./markets";
import { bestEdge, EDGE_THRESHOLD } from "./edge";
import { dayKeyOf } from "./format";
import type { FeedFixture } from "./types";

export type SortId = "kickoff" | "prob-desc" | "prob-asc" | "edge" | "confidence";

export const SORTS: { id: SortId; label: string; requiresOdds?: boolean }[] = [
  { id: "kickoff", label: "Kick-off time" },
  { id: "prob-desc", label: "Highest probability" },
  { id: "prob-asc", label: "Lowest probability" },
  { id: "confidence", label: "Highest confidence" },
  { id: "edge", label: "Highest model edge", requiresOdds: true },
];

export type FilterState = {
  day: string;
  from: string | null;
  to: string | null;
  codes: string[];
  market: MarketId;
  minProb: number;
  confidence: "any" | ConfidenceTier;
  sort: SortId;
  edgeOnly: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  day: "all",
  from: null,
  to: null,
  codes: [],
  market: "1x2",
  minProb: 0,
  confidence: "any",
  sort: "kickoff",
  edgeOnly: false,
};

export function fixtureProbability(f: FeedFixture, market: MarketId): number | null {
  if (!f.prediction) return null;
  return bestPick(market, f.prediction, f.home.name, f.away.name)?.probability ?? null;
}

export function applyFilters(fixtures: FeedFixture[], filters: FilterState): FeedFixture[] {
  const out = fixtures.filter((f) => {
    const key = dayKeyOf(f.utcDate);
    if (filters.day !== "all" && key !== filters.day) return false;
    if (filters.from && key < filters.from) return false;
    if (filters.to && key > filters.to) return false;
    if (filters.codes.length && !filters.codes.includes(f.competitionCode)) return false;

    if (filters.minProb > 0 || filters.confidence !== "any") {
      if (!f.prediction) return false;
      const p = fixtureProbability(f, filters.market);
      if (p === null || p * 100 < filters.minProb) return false;
      if (filters.confidence !== "any" && confidenceTier(f.prediction.confidence) !== filters.confidence)
        return false;
    }
    if (filters.edgeOnly) {
      if (!f.prediction) return false;
      if (bestEdge(f.prediction, f.home.name, f.away.name).edge < EDGE_THRESHOLD) return false;
    }
    return true;
  });

  const prob = (f: FeedFixture) => fixtureProbability(f, filters.market) ?? -1;
  const edge = (f: FeedFixture) =>
    f.prediction ? bestEdge(f.prediction, f.home.name, f.away.name).edge : -1;

  switch (filters.sort) {
    case "prob-desc":
      out.sort((a, b) => prob(b) - prob(a));
      break;
    case "edge":
      out.sort((a, b) => edge(b) - edge(a));
      break;
    case "prob-asc":
      out.sort((a, b) => prob(a) - prob(b));
      break;
    case "confidence":
      out.sort((a, b) => (b.prediction?.confidence ?? 0) - (a.prediction?.confidence ?? 0));
      break;
    default:
      out.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  }
  return out;
}

export function activeFilterChips(
  filters: FilterState,
  competitionName: (code: string) => string,
  dayName: (key: string) => string,
): { key: keyof FilterState | string; label: string; reset: Partial<FilterState> }[] {
  const chips: { key: string; label: string; reset: Partial<FilterState> }[] = [];
  if (filters.day !== "all") chips.push({ key: "day", label: dayName(filters.day), reset: { day: "all" } });
  if (filters.from || filters.to)
    chips.push({ key: "range", label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`, reset: { from: null, to: null } });
  for (const code of filters.codes)
    chips.push({
      key: `code-${code}`,
      label: competitionName(code),
      reset: { codes: filters.codes.filter((c) => c !== code) },
    });
  if (filters.market !== "1x2")
    chips.push({ key: "market", label: filters.market.toUpperCase(), reset: { market: "1x2" } });
  if (filters.minProb > 0) chips.push({ key: "minProb", label: `${filters.minProb}%+`, reset: { minProb: 0 } });
  if (filters.confidence !== "any")
    chips.push({ key: "confidence", label: `${filters.confidence} confidence`, reset: { confidence: "any" } });
  if (filters.edgeOnly) chips.push({ key: "edgeOnly", label: "Model edge ≥ 5%", reset: { edgeOnly: false } });
  return chips;
}