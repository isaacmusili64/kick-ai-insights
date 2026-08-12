/**
 * Poisson / Dixon-Coles style match prediction model.
 * Team attack & defence strengths are learned from recent match results
 * (recency weighted), then a full score matrix is generated.
 */

export type TeamMatch = {
  goalsFor: number;
  goalsAgainst: number;
  isHome: boolean;
  opponent: string;
  date: string;
  result: "W" | "D" | "L";
};

export type TeamModel = {
  attack: number;
  defence: number;
  homeAttack: number;
  awayAttack: number;
  form: ("W" | "D" | "L")[];
  formPoints: number;
  avgScored: number;
  avgConceded: number;
  sample: number;
};

const MAX_GOALS = 8;

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

function poisson(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/** Exponential recency weighting: newest match counts most. */
function weights(n: number, halfLife = 6): number[] {
  return Array.from({ length: n }, (_, i) => Math.pow(0.5, i / halfLife));
}

export function buildTeamModel(matches: TeamMatch[], leagueAvgGoals: number): TeamModel {
  const sample = matches.slice(0, 12);
  const w = weights(sample.length);
  const totalW = w.reduce((a, b) => a + b, 0) || 1;

  let scored = 0;
  let conceded = 0;
  let homeScored = 0;
  let homeW = 0;
  let awayScored = 0;
  let awayW = 0;

  sample.forEach((m, i) => {
    const wi = w[i] ?? 0;
    scored += m.goalsFor * wi;
    conceded += m.goalsAgainst * wi;
    if (m.isHome) {
      homeScored += m.goalsFor * wi;
      homeW += wi;
    } else {
      awayScored += m.goalsFor * wi;
      awayW += wi;
    }
  });

  const avgScored = scored / totalW;
  const avgConceded = conceded / totalW;
  const base = leagueAvgGoals || 1.35;

  // Shrink towards the league mean when the sample is small (regularisation).
  const shrink = sample.length / (sample.length + 5);
  const attack = 1 + shrink * (avgScored / base - 1);
  const defence = 1 + shrink * (avgConceded / base - 1);

  const form = sample.slice(0, 5).map((m) => m.result);
  const formPoints = form.reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);

  return {
    attack: Math.max(0.35, attack),
    defence: Math.max(0.35, defence),
    homeAttack: homeW ? homeScored / homeW : avgScored,
    awayAttack: awayW ? awayScored / awayW : avgScored,
    form,
    formPoints,
    avgScored,
    avgConceded,
    sample: sample.length,
  };
}

export type Prediction = {
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  topScores: { score: string; probability: number }[];
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  doubleChanceHome: number;
  doubleChanceAway: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  confidence: number;
};

export type ExtendedPrediction = Prediction & {
  over15: number;
  under15: number;
  over35: number;
  under35: number;
  doubleChanceHomeAway: number;
  dnbHome: number;
  dnbAway: number;
  ahHomeMinus1: number;
  ahAwayPlus1: number;
  ahAwayMinus1: number;
  ahHomePlus1: number;
  homeOver05: number;
  homeOver15: number;
  awayOver05: number;
  awayOver15: number;
  /** Normalised score probabilities, rows = home goals 0..5, cols = away goals 0..5. */
  scoreMatrix: number[][];
};

export function predict(
  home: TeamModel,
  away: TeamModel,
  leagueAvgGoals: number,
  homeAdvantage = 1.14,
): Prediction {
  const base = leagueAvgGoals || 1.35;
  const lambdaHome = Math.min(4.5, Math.max(0.2, base * home.attack * away.defence * homeAdvantage));
  const lambdaAway = Math.min(4.5, Math.max(0.2, base * away.attack * home.defence * (2 - homeAdvantage)));

  const size = MAX_GOALS + 1;
  const grid = new Float64Array(size * size);
  const at = (h: number, a: number) => h * size + a;
  for (let h = 0; h < size; h += 1) {
    for (let a = 0; a < size; a += 1) {
      grid[at(h, a)] = poisson(h, lambdaHome) * poisson(a, lambdaAway);
    }
  }

  // Dixon-Coles low-score dependency correction.
  const rho = -0.06;
  const scale = (h: number, a: number, factor: number) => {
    grid[at(h, a)] = (grid[at(h, a)] ?? 0) * factor;
  };
  scale(0, 0, 1 - lambdaHome * lambdaAway * rho);
  scale(0, 1, 1 + lambdaHome * rho);
  scale(1, 0, 1 + lambdaAway * rho);
  scale(1, 1, 1 - rho);

  let total = 0;
  for (let i = 0; i < grid.length; i += 1) total += grid[i] ?? 0;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let bttsYes = 0;
  let cleanSheetHome = 0;
  let cleanSheetAway = 0;
  const scores: { score: string; probability: number }[] = [];

  for (let h = 0; h < size; h += 1) {
    for (let a = 0; a < size; a += 1) {
      const p = (grid[at(h, a)] ?? 0) / total;
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a > 2.5) over25 += p;
      if (h > 0 && a > 0) bttsYes += p;
      if (a === 0) cleanSheetHome += p;
      if (h === 0) cleanSheetAway += p;
      scores.push({ score: `${h}-${a}`, probability: p });
    }
  }

  const topScores = scores.sort((x, y) => y.probability - x.probability).slice(0, 4);
  const spread = Math.max(homeWin, draw, awayWin);
  const sampleQuality = Math.min(1, (home.sample + away.sample) / 20);

  return {
    homeWin,
    draw,
    awayWin,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
    topScores,
    over25,
    under25: 1 - over25,
    bttsYes,
    bttsNo: 1 - bttsYes,
    doubleChanceHome: homeWin + draw,
    doubleChanceAway: awayWin + draw,
    cleanSheetHome,
    cleanSheetAway,
    confidence: Math.round(Math.min(95, spread * 100 * 1.25 * sampleQuality + 20)),
  };
}