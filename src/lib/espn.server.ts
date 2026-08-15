/**
 * ESPN's public (unofficial) soccer endpoints. Used to enrich the model with
 * live scores, match state and team availability. Server only, best effort:
 * every helper resolves to null/empty rather than throwing so the core
 * football-data pipeline keeps working when ESPN is unavailable.
 */

import type { LiveScore, MatchState } from "./live";
import { buildTeamNews, EMPTY_NEWS, type Availability, type NewsItem, type TeamNews } from "./teamnews";

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
  return score >= 0.5 ? best : null;
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
  return `${date.getUTCFullYear()}${`${date.getUTCMonth() + 1}`.padStart(2, "0")}${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

/** All ESPN events for a league on the given UTC day (defaults to today). */
export async function fetchEspnScoreboard(code: string, date = new Date()): Promise<EspnMatch[]> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return [];
  const data = await get<{ events?: EspnEvent[] }>(`${SITE}/${slug}/scoreboard?dates=${ymd(date)}`, 25_000);
  const events = data?.events ?? [];
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

/** Roster-level fallback: non-active players and flagged injuries. */
async function fetchRosterNews(code: string, teamName: string): Promise<NewsItem[]> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return [];
  const teams = await get<{ sports?: { leagues?: { teams?: { team: { id: string; displayName: string; shortDisplayName?: string } }[] }[] }[]>(
    `${SITE}/${slug}/teams`,
    6 * 3_600_000,
  );
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

/* --------------------------- league-wide scoring -------------------------- */

export type EspnLeagueForm = { homeGoals: number; awayGoals: number; games: number };

/**
 * Recent completed results across the league, used to measure the real
 * home-field effect instead of assuming one.
 */
export async function fetchEspnHomeSplit(code: string, days = 28): Promise<EspnLeagueForm | null> {
  const slug = ESPN_LEAGUES[code];
  if (!slug) return null;
  const dates: Date[] = [];
  for (let i = 1; i <= days; i += 3) dates.push(new Date(Date.now() - i * 86_400_000));
  const boards = await Promise.all(dates.map((d) => fetchEspnScoreboard(code, d)));
  let homeGoals = 0;
  let awayGoals = 0;
  let games = 0;
  for (const e of boards.flat()) {
    if (e.live.state !== "finished" || e.live.homeGoals === null || e.live.awayGoals === null) continue;
    homeGoals += e.live.homeGoals;
    awayGoals += e.live.awayGoals;
    games += 1;
  }
  return games >= 6 ? { homeGoals, awayGoals, games } : null;
}