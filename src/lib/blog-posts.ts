export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  readMinutes: number;
  tags: string[];
  /** Simple paragraphs; no HTML */
  body: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-pitchmodel-prices-a-match",
    title: "How PitchModel prices a football match",
    description:
      "A plain-English look at the Poisson / Dixon-Coles model behind every probability on the board.",
    date: "2026-08-20",
    readMinutes: 5,
    tags: ["Model", "Explainers"],
    body: [
      "PitchModel does not pick winners from gut feel. Each fixture is priced from league strength tables, recent form and a Poisson score grid — the same family of models used in academic football analytics.",
      "Attack and defence ratings are estimated for both teams, adjusted for home advantage measured from real results, then turned into a full matrix of scorelines. From that matrix we read match odds, over/under, BTTS and related markets.",
      "Early in a season the current table is thin, so last-season data is blended in so sides stay differentiated instead of collapsing to the same number. When team news is available, availability is applied as a light multiplier on attack or defence.",
      "Every public pick is logged and graded on the track record page. That is the feedback loop: the model is only as useful as the results it leaves behind.",
    ],
  },
  {
    slug: "reading-model-edge-not-just-favourites",
    title: "Reading model edge — not just favourites",
    description:
      "Why a 55% home win can be more interesting than a 70% one, once you compare to a typical market baseline.",
    date: "2026-08-18",
    readMinutes: 4,
    tags: ["Edge", "Markets"],
    body: [
      "A high probability is not the same as a good price. The board highlights where our number sits against a simple market baseline — that gap is the model edge.",
      "Favourites often look obvious on the 1X2 bar. Edge is more useful when the model and the typical price disagree: a modest favourite the model likes more than the market, or an underdog the model will not write off.",
      "Use confidence and sample size as a brake. Early-season or low-data fixtures carry wider uncertainty even when the point estimate looks sharp.",
      "Pro unlocks every league and the full edge view. Free users still see four leagues and the same underlying engine on those competitions.",
    ],
  },
  {
    slug: "responsible-use-of-football-predictions",
    title: "Responsible use of football predictions",
    description:
      "Statistical analysis is not a tipster service. How we expect the numbers to be used.",
    date: "2026-08-15",
    readMinutes: 3,
    tags: ["Policy"],
    body: [
      "PitchModel publishes model-based probabilities for education and research-style analysis. It is not betting advice, and it is not a guarantee of outcomes.",
      "Football is noisy. Even a well-calibrated 60% side will lose often. Track record pages exist so you can judge calibration over many matches, not one result.",
      "If you use any third-party operator, stay within the law where you live, never stake money you cannot afford to lose, and treat 18+ rules seriously.",
      "Questions about the product, privacy or billing are welcome on the contact page — we do not provide individual betting instructions.",
    ],
  },
];

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function postsNewestFirst(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}
