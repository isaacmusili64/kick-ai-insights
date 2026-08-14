import { bestEdge } from "./edge";
import { dayKeyOf, todayKey } from "./format";
import { bestPick, type MarketId, type Pick } from "./markets";
import type { FeedFixture } from "./types";

export type AutoLeg = {
  matchId: number;
  fixture: string;
  competition: string;
  kickoff: string;
  market: MarketId;
  marketLabel: string;
  label: string;
  probability: number;
};

export type AutoAcca = {
  id: string;
  name: string;
  note: string;
  legs: AutoLeg[];
  combined: number;
  fairOdds: number;
  pro: boolean;
};

const SAFE_MARKETS: MarketId[] = ["1x2", "dc", "ou25", "btts"];

/** One strongest selection per fixture, across the everyday markets. */
function candidateLegs(fixtures: FeedFixture[]): AutoLeg[] {
  const legs: AutoLeg[] = [];
  for (const f of fixtures) {
    if (!f.prediction) continue;
    let best: Pick | null = null;
    for (const market of SAFE_MARKETS) {
      const pick = bestPick(market, f.prediction, f.home.name, f.away.name);
      if (pick && (!best || pick.probability > best.probability)) best = pick;
    }
    if (!best) continue;
    legs.push({
      matchId: f.id,
      fixture: `${f.home.name} v ${f.away.name}`,
      competition: f.competition,
      kickoff: f.utcDate,
      market: best.market,
      marketLabel: best.marketLabel,
      label: best.label,
      probability: best.probability,
    });
  }
  return legs.sort((a, b) => b.probability - a.probability);
}

function valueLegs(fixtures: FeedFixture[]): AutoLeg[] {
  return fixtures
    .filter((f) => f.prediction)
    .map((f) => {
      const e = bestEdge(f.prediction!, f.home.name, f.away.name);
      return {
        leg: {
          matchId: f.id,
          fixture: `${f.home.name} v ${f.away.name}`,
          competition: f.competition,
          kickoff: f.utcDate,
          market: "1x2" as MarketId,
          marketLabel: "Match result (1X2)",
          label: e.label,
          probability: e.model,
        },
        edge: e.edge,
      };
    })
    .sort((a, b) => b.edge - a.edge)
    .map((x) => x.leg);
}

type Template = {
  id: string;
  name: string;
  note: string;
  legs: number;
  min: number;
  source: "safe" | "value";
  pro: boolean;
};

const TEMPLATES: Template[] = [
  { id: "banker", name: "Banker double", note: "Our two strongest calls of the day.", legs: 2, min: 0.68, source: "safe", pro: false },
  { id: "treble", name: "Safe treble", note: "Three high-probability picks in one slip.", legs: 3, min: 0.6, source: "safe", pro: false },
  { id: "fourfold", name: "Four-fold", note: "A bigger return while keeping every leg above 55%.", legs: 4, min: 0.55, source: "safe", pro: true },
  { id: "value", name: "Value builder", note: "Where our numbers disagree most with the typical price.", legs: 4, min: 0.42, source: "value", pro: true },
  { id: "long", name: "Long shot six", note: "Six legs for a big payout — treat it as a lottery ticket.", legs: 6, min: 0.45, source: "safe", pro: true },
];

/** Today's card when there is one, otherwise the next match day on the board. */
export function accaPool(fixtures: FeedFixture[]): { dayKey: string | null; pool: FeedFixture[] } {
  const today = todayKey();
  const todays = fixtures.filter((f) => dayKeyOf(f.utcDate) === today && f.prediction);
  if (todays.length) return { dayKey: today, pool: todays };
  const next = fixtures.find((f) => f.prediction && dayKeyOf(f.utcDate) > today);
  if (!next) return { dayKey: null, pool: [] };
  const key = dayKeyOf(next.utcDate);
  return { dayKey: key, pool: fixtures.filter((f) => f.prediction && dayKeyOf(f.utcDate) === key) };
}

export function buildAutoAccas(fixtures: FeedFixture[], isPro: boolean): AutoAcca[] {
  const { pool } = accaPool(fixtures);
  const safe = candidateLegs(pool);
  const value = valueLegs(pool);

  return TEMPLATES.filter((t) => isPro || !t.pro)
    .map((t) => {
      const source = t.source === "safe" ? safe : value;
      let legs = source.filter((l) => l.probability >= t.min).slice(0, t.legs);
      // Thin cards shouldn't leave the page empty: fall back to the best legs available.
      if (legs.length < 2) legs = source.filter((l) => l.probability >= 0.45).slice(0, t.legs);
      const combined = legs.length ? legs.reduce((a, l) => a * l.probability, 1) : 0;
      return {
        id: t.id,
        name: t.name,
        note: t.note,
        legs,
        combined,
        fairOdds: combined > 0 ? 1 / combined : 0,
        pro: t.pro,
      };
    })
    .filter((a) => a.legs.length >= 2);
}

export const ACCA_TEMPLATE_COUNT = { free: TEMPLATES.filter((t) => !t.pro).length, pro: TEMPLATES.length };