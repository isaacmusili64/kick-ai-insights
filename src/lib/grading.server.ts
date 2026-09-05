/**
 * Daily job: logs today's model picks to the public prediction log, then grades
 * any pending picks whose match has finished. Server only.
 */

import { FREE_COMPETITIONS, COMPETITIONS, fetchCompetitionFeed, fetchResults } from "./football.server";
import { fetchEspnResult } from "./espn.server";
import { dayKeyOf, todayKey } from "./format";

type LoggedPick = {
  fixture_id: number;
  competition_code: string;
  kickoff: string;
  home_team: string;
  away_team: string;
  market: string;
  pick: string;
  probability: number;
  expected_home_goals: number;
  expected_away_goals: number;
};

/** Markets graded automatically, with the settlement rule for each. */
const MARKET_RULES: Record<string, (pick: string, home: number, away: number) => boolean | null> = {
  "1x2": (pick, h, a) =>
    pick === "HOME" ? h > a : pick === "AWAY" ? a > h : pick === "DRAW" ? h === a : null,
  ou25: (pick, h, a) => (pick === "OVER" ? h + a > 2.5 : pick === "UNDER" ? h + a < 2.5 : null),
  btts: (pick, h, a) => (pick === "YES" ? h > 0 && a > 0 : pick === "NO" ? h === 0 || a === 0 : null),
};

function picksFromFixture(f: {
  id: number;
  competitionCode: string;
  utcDate: string;
  status: string;
  home: { name: string };
  away: { name: string };
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
    expectedHomeGoals: number;
    expectedAwayGoals: number;
  } | null;
}): LoggedPick[] {
  const p = f.prediction;
  if (!p) return [];
  const base = {
    fixture_id: f.id,
    competition_code: f.competitionCode,
    kickoff: f.utcDate,
    home_team: f.home.name,
    away_team: f.away.name,
    expected_home_goals: Number(p.expectedHomeGoals.toFixed(3)),
    expected_away_goals: Number(p.expectedAwayGoals.toFixed(3)),
  };
  const result =
    p.homeWin >= p.draw && p.homeWin >= p.awayWin
      ? { pick: "HOME", probability: p.homeWin }
      : p.awayWin >= p.draw
        ? { pick: "AWAY", probability: p.awayWin }
        : { pick: "DRAW", probability: p.draw };
  return [
    { ...base, market: "1x2", ...result },
    {
      ...base,
      market: "ou25",
      pick: p.over25 >= 0.5 ? "OVER" : "UNDER",
      probability: Math.max(p.over25, p.under25),
    },
    {
      ...base,
      market: "btts",
      pick: p.bttsYes >= 0.5 ? "YES" : "NO",
      probability: Math.max(p.bttsYes, p.bttsNo),
    },
  ].map((row) => ({ ...row, probability: Number(row.probability.toFixed(4)) }));
}

export type GradingReport = {
  logged: number;
  graded: number;
  competitions: string[];
  /** Nairobi calendar day used for logging */
  logDay: string;
  candidates: number;
  skippedNoModel: number;
  errors: string[];
};

export async function runDailyGrading(codes?: string[]): Promise<GradingReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const wanted = (codes?.length ? codes : [...FREE_COMPETITIONS, "BL1", "FL1"]).filter((c) =>
    COMPETITIONS.some((x) => x.code === c),
  );
  const errors: string[] = [];
  const rows: LoggedPick[] = [];
  // Align with the board: "today" is Africa/Nairobi, not UTC.
  const logDay = todayKey();
  let candidates = 0;
  let skippedNoModel = 0;

  for (const code of wanted) {
    try {
      const feed = await fetchCompetitionFeed(code);
      for (const f of feed.fixtures) {
        // Kickoff calendar day in Nairobi must be today.
        if (dayKeyOf(f.utcDate) !== logDay) continue;
        // Log anything not yet finished (scheduled, timed, or about to kick off).
        if (f.status === "FINISHED" || f.status === "POSTPONED" || f.status === "CANCELLED") continue;
        candidates += 1;
        const picks = picksFromFixture(f);
        if (!picks.length) {
          skippedNoModel += 1;
          continue;
        }
        rows.push(...picks);
      }
    } catch (error) {
      errors.push(`${code}: ${(error as Error).message}`);
    }
  }

  let logged = 0;
  if (rows.length) {
    // Skip fixtures already logged so re-running the job is safe.
    const ids = [...new Set(rows.map((r) => r.fixture_id))];
    const { data: existing } = await supabaseAdmin
      .from("prediction_log")
      .select("fixture_id, market")
      .in("fixture_id", ids);

    const seen = new Set((existing ?? []).map((r: { fixture_id: number; market: string }) => `${r.fixture_id}:${r.market}`));
    const fresh = rows.filter((r) => !seen.has(`${r.fixture_id}:${r.market}`));

    if (fresh.length) {
      const { error } = await supabaseAdmin.from("prediction_log").insert(
        fresh.map((r) => ({
          ...r,
          status: "pending",
        })),

      );
      if (error) errors.push(`insert: ${error.message}`);
      else logged = fresh.length;
    }
  }

  // Grade pending picks whose kickoff was more than ~2.5h ago.
  const cutoff = new Date(Date.now() - 2.5 * 3_600_000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from("prediction_log")
    .select("id, fixture_id, market, pick, competition_code, home_team, away_team, kickoff")
    .eq("status", "pending")
    .lt("kickoff", cutoff)
    .limit(60);

  let graded = 0;
  const pendingRows = pending ?? [];
  if (pendingRows.length) {
    const ids = [...new Set(pendingRows.map((r: { fixture_id: number }) => r.fixture_id))];
    const results = await fetchResults(ids).catch((error) => {
      errors.push(`football-data results: ${(error as Error).message}`);
      return [];
    });
    const byId = new Map(results.map((r) => [r.id, r]));

    type PendingRow = {
      fixture_id: number;
      competition_code: string;
      home_team: string;
      away_team: string;
      kickoff: string;
    };
    const unresolved = [
      ...new Map((pendingRows as PendingRow[]).map((r) => [r.fixture_id, r])).values(),
    ].filter((r) => {
        const found = byId.get(r.fixture_id);
      return !found || found.status !== "FINISHED" || found.homeGoals < 0;
    });
    if (unresolved.length) {
      const espnResults = await Promise.all(
        unresolved.map(async (r) => {
          const result = await fetchEspnResult(r.competition_code, r.home_team, r.away_team, r.kickoff).catch(
            () => null,
          );
          return result ? ([r.fixture_id, result] as const) : null;
        }),
      );
      for (const entry of espnResults) {
        if (!entry) continue;
        const [fixtureId, result] = entry;
        byId.set(fixtureId, { id: fixtureId, status: "FINISHED", ...result });
      }
    }

    for (const row of pendingRows) {
      const result = byId.get(row.fixture_id);
      if (!result || result.status !== "FINISHED" || result.homeGoals < 0) continue;
      const rule = MARKET_RULES[row.market];
      const correct = rule ? rule(row.pick, result.homeGoals, result.awayGoals) : null;
      if (correct === null) continue;
      const { error } = await supabaseAdmin
        .from("prediction_log")
        .update({
          status: "graded",
          actual_home: result.homeGoals,
          actual_away: result.awayGoals,
          correct,
          graded_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) errors.push(`grade ${row.id}: ${error.message}`);
      else graded += 1;
    }
  }

  return { logged, graded, competitions: wanted, logDay, candidates, skippedNoModel, errors };
}
