/** football-data.org API access + response shaping. Server only. */

const BASE = "https://api.football-data.org/v4";

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function api<T>(path: string, ttlMs = 60_000): Promise<T> {
  const token = process.env["FOOTBALL_DATA_API_KEY"];
  if (!token) throw new Error("MISSING_KEY");

  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const res = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": token } });
  if (res.status === 429) throw new Error("RATE_LIMITED");
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
  { code: "EC", name: "European Championship", country: "Europe" },
  { code: "WC", name: "World Cup", country: "International" },
] as const;

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

export type Fixture = {
  id: number;
  utcDate: string;
  status: string;
  competition: string;
  competitionCode: string;
  home: { id: number; name: string; crest: string | null };
  away: { id: number; name: string; crest: string | null };
};

function toFixture(m: ApiMatch): Fixture {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    competition: m.competition?.name ?? "",
    competitionCode: m.competition?.code ?? "",
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
  const data = await api<{ matches: ApiMatch[] }>(
    `/teams/${teamId}/matches?status=FINISHED&limit=14`,
    600_000,
  );
  const ordered = [...data.matches].sort((a, b) => b.utcDate.localeCompare(a.utcDate));

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