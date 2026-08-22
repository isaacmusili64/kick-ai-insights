import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FeedInput = z.object({
  codes: z.array(z.string().min(2).max(5)).min(1).max(20),
  days: z.number().int().min(1).max(7).optional(),
});
const MatchInput = z.object({ matchId: z.number().int().positive() });
const CompetitionInput = z.object({ code: z.string().min(2).max(5) });

export const getCompetitions = createServerFn({ method: "GET" }).handler(async () => {
  const { COMPETITIONS, FREE_COMPETITIONS } = await import("./football.server");
  const free = new Set<string>(FREE_COMPETITIONS);
  return COMPETITIONS.map((c) => ({ ...c, free: free.has(c.code) }));
});

export const getFeed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => FeedInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchFeed } = await import("./football.server");
    try {
      const feed = await fetchFeed(data.codes, data.days ?? 3);
      return { ...feed, error: null as string | null };
    } catch (error) {
      return { fixtures: [], competitions: [], error: (error as Error).message };
    }
  });

export const getStandings = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => CompetitionInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchLeagueStrength } = await import("./football.server");
    try {
      const strength = await fetchLeagueStrength(data.code);
      return { ...strength, error: null as string | null };
    } catch (error) {
      return { rows: [], leagueAvgGoals: 0, error: (error as Error).message };
    }
  });

/**
 * One competition at a time, so the board can load many leagues in parallel
 * queries instead of one long request that trips the data provider's limit.
 */
export const getCompetitionFeed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => CompetitionInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchCompetitionFeed } = await import("./football.server");
    try {
      const result = await fetchCompetitionFeed(data.code, 3);
      return { code: data.code, fixtures: result.fixtures, modelled: result.modelled, error: null as string | null };
    } catch (error) {
      return { code: data.code, fixtures: [], modelled: false, error: (error as Error).message };
    }
  });

export const getAnalysis = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => MatchInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchAnalysis } = await import("./football.server");
    try {
      return { ...(await fetchAnalysis(data.matchId)), error: null as string | null };
    } catch (error) {
      return {
        fixture: null,
        prediction: null,
        table: null,
        h2h: [],
        history: { home: [], away: [] },
        error: (error as Error).message,
      };
    }
  });

export const getPrediction = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => MatchInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchMatch, fetchTeamHistory, fetchHeadToHead } = await import("./football.server");
    const { buildTeamModel, predict } = await import("./model");

    try {
      const fixture = await fetchMatch(data.matchId);
      const [homeHistory, awayHistory, h2h] = await Promise.all([
        fetchTeamHistory(fixture.home.id),
        fetchTeamHistory(fixture.away.id),
        fetchHeadToHead(data.matchId).catch(() => []),
      ]);

      const games = homeHistory.leagueGoalGames + awayHistory.leagueGoalGames;
      const leagueAvgGoals = games
        ? (homeHistory.leagueGoalSum + awayHistory.leagueGoalSum) / games / 2
        : 1.35;

      const homeModel = buildTeamModel(homeHistory.matches, leagueAvgGoals);
      const awayModel = buildTeamModel(awayHistory.matches, leagueAvgGoals);
      const prediction = predict(homeModel, awayModel, leagueAvgGoals);

      return {
        error: null as string | null,
        fixture,
        prediction,
        leagueAvgGoals,
        h2h,
        teams: {
          home: {
            form: homeModel.form,
            formPoints: homeModel.formPoints,
            avgScored: homeModel.avgScored,
            avgConceded: homeModel.avgConceded,
            attack: homeModel.attack,
            defence: homeModel.defence,
            recent: homeHistory.matches.slice(0, 5),
          },
          away: {
            form: awayModel.form,
            formPoints: awayModel.formPoints,
            avgScored: awayModel.avgScored,
            avgConceded: awayModel.avgConceded,
            attack: awayModel.attack,
            defence: awayModel.defence,
            recent: awayHistory.matches.slice(0, 5),
          },
        },
      };
    } catch (error) {
      return {
        error: (error as Error).message,
        fixture: null,
        prediction: null,
        teams: null,
        h2h: [],
        leagueAvgGoals: 0,
      };
    }
  });

const InsightInput = z.object({
  matchId: z.number().int().positive(),
  payload: z.string().min(10).max(6000),
});

export const getAiInsight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { insight: null, error: "AI is not configured." };

    const system =
      "You are a football analyst. You receive the output of a Poisson/Dixon-Coles statistical model plus recent form data. Write a sharp, specific analysis in 3 short paragraphs: (1) what the model sees and why, (2) the key form/tactical angle including the strongest market, (3) one clear risk that could break the prediction. Reference the actual numbers. No headings, no bullet points, under 190 words.";

    // Llama 3.3 70B was decommissioned on Groq (Aug 2026). Prefer GPT-OSS 120B, then Qwen.
    const models = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b"] as const;

    const bodyFor = (model: string) =>
      JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.payload },
        ],
        temperature: 0.4,
        max_tokens: 400,
        stream: false,
      });

    let lastError = "AI insight failed to generate.";

    for (const model of models) {
      let res: Response;
      try {
        res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: bodyFor(model),
        });
      } catch {
        lastError = "Could not reach the AI service.";
        continue;
      }

      if (res.status === 429) {
        lastError = "AI is busy right now — try again shortly.";
        continue;
      }
      if (res.status === 401) {
        return { insight: null, error: "AI is misconfigured — check the API key." };
      }
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        lastError = errBody?.error?.message ?? `AI insight failed (${res.status}).`;
        // Model decommissioned / not found → try next
        if (res.status === 400 || res.status === 404) continue;
        continue;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      const insight = text.trim() || null;
      if (insight) return { insight, error: null };
      lastError = "AI returned an empty response.";
    }

    return { insight: null, error: lastError };
  });