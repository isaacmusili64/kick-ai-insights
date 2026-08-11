import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FixturesInput = z.object({ code: z.string().min(2).max(5) });
const MatchInput = z.object({ matchId: z.number().int().positive() });

export const getCompetitions = createServerFn({ method: "GET" }).handler(async () => {
  const { COMPETITIONS } = await import("./football.server");
  return COMPETITIONS.map((c) => ({ ...c }));
});

export const getFixtures = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => FixturesInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchUpcoming } = await import("./football.server");
    try {
      return { fixtures: await fetchUpcoming(data.code), error: null as string | null };
    } catch (error) {
      return { fixtures: [], error: (error as Error).message };
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
      return { error: (error as Error).message } as const;
    }
  });

const InsightInput = z.object({
  matchId: z.number().int().positive(),
  payload: z.string().min(10).max(6000),
});

export const getAiInsight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { insight: null, error: "AI is not configured." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        messages: [
          {
            role: "system",
            content:
              "You are a football analyst. You receive the output of a Poisson/Dixon-Coles statistical model plus recent form data. Write a sharp, specific analysis in 3 short paragraphs: (1) what the model sees and why, (2) the key tactical/form angle including the strongest value market, (3) one clear risk that could break the prediction. Reference the actual numbers. No betting advice disclaimers, no headings, no bullet points, under 190 words.",
          },
          { role: "user", content: data.payload },
        ],
      }),
    });

    if (res.status === 429) return { insight: null, error: "AI is busy right now — try again shortly." };
    if (res.status === 402) return { insight: null, error: "AI credits exhausted for this workspace." };
    if (!res.ok) return { insight: null, error: "AI insight failed to generate." };

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const insight = json.choices?.[0]?.message?.content?.trim() ?? null;
    return { insight, error: insight ? null : "AI returned an empty response." };
  });