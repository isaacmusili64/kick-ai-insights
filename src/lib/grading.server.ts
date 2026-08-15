/**
 * Daily job: logs today's model picks to the public prediction log, then grades
 * any pending picks whose match has finished. Server only.
 */

import { FREE_COMPETITIONS, COMPETITIONS, fetchCompetitionFeed, fetchResults } from "./football.server";
import { fetchEspnResult } from "./espn.server";

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

function picksFromFixture(f: Awaited<ReturnType<typeof fetchCompetitionFeed>>["fixtures"][number]): LoggedPick[] {
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
  errors: string[];
};

export async function runDailyGrading(codes?: string[]): Promise<GradingReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const wanted = (codes?.length ? codes : [...FREE_COMPETITIONS, "BL1", "FL1"]).filter((c) =>
    COMPETITIONS.some((x) => x.code === c),
  );
  const errors: string[] = [];
  const rows: LoggedPick[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const code of wanted) {
    try {
      const feed = await fetchCompetitionFeed(code, 2);
      for (const f of feed.fixtures) {
        if (f.utcDate.slice(0, 10) !== today) continue;
        if (f.status !== "SCHEDULED" && f.status !== "TIMED") continue;
        rows.push(...picksFromFixture(f));
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
    const seen = new Set((existing ?? []).map((e) => `${e.fixture_id}:${e.market}`));
    const fresh = rows.filter((r) => !seen.has(`${r.fixture_id}:${r.market}`));
    if (fresh.length) {
      const { error } = await supabaseAdmin.from("prediction_log").insert(fresh);
      if (error) errors.push(`insert: ${error.message}`);
      else logged = fresh.length;
    }
  }

  // Grade pending picks whose kickoff is at least 2.5h in the past.
  const cutoff = new Date(Date.now() - 150 * 60_000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from("prediction_log")
    .select("id, fixture_id, market, pick, competition_code, home_team, away_team, kickoff")
    .eq("status", "pending")
    .lt("kickoff", cutoff)
    .limit(60);

  let graded = 0;
  const pendingRows = pending ?? [];
  if (pendingRows.length) {
    const ids = [...new Set(pendingRows.map((r) => r.fixture_id))];
    const results = await fetchResults(ids).catch((error) => {
      errors.push(`football-data results: ${(error as Error).message}`);
      return [];
    });
    const byId = new Map(results.map((r) => [r.id, r]));

    // ESPN fallback for fixtures football-data couldn't resolve (rate limit,
    // key issue, more than 20 pending, or not finished there yet), matched
    // by team name and kickoff day. Best effort: a miss just stays pending
    // and is retried on the next run.
    const unresolved = [...new Map(pendingRows.map((r) => [r.fixture_id, r])).values()].filter((r) => {
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

  return { logged, graded, competitions: wanted, errors };
}