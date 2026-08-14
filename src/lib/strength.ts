import type { TeamModel } from "./model";

export type VenueSplit = {
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

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
  /** Home-only season split, when the feed exposes it. */
  home?: VenueSplit | null;
  /** Away-only season split, when the feed exposes it. */
  away?: VenueSplit | null;
  /** Recent results, newest first, e.g. ["W","D","L"]. */
  form?: ("W" | "D" | "L")[];
};

export type LeagueStrength = {
  rows: StandingRow[];
  leagueAvgGoals: number;
};

/** Points per game from the recent-form string, or null when unknown. */
function formPpg(form: ("W" | "D" | "L")[] | undefined): number | null {
  if (!form || form.length === 0) return null;
  const games = form.slice(0, 6);
  const pts = games.reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  return pts / games.length;
}

/**
 * Builds the TeamModel the Poisson/Dixon-Coles engine consumes from season
 * data. Rather than season totals alone this uses:
 *  - venue-specific scoring/conceding rates (home form vs away form),
 *  - recent-form momentum (last games points per game vs the league mean),
 *  - shrinkage toward the league average when the sample is thin.
 */
export function teamModelFromStanding(
  row: StandingRow,
  leagueAvgGoals: number,
  venue: "home" | "away" = "home",
): TeamModel {
  const played = Math.max(1, row.playedGames);
  const base = leagueAvgGoals || 1.35;

  const seasonScored = row.goalsFor / played;
  const seasonConceded = row.goalsAgainst / played;

  const split = venue === "home" ? row.home : row.away;
  const venueGames = split?.playedGames ?? 0;
  // Weight the venue split by how much of it we have (fully trusted from ~6 games).
  const venueWeight = venueGames >= 3 ? Math.min(0.65, (venueGames / 6) * 0.65) : 0;
  const venueScored = venueGames ? (split!.goalsFor ?? 0) / venueGames : seasonScored;
  const venueConceded = venueGames ? (split!.goalsAgainst ?? 0) / venueGames : seasonConceded;

  let avgScored = venueWeight * venueScored + (1 - venueWeight) * seasonScored;
  let avgConceded = venueWeight * venueConceded + (1 - venueWeight) * seasonConceded;

  // Recent form momentum: a hot team scores a touch more and leaks a touch less.
  const ppg = formPpg(row.form);
  const leaguePpg = 1.35;
  const momentum = ppg === null ? 0 : Math.max(-1, Math.min(1, (ppg - leaguePpg) / 1.65));
  avgScored *= 1 + 0.1 * momentum;
  avgConceded *= 1 - 0.1 * momentum;

  const sample = Math.min(row.playedGames, 14);
  const shrink = sample / (sample + 4);
  const homeGames = row.home?.playedGames ?? 0;
  const awayGames = row.away?.playedGames ?? 0;

  return {
    attack: Math.max(0.35, 1 + shrink * (avgScored / base - 1)),
    defence: Math.max(0.35, 1 + shrink * (avgConceded / base - 1)),
    homeAttack: homeGames ? (row.home!.goalsFor ?? 0) / homeGames : seasonScored,
    awayAttack: awayGames ? (row.away!.goalsFor ?? 0) / awayGames : seasonScored,
    form: (row.form ?? []).slice(0, 5),
    formPoints: (row.form ?? [])
      .slice(0, 5)
      .reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0),
    avgScored,
    avgConceded,
    sample,
  };
}

/**
 * Blends two views of the same team (e.g. season standings vs last 12 matches)
 * into a single model. `weightA` is the share given to the first model.
 */
export function blendModels(a: TeamModel, b: TeamModel, weightA = 0.6): TeamModel {
  const w = Math.max(0, Math.min(1, weightA));
  const mix = (x: number, y: number) => w * x + (1 - w) * y;
  return {
    attack: mix(a.attack, b.attack),
    defence: mix(a.defence, b.defence),
    homeAttack: mix(a.homeAttack, b.homeAttack),
    awayAttack: mix(a.awayAttack, b.awayAttack),
    form: b.form.length ? b.form : a.form,
    formPoints: b.form.length ? b.formPoints : a.formPoints,
    avgScored: mix(a.avgScored, b.avgScored),
    avgConceded: mix(a.avgConceded, b.avgConceded),
    sample: a.sample + b.sample,
  };
}

export function leagueAverage(rows: StandingRow[]): number {
  const games = rows.reduce((a, r) => a + r.playedGames, 0);
  const goals = rows.reduce((a, r) => a + r.goalsFor, 0);
  return games ? goals / games : 1.35;
}
