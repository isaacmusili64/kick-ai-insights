import type { ExtendedPrediction } from "./model";

export type Fixture = {
  id: number;
  utcDate: string;
  status: string;
  competition: string;
  competitionCode: string;
  matchday: number | null;
  home: { id: number; name: string; crest: string | null };
  away: { id: number; name: string; crest: string | null };
};

export type FeedFixture = Fixture & { prediction: ExtendedPrediction | null };

export type TeamResult = {
  goalsFor: number;
  goalsAgainst: number;
  isHome: boolean;
  opponent: string;
  date: string;
  result: "W" | "D" | "L";
};

export type CompetitionStatus = {
  code: string;
  name: string;
  error: string | null;
  modelled: boolean;
};