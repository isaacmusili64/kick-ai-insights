/** Model performance: grades the model against matches that have already been played. */

import { fetchLeagueStrength, gradedMatches } from "./football.server";
import { predict } from "./model";
import { teamModelFromStanding } from "./strength";

export type MarketScore = {
  market: string;
  label: string;
  picks: number;
  correct: number;
  hitRate: number;
  expected: number;
  brier: number;
};

export type ConfidenceScore = {
  band: string;
  picks: number;
  hitRate: number;
  expected: number;
};

export type PerformanceReport = {
  matches: number;
  markets: MarketScore[];
  confidence: ConfidenceScore[];
  recent: {
    date: string;
    fixture: string;
    pick: string;
    probability: number;
    score: string;
    correct: boolean;
  }[];
  goalsError: number;
  error: string | null;
};

const BANDS: { band: string; min: number; max: number }[] = [
  { band: "40–50%", min: 0.4, max: 0.5 },
  { band: "50–60%", min: 0.5, max: 0.6 },
  { band: "60–70%", min: 0.6, max: 0.7 },
  { band: "70%+", min: 0.7, max: 1.01 },
];

type Graded = { market: string; label: string; probability: number; won: boolean };

export async function buildPerformance(codes: string[], days: number): Promise<PerformanceReport> {
  const empty: PerformanceReport = {
    matches: 0,
    markets: [],
    confidence: [],
    recent: [],
    goalsError: 0,
    error: null,
  };

  const rows: {
    date: string;
    fixture: string;
    graded: Graded[];
    score: string;
    goalsError: number;
  }[] = [];
  let lastError: string | null = null;

  for (const code of codes.slice(0, 4)) {
    let strength: Awaited<ReturnType<typeof fetchLeagueStrength>> | null = null;
    try {
      strength = await fetchLeagueStrength(code);
    } catch (error) {
      lastError = (error as Error).message;
      continue;
    }
    const byId = new Map(strength.rows.map((r) => [r.team.id, r]));

    let played: Awaited<ReturnType<typeof gradedMatches>> = [];
    try {
      played = await gradedMatches(code, days);
    } catch (error) {
      lastError = (error as Error).message;
      continue;
    }

    for (const m of played) {
      const home = byId.get(m.homeId);
      const away = byId.get(m.awayId);
      if (!home || !away) continue;
      const p = predict(
        teamModelFromStanding(home, strength.leagueAvgGoals),
        teamModelFromStanding(away, strength.leagueAvgGoals),
        strength.leagueAvgGoals,
      );

      const total = m.homeGoals + m.awayGoals;
      const resultPicks: Graded[] = [];

      const outcomes: { label: string; prob: number; won: boolean }[] = [
        { label: `${m.homeName} win`, prob: p.homeWin, won: m.homeGoals > m.awayGoals },
        { label: "Draw", prob: p.draw, won: m.homeGoals === m.awayGoals },
        { label: `${m.awayName} win`, prob: p.awayWin, won: m.awayGoals > m.homeGoals },
      ].sort((a, b) => b.prob - a.prob);
      const top = outcomes[0]!;
      resultPicks.push({ market: "1x2", label: top.label, probability: top.prob, won: top.won });

      const overPick = p.over25 >= p.under25;
      resultPicks.push({
        market: "ou25",
        label: overPick ? "Over 2.5 goals" : "Under 2.5 goals",
        probability: overPick ? p.over25 : p.under25,
        won: overPick ? total > 2.5 : total < 2.5,
      });

      const bttsPick = p.bttsYes >= p.bttsNo;
      const bothScored = m.homeGoals > 0 && m.awayGoals > 0;
      resultPicks.push({
        market: "btts",
        label: bttsPick ? "Both teams score" : "Both teams score – No",
        probability: bttsPick ? p.bttsYes : p.bttsNo,
        won: bttsPick ? bothScored : !bothScored,
      });

      const dcHome = p.doubleChanceHome >= p.doubleChanceAway;
      resultPicks.push({
        market: "dc",
        label: dcHome ? `${m.homeName} or draw` : `${m.awayName} or draw`,
        probability: dcHome ? p.doubleChanceHome : p.doubleChanceAway,
        won: dcHome ? m.homeGoals >= m.awayGoals : m.awayGoals >= m.homeGoals,
      });

      rows.push({
        date: m.date,
        fixture: `${m.homeName} v ${m.awayName}`,
        graded: resultPicks,
        score: `${m.homeGoals}-${m.awayGoals}`,
        goalsError:
          Math.abs(p.expectedHomeGoals - m.homeGoals) + Math.abs(p.expectedAwayGoals - m.awayGoals),
      });
    }
  }

  if (!rows.length) return { ...empty, error: lastError };

  const labels: Record<string, string> = {
    "1x2": "Match result",
    ou25: "Over / Under 2.5",
    btts: "Both teams to score",
    dc: "Double chance",
  };

  const markets: MarketScore[] = Object.keys(labels).map((market) => {
    const picks = rows.flatMap((r) => r.graded.filter((g) => g.market === market));
    const correct = picks.filter((g) => g.won).length;
    const expected = picks.reduce((s, g) => s + g.probability, 0);
    const brier = picks.reduce((s, g) => s + (g.probability - (g.won ? 1 : 0)) ** 2, 0);
    return {
      market,
      label: labels[market]!,
      picks: picks.length,
      correct,
      hitRate: picks.length ? correct / picks.length : 0,
      expected: picks.length ? expected / picks.length : 0,
      brier: picks.length ? brier / picks.length : 0,
    };
  });

  const all = rows.flatMap((r) => r.graded);
  const confidence: ConfidenceScore[] = BANDS.map(({ band, min, max }) => {
    const picks = all.filter((g) => g.probability >= min && g.probability < max);
    return {
      band,
      picks: picks.length,
      hitRate: picks.length ? picks.filter((g) => g.won).length / picks.length : 0,
      expected: picks.length ? picks.reduce((s, g) => s + g.probability, 0) / picks.length : 0,
    };
  }).filter((b) => b.picks > 0);

  const recent = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map((r) => {
      const pick = r.graded[0]!;
      return {
        date: r.date,
        fixture: r.fixture,
        pick: pick.label,
        probability: pick.probability,
        score: r.score,
        correct: pick.won,
      };
    });

  return {
    matches: rows.length,
    markets,
    confidence,
    recent,
    goalsError: rows.reduce((s, r) => s + r.goalsError, 0) / rows.length,
    error: lastError,
  };
}