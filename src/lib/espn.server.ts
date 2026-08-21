/**
 * ESPN's public (unofficial) soccer endpoints. Used to enrich the model with
 * live scores, match state and team availability. Server only, best effort:
 * every helper resolves to null/empty rather than throwing so the core
 * football-data pipeline keeps working when ESPN is unavailable.
 */

import type { LiveScore, MatchState } from "./live";
import { buildTeamNews, EMPTY_NEWS, type Availability, type NewsItem, type TeamNews } from "./teamnews";
import type { TeamMatch } from "./model";

/** football-data competition code -> ESPN league slug. */
export const ESPN_LEAGUES: Record<string, string> = {
  PL: "eng.1",
  ELC: "eng.2",
  PD: "esp.1",
  SA: "ita.1",
  BL1: "ger.1",
  FL1: "fra.1",
  DED: "ned.1",
  PPL: "por.1",
  BSA: "bra.1",
  CL: "uefa.champions",
  EL: "uefa.europa",
  EC: "uefa.euro",
  WC: "fifa.world",
};

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function get<T>(url: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    cache.set(url, { at: Date.now(), value: json });
    return json;
  } catch {
    return null;
  }
}

/* ----------------------------- name matching ----------------------------- */

const NOISE = new Set([
  "fc", "cf", "sc", "ac", "afc", "cd", "ud", "sv", "vfl", "vfb", "tsg", "bsc", "as", "ss", "us",
  "club", "de", "the", "1", "and", "calcio", "futbol", "football", "sport", "sporting", "team",
]);

export function normaliseTeam(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

function similarity(a: string, b: string): number {
  const ta = normaliseTeam(a);
  const tb = normaliseTeam(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  let hits = 0;
  for (const t of ta) {
    if (tb.some((u) => u === t || (t.length >= 4 && u.startsWith(t.slice(0, 4))))) hits += 1;
  }
  return hits / Math.max(ta.length, tb.length);
}

function bestMatch<T>(name: string, items: T[], nameOf: (item: T) => string[]): T | null {
  let best: T | null = null;
  let score = 0;
  for (const item of items) {
    for (const candidate of nameOf(item)) {
      const s = similarity(name, candidate);
      if (s > score) {
        score = s;
        best = item;
      }
    }
  }
  // Slightly lower threshold so short-name / crest-name mismatches still match.
  return score >= 0.45 ? best : null;
}

/* ------------------------------- scoreboard ------------------------------ */

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: { displayName?: string; shortDisplayName?: string; name?: string; abbreviation?: string };
};

type EspnEvent = {
  id: string;
  date: string;
  status?: { type?: { name?: string; detail?: string; shortDetail?: string; state?: string }; displayClock?: string };
  competitions?: { competitors?: EspnCompetitor[] }[];
};

function stateOf(statusName: string | undefined): MatchState {
  const n = (statusName ?? "").toUpperCase();
  if (n.includes("FULL_TIME") || n.includes("FINAL") || n.includes("AGGREGATE")) return "finished";
  if (n.includes("POSTPONED") || n.includes("CANCEL") || n.includes("ABANDON")) return "postponed";
  if (
    n.includes("HALFTIME") ||
    n.includes("FIRST_HALF") ||
    n.includes("SECOND_HALF") ||
    n.includes("IN_PROGRESS") ||
    n.includes("EXTRA") ||
    n.includes("SHOOTOUT") ||
    n.includes("OVERTIME")
  )
    return "live";
  return "scheduled";
}

export type EspnMatch = {
  eventId: string;
  date: string;
  home: string;
  away: string;
  live: LiveScore;
};

function ymd(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseEvents(events: EspnEvent[]): EspnMatch[] {
  return events.flatMap((e) => {
    const comps = e.competitions?.[0]?.competitors ?? [];
    const home = comps.find((c) => c.homeAway === "home");
    const away = comps.find((c) => c.homeAway === "away");
    if (!home || !away) return [];
    const state = stateOf(e.status?.type?.name);
    const toGoals = (v: string | undefined) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return [
      {
        eventId: e.id,
        date: e.date,
        home: home.team.displayName ?? home.team.name ?? "",
        away: away.team.displayName ?? away.team.name ?? "",
        live: {
          state,
          detail:
            state === "live"
              ? e.status?.displayClock || e.status?.type?.shortDetail || null
              : state === "finished"
                ? e.status?.type?.shortDetail ?? "FT"
                : null,
          homeGoals: state === "scheduled" ? null : toGoals(home.score),
          awayGoals: state === "scheduled" ? null : toGoals(away.score),
        },
      },
    ];
  });
}

/** All ESPN events for a league on the given UTC day (defaults to today). */
export async function fetchEspnScoreboard(code: string, date = new Date(), ttlMs = 25_000): Promise<EspnMatch[]> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return [];
  const data = await get<{ events?: EspnEvent[] }>(`${SITE}/${slug}/scoreboard?dates=${ymd(date)}`, ttlMs);
  return parseEvents(data?.events ?? []);
}

/**
 * All ESPN events for a league across a date range (inclusive). One request
 * covers weeks of fixtures, which makes deep history (including last season)
 * cheap enough to pull when the current season is too young to model.
 */
export async function fetchEspnRange(
  code: string,
  from: Date,
  to: Date,
  ttlMs = 6 * 3_600_000,
): Promise<EspnMatch[]> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return [];
  const data = await get<{ events?: EspnEvent[] }>(
    `${SITE}/${slug}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=400`,
    ttlMs,
  );
  return parseEvents(data?.events ?? []);
}

/** Finished results for a league going back `days`, newest first. Exported for strength fallback. */
export async function finishedResults(code: string, days: number): Promise<EspnMatch[]> {
  const chunks: Promise<EspnMatch[]>[] = [];
  const now = Date.now();
  for (let start = 0; start < days; start += 30) {
    const to = new Date(now - start * 86_400_000);
    const from = new Date(now - Math.min(days, start + 30) * 86_400_000);
    chunks.push(fetchEspnRange(code, from, to));
  }
  const all = (await Promise.all(chunks)).flat();
  const seen = new Set<string>();
  return all
    .filter((e) => {
      if (seen.has(e.eventId)) return false;
      seen.add(e.eventId);
      return e.live.state === "finished" && e.live.homeGoals !== null && e.live.awayGoals !== null;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Live state for a set of fixtures, keyed by football-data fixture id. */
export async function fetchLiveScores(
  code: string,
  fixtures: { id: number; utcDate: string; home: { name: string }; away: { name: string } }[],
): Promise<Map<number, LiveScore>> {
  const out = new Map<number, LiveScore>();
  if (fixtures.length === 0) return out;

  const days = new Set<string>();
  const now = Date.now();
  for (const f of fixtures) {
    const t = new Date(f.utcDate).getTime();
    // Only fixtures near or in the past can carry a live/finished state.
    if (t < now + 6 * 3_600_000) days.add(new Date(f.utcDate).toISOString().slice(0, 10));
  }
  if (days.size === 0) return out;

  const boards = await Promise.all(
    [...days].slice(0, 3).map((d) => fetchEspnScoreboard(code, new Date(`${d}T12:00:00Z`))),
  );
  const events = boards.flat();
  if (events.length === 0) return out;

  for (const f of fixtures) {
    const kick = new Date(f.utcDate).getTime();
    const sameDay = events.filter((e) => Math.abs(new Date(e.date).getTime() - kick) < 8 * 3_600_000);
    const home = bestMatch(f.home.name, sameDay, (e) => [e.home]);
    const match = home && similarity(f.away.name, home.away) >= 0.4 ? home : null;
    if (match) out.set(f.id, match.live);
  }
  return out;
}

/* ------------------------------- team news ------------------------------- */

type EspnInjuryFeed = {
  injuries?: {
    displayName?: string;
    injuries?: {
      status?: string;
      details?: { type?: string } | null;
      type?: string;
      athlete?: { displayName?: string; position?: { name?: string; abbreviation?: string } };
    }[];
  }[];
};

function availabilityOf(status: string | undefined): Availability {
  const s = (status ?? "").toLowerCase();
  if (s.includes("suspend")) return "suspended";
  if (s.includes("out") || s.includes("injur")) return "out";
  if (s.includes("doubt")) return "doubtful";
  return "questionable";
}

type LeagueNews = { teams: { name: string; items: NewsItem[] }[] };

async function fetchLeagueNews(code: string): Promise<LeagueNews | null> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return null;
  const data = await get<EspnInjuryFeed>(`${SITE}/${slug}/injuries`, 1_800_000);
  if (!data?.injuries) return null;
  return {
    teams: data.injuries.map((t) => ({
      name: t.displayName ?? "",
      items: (t.injuries ?? []).flatMap((i) => {
        const player = i.athlete?.displayName;
        if (!player) return [];
        return [
          {
            player,
            position: i.athlete?.position?.name ?? i.athlete?.position?.abbreviation ?? "",
            availability: availabilityOf(i.status ?? i.type),
            detail: i.details?.type ?? i.type ?? null,
          },
        ];
      }),
    })),
  };
}

type EspnRoster = {
  athletes?: {
    displayName?: string;
    position?: { name?: string; abbreviation?: string };
    status?: { type?: string; name?: string };
    injuries?: { status?: string; details?: { type?: string } | null }[];
  }[];
};

type EspnTeamList = {
  sports?: { leagues?: { teams?: { team: { id: string; displayName: string; shortDisplayName?: string } }[] }[] }[];
};

/** Roster-level fallback: non-active players and flagged injuries. */
async function fetchRosterNews(code: string, teamName: string): Promise<NewsItem[]> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return [];
  const teams = await get<EspnTeamList>(`${SITE}/${slug}/teams`, 6 * 3_600_000);
  const list = teams?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const found = bestMatch(teamName, list, (t) => [t.team.displayName, t.team.shortDisplayName ?? ""]);
  if (!found) return [];
  const roster = await get<EspnRoster>(`${SITE}/${slug}/teams/${found.team.id}/roster`, 3_600_000);
  return (roster?.athletes ?? []).flatMap((a) => {
    const injury = a.injuries?.[0];
    const inactive = (a.status?.type ?? "").toLowerCase() !== "active" && a.status?.type !== undefined;
    if (!injury && !inactive) return [];
    return [
      {
        player: a.displayName ?? "",
        position: a.position?.name ?? a.position?.abbreviation ?? "",
        availability: availabilityOf(injury?.status ?? a.status?.name),
        detail: injury?.details?.type ?? a.status?.name ?? null,
      },
    ];
  });
}

/** Availability for both sides of a fixture. */
export async function fetchFixtureNews(
  code: string,
  homeName: string,
  awayName: string,
): Promise<{ home: TeamNews; away: TeamNews; available: boolean }> {
  const league = await fetchLeagueNews(code);
  const pick = (name: string): NewsItem[] => {
    if (!league) return [];
    const team = bestMatch(name, league.teams, (t) => [t.name]);
    return team?.items ?? [];
  };

  let homeItems = pick(homeName);
  let awayItems = pick(awayName);

  if (homeItems.length === 0 && awayItems.length === 0) {
    const [h, a] = await Promise.all([
      fetchRosterNews(code, homeName).catch(() => []),
      fetchRosterNews(code, awayName).catch(() => []),
    ]);
    homeItems = h;
    awayItems = a;
  }

  const home = homeItems.length ? buildTeamNews(homeItems) : EMPTY_NEWS;
  const away = awayItems.length ? buildTeamNews(awayItems) : EMPTY_NEWS;
  return { home, away, available: Boolean(league) || homeItems.length + awayItems.length > 0 };
}

/**
 * Team news for many teams in one shot, using only the league-wide injuries
 * feed (no per-team roster fallback) so it stays cheap enough to call for an
 * entire board of fixtures rather than one match at a time.
 */
export async function fetchLeagueNewsFor(code: string, teamNames: string[]): Promise<Map<string, TeamNews>> {
  const out = new Map<string, TeamNews>();
  if (teamNames.length === 0) return out;
  const league = await fetchLeagueNews(code);
  if (!league) return out;
  for (const name of teamNames) {
    const team = bestMatch(name, league.teams, (t) => [t.name]);
    if (team && team.items.length) out.set(name, buildTeamNews(team.items));
  }
  return out;
}

/* --------------------------- league-wide scoring -------------------------- */

export type EspnLeagueForm = { homeGoals: number; awayGoals: number; games: number };

/**
 * Recent completed results across the league, used to measure the real
 * home-field effect instead of assuming one.
 */
export async function fetchEspnHomeSplit(code: string, days = 60): Promise<EspnLeagueForm | null> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return null;
  const tally = (events: EspnMatch[]): EspnLeagueForm => {
    let homeGoals = 0;
    let awayGoals = 0;
    let games = 0;
    for (const e of events) {
      homeGoals += e.live.homeGoals ?? 0;
      awayGoals += e.live.awayGoals ?? 0;
      games += 1;
    }
    return { homeGoals, awayGoals, games };
  };

  let out = tally(await finishedResults(code, days));
  // Early in a season there aren't enough recent games: reach back into last
  // season rather than falling back to a neutral assumption.
  if (out.games < 20) out = tally(await finishedResults(code, 400));
  return out.games >= 6 ? out : null;
}

/**
 * Recent match history per team, built from ESPN's scoreboard. Shaped like
 * football-data's per-team history (`TeamMatch[]`) so it can feed the same
 * `buildTeamModel`/`blendModels` pipeline `fetchAnalysis` already uses — but
 * sourced independently, so pricing the whole board doesn't need one
 * football-data call per team (which would blow the free-tier rate limit).
 */
export async function fetchEspnRecentForm(
  code: string,
  teamNames: string[],
  days = 60,
): Promise<Map<string, TeamMatch[]>> {
  const out = new Map<string, TeamMatch[]>();
  const slug = ESPN_LEAGUES[code];
  if (!slug || teamNames.length === 0) return out;

  const build = (finished: EspnMatch[]) => {
    const map = new Map<string, TeamMatch[]>();
    for (const name of teamNames) {
      const matches: TeamMatch[] = [];
      for (const e of finished) {
        const isHome = similarity(name, e.home) >= 0.45;
        const isAway = !isHome && similarity(name, e.away) >= 0.45;
        if (!isHome && !isAway) continue;
        const goalsFor = (isHome ? e.live.homeGoals : e.live.awayGoals) ?? 0;
        const goalsAgainst = (isHome ? e.live.awayGoals : e.live.homeGoals) ?? 0;
        matches.push({
          goalsFor,
          goalsAgainst,
          isHome,
          opponent: isHome ? e.away : e.home,
          date: e.date,
          result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
        });
        if (matches.length >= 12) break;
      }
      if (matches.length) map.set(name, matches);
    }
    return map;
  };

  let map = build(await finishedResults(code, days));
  const wellCovered = [...map.values()].filter((m) => m.length >= 6).length;
  // Not enough current-season games (new season, winter break, cup weeks):
  // extend the window back through last season so every team has a real read.
  if (wellCovered < teamNames.length * 0.6) {
    map = build(await finishedResults(code, 400));
  }
  for (const [k, v] of map) out.set(k, v);
  return out;
}

/**
 * Finished-match result for a single fixture, matched by team name and
 * kickoff day. Used as a fallback result source when football-data can't be
 * reached (rate limited, key issue, or the fixture id isn't resolving yet)
 * so the grading job doesn't stall on it.
 */
export async function fetchEspnResult(
  code: string,
  homeName: string,
  awayName: string,
  kickoffIso: string,
): Promise<{ homeGoals: number; awayGoals: number } | null> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return null;
  const kickoff = new Date(kickoffIso);
  if (Number.isNaN(kickoff.getTime())) return null;

  // The event could land on the UTC day before/after kickoff depending on
  // kickoff time and ESPN's date bucketing, so check a small window.
  const days = [kickoff, new Date(kickoff.getTime() - 86_400_000), new Date(kickoff.getTime() + 86_400_000)];
  const boards = await Promise.all(days.map((d) => fetchEspnScoreboard(code, d, 6 * 3_600_000)));
  const events = boards.flat();

  const sameDay = events.filter((e) => Math.abs(new Date(e.date).getTime() - kickoff.getTime()) < 8 * 3_600_000);
  const home = bestMatch(homeName, sameDay, (e) => [e.home]);
  const match = home && similarity(awayName, home.away) >= 0.4 ? home : null;
  if (!match || match.live.state !== "finished" || match.live.homeGoals === null || match.live.awayGoals === null) {
    return null;
  }
  return { homeGoals: match.live.homeGoals, awayGoals: match.live.awayGoals };
}
