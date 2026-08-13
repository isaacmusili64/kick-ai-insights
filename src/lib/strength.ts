import type { TeamModel } from "./model";

export type StandingRow = {
  position: number;
  team: { id: number; name: string; crest: string | null; tla: string | null };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type LeagueStrength = {
  rows: StandingRow[];
  leagueAvgGoals: number;
  /**
   * League-specific home-advantage multiplier for `predict()`, fitted from
   * this competition's actual home/away scoring split (via the standings
   * endpoint's HOME/AWAY tables) instead of one constant applied everywhere.
   * Falls back to the model's own default when a split isn't available
   * (some cup/group competitions only publish a TOTAL table).
   */
  homeAdvantage?: number;
};

/**
 * Fits a home-advantage multiplier from a competition's HOME/AWAY standings
 * split: teams score at `homeRate` goals/game at home and `awayRate` away,
 * so the model's home/away lambdas (which are `base * homeAdvantage` and
 * `base * (2 - homeAdvantage)`) should reproduce that split when
 * `homeAdvantage = 2 * homeRate / (homeRate + awayRate)`.
 * Clamped to a sane range so a handful of early-season games can't swing it.
 */
export function computeHomeAdvantage(
  homeRows: { goalsFor: number; playedGames: number }[],
  awayRows: { goalsFor: number; playedGames: number }[],
): number | undefined {
  const homeGames = homeRows.reduce((a, r) => a + r.playedGames, 0);
  const awayGames = awayRows.reduce((a, r) => a + r.playedGames, 0);
  if (homeGames < 20 || awayGames < 20) return undefined; // too little data to trust yet

  const homeRate = homeRows.reduce((a, r) => a + r.goalsFor, 0) / homeGames;
  const awayRate = awayRows.reduce((a, r) => a + r.goalsFor, 0) / awayGames;
  if (!homeRate || !awayRate) return undefined;

  return Math.min(1.45, Math.max(0.9, (2 * homeRate) / (homeRate + awayRate)));
}

/**
 * Builds the same TeamModel shape the Poisson/Dixon-Coles engine consumes,
 * but from season aggregate data (standings) instead of a match list. This
 * lets the model price every fixture in a league from two API calls.
 */
export function teamModelFromStanding(row: StandingRow, leagueAvgGoals: number): TeamModel {
  const played = Math.max(1, row.playedGames);
  const avgScored = row.goalsFor / played;
  const avgConceded = row.goalsAgainst / played;
  const base = leagueAvgGoals || 1.35;
  const sample = Math.min(row.playedGames, 12);
  const shrink = sample / (sample + 5);

  return {
    attack: Math.max(0.35, 1 + shrink * (avgScored / base - 1)),
    defence: Math.max(0.35, 1 + shrink * (avgConceded / base - 1)),
    homeAttack: avgScored,
    awayAttack: avgScored,
    form: [],
    formPoints: 0,
    avgScored,
    avgConceded,
    sample,
  };
}

export function leagueAverage(rows: StandingRow[]): number {
  const games = rows.reduce((a, r) => a + r.playedGames, 0);
  const goals = rows.reduce((a, r) => a + r.goalsFor, 0);
  return games ? goals / games : 1.35;
}
