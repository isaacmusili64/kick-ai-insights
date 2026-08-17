import type { TeamModel } from "./model";
import type { TeamNews } from "./teamnews";

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

function scaleSplit(split: VenueSplit | null | undefined, games: number): VenueSplit | null {
  if (!split || split.playedGames <= 0 || games <= 0) return null;
  const k = games / split.playedGames;
  return {
    playedGames: games,
    won: split.won * k,
    draw: split.draw * k,
    lost: split.lost * k,
    goalsFor: split.goalsFor * k,
    goalsAgainst: split.goalsAgainst * k,
  };
}

function addSplit(a: VenueSplit | null, b: VenueSplit | null): VenueSplit | null {
  if (!a) return b;
  if (!b) return a;
  return {
    playedGames: a.playedGames + b.playedGames,
    won: a.won + b.won,
    draw: a.draw + b.draw,
    lost: a.lost + b.lost,
    goalsFor: a.goalsFor + b.goalsFor,
    goalsAgainst: a.goalsAgainst + b.goalsAgainst,
  };
}

/**
 * Blends last season's table into the current one so early-season fixtures are
 * priced on real team quality instead of a near-empty table (which collapses
 * every side toward the league average and makes every match look identical).
 *
 * Last season is discounted and capped, and its weight fades away as the
 * current season accumulates games.
 */
export function mergeSeasons(current: LeagueStrength, previous: LeagueStrength): LeagueStrength {
  const playedNow = current.rows.reduce((a, r) => a + r.playedGames, 0) / Math.max(1, current.rows.length);
  // Full prior weight before a ball is kicked, none once ~12 games are in.
  const fade = Math.max(0, 1 - playedNow / 12);
  if (fade <= 0.01) return current;

  const prevByName = new Map(previous.rows.map((r) => [r.team.name.toLowerCase(), r]));
  const rows = current.rows.map((row) => {
    const prev = prevByName.get(row.team.name.toLowerCase());
    if (!prev || prev.playedGames <= 0) return row;

    const priorGames = Math.min(prev.playedGames, 24) * 0.75 * fade;
    if (priorGames < 1) return row;
    const k = priorGames / prev.playedGames;

    return {
      ...row,
      playedGames: row.playedGames + priorGames,
      won: row.won + prev.won * k,
      draw: row.draw + prev.draw * k,
      lost: row.lost + prev.lost * k,
      goalsFor: row.goalsFor + prev.goalsFor * k,
      goalsAgainst: row.goalsAgainst + prev.goalsAgainst * k,
      home: addSplit(row.home ?? null, scaleSplit(prev.home, (prev.home?.playedGames ?? 0) * k)),
      away: addSplit(row.away ?? null, scaleSplit(prev.away, (prev.away?.playedGames ?? 0) * k)),
      form: row.form && row.form.length ? row.form : prev.form ?? [],
    } satisfies StandingRow;
  });

  return { rows, leagueAvgGoals: leagueAverage(rows) };
}

/**
 * Measures the home-field effect from data instead of assuming it.
 *
 * The engine scales home goals by `h` and away goals by `2 - h`, so for an
 * observed home:away goal ratio `r` the consistent value is `h = 2r / (1 + r)`.
 * Falls back to the league-neutral 1.0 when there is nothing to measure, and is
 * clamped so a small sample can't produce an extreme edge.
 */
export function homeAdvantageFromGoals(homeGoals: number, awayGoals: number, games: number): number {
  if (games < 6 || homeGoals + awayGoals === 0) return 1.12;
  const ratio = (homeGoals + 1) / (awayGoals + 1);
  const raw = (2 * ratio) / (1 + ratio);
  // Shrink toward neutral for small samples.
  const trust = Math.min(1, games / 40);
  const shrunk = 1 + (raw - 1) * trust;
  return Math.max(0.95, Math.min(1.3, shrunk));
}

/** Home advantage implied by a league's HOME/AWAY standings splits. */
export function homeAdvantageFromStandings(rows: StandingRow[]): number {
  let homeGoals = 0;
  let awayGoals = 0;
  let games = 0;
  for (const r of rows) {
    if (r.home && r.home.playedGames > 0) {
      homeGoals += r.home.goalsFor;
      awayGoals += r.home.goalsAgainst;
      games += r.home.playedGames;
    }
  }
  return homeAdvantageFromGoals(homeGoals, awayGoals, games);
}

/** Applies availability (injury/suspension) multipliers to a team model. */
export function applyTeamNews(model: TeamModel, news: TeamNews | null | undefined): TeamModel {
  if (!news || news.items.length === 0) return model;
  return {
    ...model,
    attack: Math.max(0.3, model.attack * news.attackMul),
    defence: Math.max(0.3, model.defence * news.defenceMul),
    avgScored: model.avgScored * news.attackMul,
    avgConceded: model.avgConceded * news.defenceMul,
  };
}
