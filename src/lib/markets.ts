import type { ExtendedPrediction } from "./model";

export type MarketId =
  | "all"
  | "1x2"
  | "dc"
  | "ou15"
  | "ou25"
  | "ou35"
  | "btts"
  | "cs"
  | "dnb"
  | "ah"
  | "tg";

export const MARKETS: { id: MarketId; label: string; short: string; pro: boolean }[] = [
  { id: "all", label: "All markets", short: "All markets", pro: false },
  { id: "1x2", label: "Match result (1X2)", short: "1X2", pro: false },
  { id: "dc", label: "Double chance", short: "Double chance", pro: false },
  { id: "ou15", label: "Over / Under 1.5", short: "O/U 1.5", pro: true },
  { id: "ou25", label: "Over / Under 2.5", short: "O/U 2.5", pro: false },
  { id: "ou35", label: "Over / Under 3.5", short: "O/U 3.5", pro: true },
  { id: "btts", label: "Both teams to score", short: "BTTS", pro: false },
  { id: "cs", label: "Correct score", short: "Correct score", pro: true },
  { id: "dnb", label: "Draw no bet", short: "Draw no bet", pro: true },
  { id: "ah", label: "Asian handicap", short: "Handicap", pro: true },
  { id: "tg", label: "Team goals", short: "Team goals", pro: true },
];

export type Pick = {
  market: MarketId;
  marketLabel: string;
  label: string;
  probability: number;
  explain: string;
};

export type ConfidenceTier = "Low" | "Medium" | "High";

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 70) return "High";
  if (confidence >= 55) return "Medium";
  return "Low";
}

const g = (n: number) => n.toFixed(2);

export function picksFor(
  market: MarketId,
  p: ExtendedPrediction,
  home: string,
  away: string,
): Pick[] {
  const label = MARKETS.find((m) => m.id === market)?.label ?? market;
  const mk = (l: string, probability: number, explain: string): Pick => ({
    market,
    marketLabel: label,
    label: l,
    probability,
    explain,
  });
  const xg = `Expected goals ${g(p.expectedHomeGoals)} – ${g(p.expectedAwayGoals)}.`;

  switch (market) {
    case "all":
      return MARKETS.filter((m) => m.id !== "all").flatMap((m) => picksFor(m.id, p, home, away));
    case "1x2":
      return [
        mk(`${home} win`, p.homeWin, `Home attack vs away defence, plus home advantage. ${xg}`),
        mk("Draw", p.draw, `Score matrix mass on the diagonal. ${xg}`),
        mk(`${away} win`, p.awayWin, `Away attack vs home defence. ${xg}`),
      ];
    case "dc":
      return [
        mk(`${home} or draw`, p.doubleChanceHome, "Home win plus draw probability."),
        mk(`${away} or draw`, p.doubleChanceAway, "Away win plus draw probability."),
        mk("Home or away", p.doubleChanceHomeAway, "Any outcome except the draw."),
      ];
    case "ou15":
      return [
        mk("Over 1.5 goals", p.over15, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
        mk("Under 1.5 goals", p.under15, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
      ];
    case "ou25":
      return [
        mk("Over 2.5 goals", p.over25, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
        mk("Under 2.5 goals", p.under25, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
      ];
    case "ou35":
      return [
        mk("Over 3.5 goals", p.over35, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
        mk("Under 3.5 goals", p.under35, `Total goals expectation ${g(p.expectedHomeGoals + p.expectedAwayGoals)}.`),
      ];
    case "btts":
      return [
        mk("Both teams score", p.bttsYes, "Both scoring rates above zero across the score matrix."),
        mk("Both teams score – No", p.bttsNo, `Clean sheet chances: ${home} ${Math.round(p.cleanSheetHome * 100)}%, ${away} ${Math.round(p.cleanSheetAway * 100)}%.`),
      ];
    case "cs":
      return p.topScores.map((s) =>
        mk(`Correct score ${s.score}`, s.probability, "Highest-mass cell in the Dixon-Coles score matrix."),
      );
    case "dnb":
      return [
        mk(`${home} (draw no bet)`, p.dnbHome, "Home win share of the non-draw outcomes."),
        mk(`${away} (draw no bet)`, p.dnbAway, "Away win share of the non-draw outcomes."),
      ];
    case "ah":
      return [
        mk(`${home} -1`, p.ahHomeMinus1, "Home winning by two or more goals."),
        mk(`${away} +1`, p.ahAwayPlus1, "Away side avoids a two-goal defeat."),
        mk(`${away} -1`, p.ahAwayMinus1, "Away winning by two or more goals."),
        mk(`${home} +1`, p.ahHomePlus1, "Home side avoids a two-goal defeat."),
      ];
    case "tg":
      return [
        mk(`${home} over 0.5`, p.homeOver05, `${home} expected goals ${g(p.expectedHomeGoals)}.`),
        mk(`${home} over 1.5`, p.homeOver15, `${home} expected goals ${g(p.expectedHomeGoals)}.`),
        mk(`${away} over 0.5`, p.awayOver05, `${away} expected goals ${g(p.expectedAwayGoals)}.`),
        mk(`${away} over 1.5`, p.awayOver15, `${away} expected goals ${g(p.expectedAwayGoals)}.`),
      ];
    default:
      return [];
  }
}

export function bestPick(
  market: MarketId,
  p: ExtendedPrediction,
  home: string,
  away: string,
): Pick | null {
  const picks = picksFor(market, p, home, away).sort((a, b) => b.probability - a.probability);
  return picks[0] ?? null;
}

/** The 2-3 most interesting selections to surface on a fixture card. */
export function headlinePicks(p: ExtendedPrediction, home: string, away: string): Pick[] {
  const result = bestPick("1x2", p, home, away);
  const goals = bestPick("ou25", p, home, away);
  const btts = bestPick("btts", p, home, away);
  return [result, goals, btts].filter((x): x is Pick => Boolean(x));
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;