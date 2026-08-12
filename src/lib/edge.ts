import type { ExtendedPrediction } from "./model";

/**
 * PitchModel has no live odds feed. To make "model edge" meaningful without one we
 * build a transparent market baseline: the same 1X2 probabilities shrunk toward the
 * long-run league average (markets are far more conservative than a pure Poisson fit)
 * and then loaded with a typical 5% bookmaker overround.
 *
 * Edge = model probability − baseline implied probability. Users can override the
 * baseline with real odds on the match page.
 */
const LEAGUE_PRIOR = { home: 0.44, draw: 0.26, away: 0.3 };
const SHRINK = 0.55;
const OVERROUND = 1.05;

export type EdgeRow = {
  label: string;
  model: number;
  implied: number;
  edge: number;
  fairOdds: number;
  marketOdds: number;
};

function shrink(model: number, prior: number) {
  return SHRINK * model + (1 - SHRINK) * prior;
}

export function baselineImplied(p: ExtendedPrediction) {
  const home = shrink(p.homeWin, LEAGUE_PRIOR.home) * OVERROUND;
  const draw = shrink(p.draw, LEAGUE_PRIOR.draw) * OVERROUND;
  const away = shrink(p.awayWin, LEAGUE_PRIOR.away) * OVERROUND;
  return { home, draw, away };
}

export function devig(home: number, draw: number, away: number) {
  const sum = home + draw + away || 1;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

export function edgeRows(
  p: ExtendedPrediction,
  homeName: string,
  awayName: string,
  odds?: { home: number; draw: number; away: number } | null,
): EdgeRow[] {
  const implied =
    odds && odds.home > 1 && odds.draw > 1 && odds.away > 1
      ? { home: 1 / odds.home, draw: 1 / odds.draw, away: 1 / odds.away }
      : baselineImplied(p);

  const rows: [string, number, number][] = [
    [`${homeName} win`, p.homeWin, implied.home],
    ["Draw", p.draw, implied.draw],
    [`${awayName} win`, p.awayWin, implied.away],
  ];

  return rows.map(([label, model, imp]) => ({
    label,
    model,
    implied: imp,
    edge: model - imp,
    fairOdds: model > 0 ? 1 / model : 0,
    marketOdds: imp > 0 ? 1 / imp : 0,
  }));
}

export function bestEdge(p: ExtendedPrediction, homeName: string, awayName: string): EdgeRow {
  return edgeRows(p, homeName, awayName).sort((a, b) => b.edge - a.edge)[0]!;
}

export const EDGE_THRESHOLD = 0.05;