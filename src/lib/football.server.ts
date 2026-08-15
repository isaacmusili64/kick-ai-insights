/** football-data.org API access + response shaping. Server only. */

import { buildTeamModel, predict, type ExtendedPrediction } from "./model";
import {
  applyTeamNews,
  blendModels,
  homeAdvantageFromGoals,
  homeAdvantageFromStandings,
  leagueAverage,
  teamModelFromStanding,
  type LeagueStrength,
  type StandingRow,
} from "./strength";
import type { Fixture, FeedFixture, CompetitionStatus } from "./types";
import { fetchEspnHomeSplit, fetchFixtureNews, fetchLiveScores } from "./espn.server";
import { teamNewsExplanation, type FixtureNews } from "./teamnews";

export type { Fixture, FeedFixture, CompetitionStatus } from "./types";

const BASE = "https://api.football-data.org/v4";

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

/** Rolling-window limiter: the free data tier allows 10 requests / minute. */
const calls: number[] = [];
async function throttle() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const now = Date.now();
    while (calls.length && now - calls[0]! > 60_000) calls.shift();
    if (calls.length < 9) {
      calls.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
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

export const COMPETITIONS = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "ELC", name: "Championship", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "FL1", name: "Ligue 1", country: "France" },
  { code: "DED", name: "Eredivisie", country: "Netherlands" },
  { code: "PPL", name: "Primeira Liga", country: "Portugal" },
  { code: "BSA", name: "Série A", country: "Brazil" },
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

export async function fetchLeagueStrength(code: string): Promise<LeagueStrength> {
  const data = await api<ApiStandings>(`/competitions/${code}/standings`, 1_800_000);
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
  return { rows, leagueAvgGoals: leagueAverage(rows) };
}

export type Feed = {
  fixtures: FeedFixture[];
  competitions: CompetitionStatus[];
};

function priceFixtures(
  fixtures: Fixture[],
  strength: LeagueStrength | null,
  homeAdvantage?: number,
): FeedFixture[] {
  if (!strength || strength.rows.length === 0) return fixtures.map((f) => ({ ...f, prediction: null }));
  const byId = new Map(strength.rows.map((r) => [r.team.id, r]));
  const advantage = homeAdvantage ?? homeAdvantageFromStandings(strength.rows);
  return fixtures.map((f) => {
    const home = byId.get(f.home.id);
    const away = byId.get(f.away.id);
    if (!home || !away) return { ...f, prediction: null };
    return {
      ...f,
      prediction: predict(
        teamModelFromStanding(home, strength.leagueAvgGoals, "home"),
        teamModelFromStanding(away, strength.leagueAvgGoals, "away"),
        strength.leagueAvgGoals,
        advantage,
      ),
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
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
    .slice(0, 60)
    .map(toFixture);

  let strength: LeagueStrength | null = null;
  try {
    strength = await fetchLeagueStrength(code);
  } catch {
    strength = null;
  }

  const priced = priceFixtures(fixtures, strength, await homeAdvantageFor(code, strength));
  const live = await fetchLiveScores(code, priced).catch(() => new Map());
  const withLive = priced.map((f) => ({ ...f, live: live.get(f.id) ?? null }));
  return { fixtures: withLive, modelled: Boolean(strength) };
}

/**
 * Home advantage measured from data: recent completed results in the league
 * (ESPN) blended with the season HOME/AWAY standings splits. Nothing hardcoded
 * beyond a neutral fallback when neither source has enough games.
 */
async function homeAdvantageFor(code: string, strength: LeagueStrength | null): Promise<number> {
  const fromTable = strength ? homeAdvantageFromStandings(strength.rows) : null;
  const recent = await fetchEspnHomeSplit(code).catch(() => null);
  const fromRecent = recent ? homeAdvantageFromGoals(recent.homeGoals, recent.awayGoals, recent.games) : null;
  if (fromTable !== null && fromRecent !== null) return 0.7 * fromTable + 0.3 * fromRecent;
  return fromTable ?? fromRecent ?? 1.12;
}

export async function fetchFeed(codes: string[], days = 21): Promise<Feed> {
  const wanted = codes.slice(0, 13);
  const fixtures: FeedFixture[] = [];
  const competitions: CompetitionStatus[] = [];
  const deadline = Date.now() + 25_000;

  for (const code of wanted) {
    const name = COMPETITIONS.find((c) => c.code === code)?.name ?? code;
    if (Date.now() > deadline) {
      competitions.push({ code, name, error: "RATE_LIMITED", modelled: false });
      continue;
    }
    try {
      const result = await fetchCompetitionFeed(code, days);
      fixtures.push(...result.fixtures);
      competitions.push({ code, name, error: null, modelled: result.modelled });
    } catch (error) {
      competitions.push({ code, name, error: (error as Error).message, modelled: false });
    }
  }

  fixtures.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  return { fixtures, competitions };
}

export type GradedMatch = {
  id: number;
  date: string;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
};

/** Matches already played in a competition, with final scores, for scoring the model. */
export async function gradedMatches(code: string, days = 120): Promise<GradedMatch[]> {
  const from = isoDate(new Date(Date.now() - days * 86_400_000));
  const to = isoDate(new Date());
  const data = await api<{ matches: ApiMatch[] }>(
    `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`,
    1_800_000,
  );
  return data.matches.flatMap((m) => {
    const ft = m.score?.fullTime;
    if (m.status !== "FINISHED" || !ft || ft.home === null || ft.away === null) return [];
    return [
      {
        id: m.id,
        date: m.utcDate,
        homeId: m.homeTeam.id,
        awayId: m.awayTeam.id,
        homeName: m.homeTeam.shortName ?? m.homeTeam.name,
        awayName: m.awayTeam.shortName ?? m.awayTeam.name,
        homeGoals: ft.home,
        awayGoals: ft.away,
      },
    ];
  });
}

/** Final scores for specific match ids (used when grading logged predictions). */
export async function fetchResults(ids: number[]) {
  const out: { id: number; homeGoals: number; awayGoals: number; status: string }[] = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const data = await api<ApiMatch>(`/matches/${id}`, 300_000);
      const ft = data.score?.fullTime;
      out.push({
        id,
        status: data.status,
        homeGoals: ft?.home ?? -1,
        awayGoals: ft?.away ?? -1,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function fetchAnalysis(matchId: number) {
  const fixture = await fetchMatch(matchId);
  let strength: LeagueStrength | null = null;
  try {
    strength = fixture.competitionCode ? await fetchLeagueStrength(fixture.competitionCode) : null;
  } catch {
    strength = null;
  }
  const table = strength
    ? {
        home: strength.rows.find((r) => r.team.id === fixture.home.id) ?? null,
        away: strength.rows.find((r) => r.team.id === fixture.away.id) ?? null,
        leagueAvgGoals: strength.leagueAvgGoals,
      }
    : null;

  const [homeHistory, awayHistory, h2h, rawNews, live] = await Promise.all([
    fetchTeamHistory(fixture.home.id).catch(() => null),
    fetchTeamHistory(fixture.away.id).catch(() => null),
    fetchHeadToHead(matchId).catch(() => []),
    fetchFixtureNews(fixture.competitionCode, fixture.home.name, fixture.away.name).catch(() => null),
    fetchLiveScores(fixture.competitionCode, [fixture]).catch(() => new Map()),
  ]);

  const news: FixtureNews = {
    home: rawNews?.home ?? { items: [], attackMul: 1, defenceMul: 1, severity: 0, outCount: 0 },
    away: rawNews?.away ?? { items: [], attackMul: 1, defenceMul: 1, severity: 0, outCount: 0 },
    available: rawNews?.available ?? false,
    explanation: "",
  };
  news.explanation = teamNewsExplanation(fixture.home.name, fixture.away.name, news.home, news.away);

  const advantage = await homeAdvantageFor(fixture.competitionCode, strength);

  // Match-page prediction blends the season table view (venue splits + form)
  // with a recency-weighted read of each side's last dozen games.
  const [priced] = priceFixtures([fixture], strength, advantage);
  let prediction = priced?.prediction ?? null;

  const histGames = (homeHistory?.leagueGoalGames ?? 0) + (awayHistory?.leagueGoalGames ?? 0);
  const histAvg = histGames
    ? ((homeHistory?.leagueGoalSum ?? 0) + (awayHistory?.leagueGoalSum ?? 0)) / histGames / 2
    : null;
  const leagueAvgGoals = strength?.leagueAvgGoals ?? histAvg ?? 1.35;

  if (homeHistory?.matches.length && awayHistory?.matches.length) {
    const homeRecent = buildTeamModel(homeHistory.matches, leagueAvgGoals);
    const awayRecent = buildTeamModel(awayHistory.matches, leagueAvgGoals);
    const homeTable = table?.home ? teamModelFromStanding(table.home, leagueAvgGoals, "home") : null;
    const awayTable = table?.away ? teamModelFromStanding(table.away, leagueAvgGoals, "away") : null;
    prediction = predict(
      applyTeamNews(homeTable ? blendModels(homeTable, homeRecent, 0.55) : homeRecent, news.home),
      applyTeamNews(awayTable ? blendModels(awayTable, awayRecent, 0.55) : awayRecent, news.away),
      leagueAvgGoals,
      advantage,
    );
  } else if (prediction && table?.home && table?.away) {
    prediction = predict(
      applyTeamNews(teamModelFromStanding(table.home, leagueAvgGoals, "home"), news.home),
      applyTeamNews(teamModelFromStanding(table.away, leagueAvgGoals, "away"), news.away),
      leagueAvgGoals,
      advantage,
    );
  }

  return {
    fixture,
    prediction,
    table,
    h2h,
    news,
    live: live.get(fixture.id) ?? null,
    homeAdvantage: advantage,
    history: {
      home: homeHistory?.matches.slice(0, 12) ?? [],
      away: awayHistory?.matches.slice(0, 12) ?? [],
    },
  };
}
