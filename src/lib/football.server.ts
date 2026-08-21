/** football-data.org API access + response shaping. Server only. */

import { buildTeamModel, predict, type TeamMatch } from "./model";
import {
  applyTeamNews,
  blendModels,
  homeAdvantageFromGoals,
  homeAdvantageFromStandings,
  isFlatStrength,
  leagueAverage,
  mergeSeasons,
  teamModelFromStanding,
  type LeagueStrength,
  type StandingRow,
  type VenueSplit,
} from "./strength";
import type { Fixture, FeedFixture, CompetitionStatus } from "./types";
import {
  fetchEspnHomeSplit,
  fetchEspnRecentForm,
  fetchFixtureNews,
  fetchLeagueNewsFor,
  fetchLiveScores,
  finishedResults,
} from "./espn.server";
import { teamNewsExplanation, type FixtureNews, type TeamNews } from "./teamnews";

export type { Fixture, FeedFixture, CompetitionStatus } from "./types";

const BASE = "https://api.football-data.org/v4";

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

/** Rolling-window limiter: free tier allows ~10 requests / minute. Silent waits. */
const calls: number[] = [];
async function throttle() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const now = Date.now();
    while (calls.length && now - calls[0]! > 60_000) calls.shift();
    if (calls.length < 8) {
      calls.push(now);
      return;
    }
    // Quiet back-off; never log or throw early so batch jobs stay silent.
    await new Promise((r) => setTimeout(r, 750 + attempt * 50));
  }
  throw new Error("RATE_LIMITED");
}

async function api<T>(path: string, ttlMs = 60_000): Promise<T> {
  const token = process.env["FOOTBALL_DATA_API_KEY"];
  if (!token) throw new Error("MISSING_KEY");

  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  await throttle();
  const res = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": token } });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 403) throw new Error("RESTRICTED");
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`);
  const json = (await res.json()) as T;
  cache.set(path, { at: Date.now(), value: json });
  return json;
}

/** Fire-and-forget friendly: returns null on any failure instead of throwing. */
async function apiSoft<T>(path: string, ttlMs = 60_000): Promise<T | null> {
  try {
    return await api<T>(path, ttlMs);
  } catch {
    return null;
  }
}

export const COMPETITIONS = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "ELC", name: "Championship", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "FL1", name: "Ligue 1", country: "France" },
  { code: "DED", name: "Eredivisie", country: "Netherlands" },
  { code: "PPL", name: "Primeira Liga", country: "Portugal" },
  { code: "BSA", name: "SÃƒÂ©rie A", country: "Brazil" },
  { code: "CL", name: "Champions League", country: "Europe" },
  { code: "EL", name: "Europa League", country: "Europe" },
  { code: "EC", name: "European Championship", country: "Europe" },
  { code: "WC", name: "World Cup", country: "International" },
] as const;

/** Leagues available without PitchModel Pro. */
export const FREE_COMPETITIONS = ["PL", "ELC", "PD", "SA"] as const;

type ApiTeam = { id: number; name: string; shortName?: string; tla?: string; crest?: string };
type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  competition?: { code?: string; name?: string; emblem?: string };
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score?: { fullTime?: { home: number | null; away: number | null } };
};

function toFixture(m: ApiMatch): Fixture {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    competition: m.competition?.name ?? "",
    competitionCode: m.competition?.code ?? "",
    matchday: m.matchday ?? null,
    home: {
      id: m.homeTeam.id,
      name: m.homeTeam.shortName ?? m.homeTeam.name,
      crest: m.homeTeam.crest ?? null,
    },
    away: {
      id: m.awayTeam.id,
      name: m.awayTeam.shortName ?? m.awayTeam.name,
      crest: m.awayTeam.crest ?? null,
    },
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function fetchUpcoming(code: string): Promise<Fixture[]> {
  const from = new Date();
  const to = new Date(Date.now() + 21 * 86_400_000);
  const data = await api<{ matches: ApiMatch[] }>(
    `/competitions/${code}/matches?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`,
    120_000,
  );
  return data.matches
    .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
    .slice(0, 40)
    .map(toFixture);
}

export async function fetchMatch(id: number): Promise<Fixture> {
  const data = await api<ApiMatch>(`/matches/${id}`, 300_000);
  return toFixture(data);
}

export type TeamHistory = {
  matches: {
    goalsFor: number;
    goalsAgainst: number;
    isHome: boolean;
    opponent: string;
    date: string;
    result: "W" | "D" | "L";
  }[];
  leagueGoalSum: number;
  leagueGoalGames: number;
};

export async function fetchTeamHistory(teamId: number): Promise<TeamHistory> {
  // The free tier ignores `status=FINISHED` on this endpoint, so pull a date
  // window instead and keep the played matches.
  const from = isoDate(new Date(Date.now() - 260 * 86_400_000));
  const to = isoDate(new Date());
  const data = await api<{ matches: ApiMatch[] }>(
    `/teams/${teamId}/matches?dateFrom=${from}&dateTo=${to}`,
    600_000,
  );
  const ordered = [...data.matches]
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, 14);

  let leagueGoalSum = 0;
  let leagueGoalGames = 0;
  const matches = ordered.flatMap((m) => {
    const ft = m.score?.fullTime;
    if (!ft || ft.home === null || ft.away === null) return [];
    leagueGoalSum += ft.home + ft.away;
    leagueGoalGames += 1;
    const isHome = m.homeTeam.id === teamId;
    const goalsFor = isHome ? ft.home : ft.away;
    const goalsAgainst = isHome ? ft.away : ft.home;
    const result: "W" | "D" | "L" =
      goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L";
    return [
      {
        goalsFor,
        goalsAgainst,
        isHome,
        opponent:
          (isHome ? m.awayTeam.shortName ?? m.awayTeam.name : m.homeTeam.shortName ?? m.homeTeam.name) ??
          "",
        date: m.utcDate,
        result,
      },
    ];
  });

  return { matches, leagueGoalSum, leagueGoalGames };
}

export async function fetchHeadToHead(matchId: number) {
  const data = await api<{ matches: ApiMatch[] }>(`/matches/${matchId}/head2head?limit=6`, 600_000);
  return data.matches.flatMap((m) => {
    const ft = m.score?.fullTime;
    if (!ft || ft.home === null || ft.away === null) return [];
    return [
      {
        date: m.utcDate,
        home: m.homeTeam.shortName ?? m.homeTeam.name,
        away: m.awayTeam.shortName ?? m.awayTeam.name,
        score: `${ft.home}-${ft.away}`,
      },
    ];
  });
}
/* ------------------------------------------------------------------ *
 * League strength tables + model-priced fixture feed
 * ------------------------------------------------------------------ */

type ApiStandings = {
  standings: {
    type: string;
    group: string | null;
    table: {
      position: number;
      team: ApiTeam;
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      form?: string | null;
    }[];
  }[];
};

function parseForm(form?: string | null): ("W" | "D" | "L")[] {
  if (!form) return [];
  return form
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is "W" | "D" | "L" => s === "W" || s === "D" || s === "L")
    .reverse();
}

type ApiStandingsResponse = ApiStandings & { season?: { startDate?: string } };

async function fetchSeasonStandings(code: string, season?: number): Promise<LeagueStrength & { startYear: number | null }> {
  const data = await api<ApiStandingsResponse>(
    `/competitions/${code}/standings${season ? `?season=${season}` : ""}`,
    1_800_000,
  );
  const venueRow = (type: "HOME" | "AWAY", teamId: number) => {
    const t = data.standings
      .filter((s) => s.type === type)
      .flatMap((s) => s.table)
      .find((r) => r.team.id === teamId);
    if (!t) return null;
    return {
      playedGames: t.playedGames,
      won: t.won,
      draw: t.draw,
      lost: t.lost,
      goalsFor: t.goalsFor,
      goalsAgainst: t.goalsAgainst,
    };
  };

  const rows: StandingRow[] = data.standings
    .filter((s) => s.type === "TOTAL")
    .flatMap((s) => s.table)
    .map((r) => ({
      position: r.position,
      team: {
        id: r.team.id,
        name: r.team.shortName ?? r.team.name,
        crest: r.team.crest ?? null,
        tla: r.team.tla ?? null,
      },
      playedGames: r.playedGames,
      won: r.won,
      draw: r.draw,
      lost: r.lost,
      points: r.points,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      home: venueRow("HOME", r.team.id),
      away: venueRow("AWAY", r.team.id),
      form: parseForm(r.form),
    }));
  const startDate = data.season?.startDate;
  const startYear = startDate ? Number(startDate.slice(0, 4)) : null;
  return {
    rows,
    leagueAvgGoals: leagueAverage(rows),
    startYear: Number.isFinite(startYear) ? startYear : null,
  };
}

/**
 * Batched last-season finished matches from football-data.
 * Splits the previous season into ~90-day windows so we stay under the free-tier
 * rate limit. All failures are swallowed (soft) so the caller can fall through
 * to ESPN without noisy errors.
 */
async function fetchLastSeasonMatches(code: string, seasonYear: number): Promise<ApiMatch[]> {
  // Typical European season roughly Aug (seasonYear) Ã¢â€ â€™ May (seasonYear+1).
  const windows: [string, string][] = [
    [`${seasonYear}-08-01`, `${seasonYear}-10-31`],
    [`${seasonYear}-11-01`, `${seasonYear + 1}-01-31`],
    [`${seasonYear + 1}-02-01`, `${seasonYear + 1}-04-30`],
    [`${seasonYear + 1}-05-01`, `${seasonYear + 1}-07-31`],
  ];

  const all: ApiMatch[] = [];
  const seen = new Set<number>();

  for (const [from, to] of windows) {
    const data = await apiSoft<{ matches: ApiMatch[] }>(
      `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`,
      3_600_000,
    );
    if (!data?.matches) continue;
    for (const m of data.matches) {
      if (m.status !== "FINISHED" || seen.has(m.id)) continue;
      const ft = m.score?.fullTime;
      if (!ft || ft.home === null || ft.away === null) continue;
      seen.add(m.id);
      all.push(m);
    }
  }
  return all;
}

/** Aggregate finished matches into a LeagueStrength table (TOTAL + HOME/AWAY). */
function strengthFromMatches(matches: ApiMatch[]): LeagueStrength | null {
  if (matches.length < 20) return null;

  type Acc = {
    team: ApiTeam;
    played: number;
    won: number;
    draw: number;
    lost: number;
    gf: number;
    ga: number;
    home: VenueSplit;
    away: VenueSplit;
    form: ("W" | "D" | "L")[];
  };

  const byId = new Map<number, Acc>();

  const ensure = (t: ApiTeam): Acc => {
    let a = byId.get(t.id);
    if (!a) {
      a = {
        team: t,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        home: { playedGames: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
        away: { playedGames: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
        form: [],
      };
      byId.set(t.id, a);
    }
    return a;
  };

  // Newest first for form strings.
  const ordered = [...matches].sort((a, b) => b.utcDate.localeCompare(a.utcDate));

  for (const m of ordered) {
    const ft = m.score!.fullTime!;
    const hg = ft.home!;
    const ag = ft.away!;

    const home = ensure(m.homeTeam);
    const away = ensure(m.awayTeam);

    home.played += 1;
    away.played += 1;
    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    home.home.playedGames += 1;
    home.home.goalsFor += hg;
    home.home.goalsAgainst += ag;
    away.away.playedGames += 1;
    away.away.goalsFor += ag;
    away.away.goalsAgainst += hg;

    if (hg > ag) {
      home.won += 1;
      away.lost += 1;
      home.home.won += 1;
      away.away.lost += 1;
      if (home.form.length < 6) home.form.push("W");
      if (away.form.length < 6) away.form.push("L");
    } else if (hg < ag) {
      home.lost += 1;
      away.won += 1;
      home.home.lost += 1;
      away.away.won += 1;
      if (home.form.length < 6) home.form.push("L");
      if (away.form.length < 6) away.form.push("W");
    } else {
      home.draw += 1;
      away.draw += 1;
      home.home.draw += 1;
      away.away.draw += 1;
      if (home.form.length < 6) home.form.push("D");
      if (away.form.length < 6) away.form.push("D");
    }
  }

  const rows: StandingRow[] = [...byId.values()]
    .map((a) => ({
      position: 0,
      team: {
        id: a.team.id,
        name: a.team.shortName ?? a.team.name,
        crest: a.team.crest ?? null,
        tla: a.team.tla ?? null,
      },
      playedGames: a.played,
      won: a.won,
      draw: a.draw,
      lost: a.lost,
      points: a.won * 3 + a.draw,
      goalsFor: a.gf,
      goalsAgainst: a.ga,
      home: a.home.playedGames ? a.home : null,
      away: a.away.playedGames ? a.away : null,
      form: a.form,
    }))
    .sort((x, y) => y.points - x.points || y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst))
    .map((r, i) => ({ ...r, position: i + 1 }));

  if (rows.length < 8) return null;
  return { rows, leagueAvgGoals: leagueAverage(rows) };
}

/** ESPN finished results Ã¢â€ â€™ LeagueStrength (name-based ids so merge still works by name). */
async function strengthFromEspn(code: string): Promise<LeagueStrength | null> {
  const events = await finishedResults(code, 400).catch(() => []);
  if (events.length < 20) return null;

  // Re-shape ESPN events into the same ApiMatch-like structure using synthetic ids.
  const fake: ApiMatch[] = events.map((e, i) => ({
    id: i + 1,
    utcDate: e.date,
    status: "FINISHED",
    homeTeam: { id: 10_000 + (e.home.length * 17) % 9000, name: e.home, shortName: e.home },
    awayTeam: { id: 20_000 + (e.away.length * 19) % 9000, name: e.away, shortName: e.away },
    score: { fullTime: { home: e.live.homeGoals, away: e.live.awayGoals } },
  }));
  return strengthFromMatches(fake);
}

/**
 * League strength for pricing. When the current season is too young for the
 * table to say anything (every team on ~0 games), last season data is blended
 * in so teams are actually differentiated.
 *
 * Order of preference:
 *  1. football-data previous-season standings
 *  2. football-data last-season finished matches (batched date windows)
 *  3. ESPN finished results (400-day window)
 */
export async function fetchLeagueStrength(code: string): Promise<LeagueStrength> {
  const current = await fetchSeasonStandings(code);
  const base: LeagueStrength = { rows: current.rows, leagueAvgGoals: current.leagueAvgGoals };
  const avgPlayed = current.rows.length
    ? current.rows.reduce((a, r) => a + r.playedGames, 0) / current.rows.length
    : 0;
  // Enough current-season evidence and already differentiated â†’ use as-is.
  if (avgPlayed >= 12 && !isFlatStrength(base)) return base;

  const startYear = current.startYear ?? new Date().getUTCFullYear();
  const prevYear = startYear - 1;

  let merged: LeagueStrength = base;

  // 1) Official previous standings (often restricted on free tier)
  try {
    const previous = await fetchSeasonStandings(code, prevYear);
    if (previous.rows.length) {
      merged = mergeSeasons(base, previous);
      if (!isFlatStrength(merged)) return merged;
    }
  } catch {
    /* restricted / unavailable â€” fall through */
  }

  // 2a) football-data last-season matches via season filter (one call)
  try {
    const seasonData = await apiSoft<{ matches: ApiMatch[] }>(
      `/competitions/${code}/matches?season=${prevYear}`,
      3_600_000,
    );
    const finished = (seasonData?.matches ?? []).filter((m) => {
      const ft = m.score?.fullTime;
      return m.status === "FINISHED" && ft && ft.home !== null && ft.away !== null;
    });
    const fromSeason = strengthFromMatches(finished);
    if (fromSeason) {
      merged = mergeSeasons(base, fromSeason);
      if (!isFlatStrength(merged)) return merged;
    }
  } catch {
    /* ignore */
  }

  // 2b) football-data last-season matches (batched date windows)
  try {
    const matches = await fetchLastSeasonMatches(code, prevYear);
    const fromMatches = strengthFromMatches(matches);
    if (fromMatches) {
      merged = mergeSeasons(base, fromMatches);
      if (!isFlatStrength(merged)) return merged;
    }
  } catch {
    /* ignore */
  }

  // 3) ESPN finished results (400-day window) â€” fuzzy name merge handles short names
  try {
    const fromEspn = await strengthFromEspn(code);
    if (fromEspn) {
      merged = mergeSeasons(base, fromEspn);
      if (!isFlatStrength(merged)) return merged;
    }
  } catch {
    /* ignore */
  }

  return merged;
}

export type Feed = {
  fixtures: FeedFixture[];
  competitions: CompetitionStatus[];
};

type PriceExtras = {
  /** ESPN team news, keyed by the standings-table team name. */
  newsByTeam?: Map<string, TeamNews>;
  /** ESPN-sourced recent match history, keyed by the standings-table team name. */
  recentByTeam?: Map<string, TeamMatch[]>;
};

function priceFixtures(
  fixtures: Fixture[],
  strength: LeagueStrength | null,
  homeAdvantage?: number,
  extras?: PriceExtras,
): FeedFixture[] {
  if (!strength || strength.rows.length === 0) return fixtures.map((f) => ({ ...f, prediction: null }));
  const s = strength;
  const byId = new Map(s.rows.map((r) => [r.team.id, r]));
  const advantage = homeAdvantage ?? homeAdvantageFromStandings(s.rows);
  const newsByTeam = extras?.newsByTeam;
  const recentByTeam = extras?.recentByTeam;

  // Season-table model, optionally sharpened with ESPN's recent-form read
  // (same blend fetchAnalysis does with football-data's per-team history) and
  // ESPN's current team news, so the board isn't priced on standings alone.
  const modelFor = (row: StandingRow, venue: "home" | "away") => {
    let model = teamModelFromStanding(row, s.leagueAvgGoals, venue);
    const recent = recentByTeam?.get(row.team.name);
    if (recent && recent.length >= 3) {
      model = blendModels(model, buildTeamModel(recent, s.leagueAvgGoals), 0.6);
    }
    const news = newsByTeam?.get(row.team.name);
    if (news) model = applyTeamNews(model, news);
    return model;
  };

  return fixtures.map((f) => {
    const home = byId.get(f.home.id);
    const away = byId.get(f.away.id);
    if (!home || !away) return { ...f, prediction: null };
    return {
      ...f,
      prediction: predict(modelFor(home, "home"), modelFor(away, "away"), s.leagueAvgGoals, advantage),
    };
  });
}

const FEED_STATUSES = new Set(["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "FINISHED"]);

export async function fetchCompetitionFeed(code: string, days = 21) {
  const from = isoDate(new Date());
  const to = isoDate(new Date(Date.now() + days * 86_400_000));
  const matches = await api<{ matches: ApiMatch[] }>(
    `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`,
    600_000,
  );
  const fixtures = matches.matches
    .filter((m) => {
      if (!FEED_STATUSES.has(m.status)) return false;
      // Keep completed/in-play games only while they are still "today's board".
      if (m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED") {
        return Date.now() - new Date(m.utcDate).getTime() < 30 * 3_600_000;
      }
      return true;
    })
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate)
