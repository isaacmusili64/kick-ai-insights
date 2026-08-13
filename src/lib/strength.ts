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
};

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
