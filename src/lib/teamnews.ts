/** Team availability (injuries / suspensions / lineup doubt) — shared client-safe types. */

export type Availability = "out" | "doubtful" | "questionable" | "suspended";

export type NewsItem = {
  player: string;
  position: string;
  availability: Availability;
  detail: string | null;
};

export type TeamNews = {
  items: NewsItem[];
  /** Multiplier applied to the team's attack strength (<= 1). */
  attackMul: number;
  /** Multiplier applied to the team's defence weakness (>= 1 means leakier). */
  defenceMul: number;
  /** 0..1 severity of the disruption. */
  severity: number;
  /** Rough share of the first-choice XI unavailable. */
  outCount: number;
};

export const EMPTY_NEWS: TeamNews = {
  items: [],
  attackMul: 1,
  defenceMul: 1,
  severity: 0,
  outCount: 0,
};

const SEVERITY: Record<Availability, number> = {
  out: 1,
  suspended: 1,
  doubtful: 0.55,
  questionable: 0.35,
};

function positionWeights(position: string): { attack: number; defence: number } {
  const p = position.toLowerCase();
  if (p.includes("goal") || p === "g" || p === "gk") return { attack: 0.05, defence: 1 };
  if (p.includes("def") || p.startsWith("d") || p.includes("back")) return { attack: 0.15, defence: 0.8 };
  if (p.includes("mid") || p.startsWith("m")) return { attack: 0.5, defence: 0.45 };
  if (p.includes("forward") || p.includes("strik") || p.includes("wing") || p.startsWith("f"))
    return { attack: 1, defence: 0.1 };
  return { attack: 0.45, defence: 0.4 };
}

/**
 * Turns an availability list into attack/defence multipliers. Each absence is
 * weighted by position and by how certain the absence is, with diminishing
 * returns so a long injury list can't collapse a team's rating entirely.
 */
export function buildTeamNews(items: NewsItem[]): TeamNews {
  if (items.length === 0) return EMPTY_NEWS;

  let attackLoad = 0;
  let defenceLoad = 0;
  for (const item of items) {
    const w = positionWeights(item.position);
    const s = SEVERITY[item.availability] ?? 0.4;
    attackLoad += w.attack * s;
    defenceLoad += w.defence * s;
  }

  // Saturating response: ~6% attack loss per weighted absence, capped at 18%.
  const attackMul = 1 - 0.18 * (1 - Math.exp(-attackLoad / 3));
  const defenceMul = 1 + 0.16 * (1 - Math.exp(-defenceLoad / 3));
  const outCount = items.filter((i) => i.availability === "out" || i.availability === "suspended").length;

  return {
    items,
    attackMul,
    defenceMul,
    severity: Math.min(1, (attackLoad + defenceLoad) / 6),
    outCount,
  };
}

function nameList(items: NewsItem[], limit = 3): string {
  const names = items.slice(0, limit).map((i) => i.player);
  const extra = items.length - names.length;
  const joined = names.join(", ");
  return extra > 0 ? `${joined} +${extra} more` : joined;
}

function sideSentence(team: string, news: TeamNews): string | null {
  if (news.items.length === 0) return null;
  const missing = news.items.filter((i) => i.availability === "out" || i.availability === "suspended");
  const doubts = news.items.filter((i) => i.availability === "doubtful" || i.availability === "questionable");
  const parts: string[] = [];
  if (missing.length) parts.push(`without ${nameList(missing)}`);
  if (doubts.length) parts.push(`${nameList(doubts, 2)} rated doubtful`);
  const drop = Math.round((1 - news.attackMul) * 100);
  const leak = Math.round((news.defenceMul - 1) * 100);
  const effect =
    drop >= 1 || leak >= 1
      ? ` — the model trims their attack ${drop}% and adds ${leak}% to goals conceded.`
      : ".";
  return `${team} are ${parts.join(" and ")}${effect}`;
}

/** One-paragraph, human "team news impact" explanation for a fixture. */
export function teamNewsExplanation(
  homeName: string,
  awayName: string,
  home: TeamNews,
  away: TeamNews,
): string {
  const lines = [sideSentence(homeName, home), sideSentence(awayName, away)].filter(Boolean) as string[];
  if (lines.length === 0) {
    return "No availability concerns reported for either side, so the model prices this fixture on full-strength squads.";
  }
  const swing = home.severity - away.severity;
  const verdict =
    Math.abs(swing) < 0.08
      ? "Both squads are disrupted to a similar degree, so team news barely moves the price."
      : swing > 0
        ? `${awayName} come out of the team news better off, which nudges the model their way.`
        : `${homeName} come out of the team news better off, which nudges the model their way.`;
  return `${lines.join(" ")} ${verdict}`;
}

export type FixtureNews = {
  home: TeamNews;
  away: TeamNews;
  explanation: string;
  /** True when the provider returned a real availability feed for this league. */
  available: boolean;
};