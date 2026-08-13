export const COMPETITION_LIST = [
  { code: "PL", name: "Premier League", country: "England", free: true },
  { code: "ELC", name: "Championship", country: "England", free: true },
  { code: "PD", name: "La Liga", country: "Spain", free: true },
  { code: "SA", name: "Serie A", country: "Italy", free: true },
  { code: "BL1", name: "Bundesliga", country: "Germany", free: false },
  { code: "FL1", name: "Ligue 1", country: "France", free: false },
  { code: "DED", name: "Eredivisie", country: "Netherlands", free: false },
  { code: "PPL", name: "Primeira Liga", country: "Portugal", free: false },
  { code: "BSA", name: "Série A", country: "Brazil", free: false },
  { code: "CL", name: "Champions League", country: "Europe", free: false },
  { code: "EL", name: "Europa League", country: "Europe", free: false },
  { code: "EC", name: "European Championship", country: "Europe", free: false },
  { code: "WC", name: "World Cup", country: "International", free: false },
] as const;

export const FREE_CODES = COMPETITION_LIST.filter((c) => c.free).map((c) => c.code);

export const MAX_FEED_CODES = 5;

export function competitionName(code: string): string {
  return COMPETITION_LIST.find((c) => c.code === code)?.name ?? code;
}

/**
 * "All leagues" selection: every competition the viewer can access, capped at
 * MAX_FEED_CODES (the feed only ever prices up to 5 competitions per request,
 * in line with the football-data.org free-tier rate limit).
 */
export function allFeedCodes(isPro: boolean): string[] {
  return COMPETITION_LIST.filter((c) => c.free || isPro)
    .slice(0, MAX_FEED_CODES)
    .map((c) => c.code);
}

/**
 * @deprecated kept only so a stray `ALL_CODES` import doesn't break the
 * build — this is every competition code, uncapped and not pro-filtered.
 * Use `allFeedCodes(isPro)` instead, which is what FixtureFeed.tsx uses.
 */
export const ALL_CODES = COMPETITION_LIST.map((c) => c.code);