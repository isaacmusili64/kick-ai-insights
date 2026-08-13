import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const KEY = "pitchmodel.history";

/** Cap on stored entries so localStorage doesn't grow without bound. */
const MAX_ENTRIES = 200;

export type HistoryOutcome = "HOME_WIN" | "DRAW" | "AWAY_WIN";

export type HistoryEntry = {
  matchId: number;
  home: string;
  away: string;
  competition: string;
  utcDate: string;
  /** The model's 1X2 probabilities at the time this prediction was logged. */
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  loggedAt: string;
  /** Filled in once the match has finished and the result has been checked. */
  result: {
    status: string;
    homeGoals: number;
    awayGoals: number;
    outcome: HistoryOutcome;
    correct: boolean;
  } | null;
};

export type LogInput = Omit<HistoryEntry, "loggedAt" | "result">;

export function predictedOutcome(entry: Pick<HistoryEntry, "homeWin" | "draw" | "awayWin">): HistoryOutcome {
  if (entry.homeWin >= entry.draw && entry.homeWin >= entry.awayWin) return "HOME_WIN";
  if (entry.awayWin >= entry.draw && entry.awayWin >= entry.homeWin) return "AWAY_WIN";
  return "DRAW";
}

type HistoryContextValue = {
  entries: HistoryEntry[];
  log: (entry: LogInput) => void;
  recordResult: (matchId: number, result: { status: string; homeGoals: number; awayGoals: number }) => void;
  remove: (matchId: number) => void;
  clear: () => void;
  accuracy: { graded: number; correct: number; pct: number | null };
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setEntries(JSON.parse(raw) as HistoryEntry[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      /* storage unavailable */
    }
  }, [entries]);

  const log = useCallback((entry: LogInput) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.matchId === entry.matchId);
      // Once a result has been recorded, don't let a re-visit overwrite it.
      if (existing?.result) return prev;
      const without = prev.filter((e) => e.matchId !== entry.matchId);
      const next: HistoryEntry = { ...entry, loggedAt: new Date().toISOString(), result: null };
      return [next, ...without].slice(0, MAX_ENTRIES);
    });
  }, []);

  const recordResult = useCallback(
    (matchId: number, result: { status: string; homeGoals: number; awayGoals: number }) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.matchId !== matchId || e.result) return e;
          const outcome: HistoryOutcome =
            result.homeGoals > result.awayGoals
              ? "HOME_WIN"
              : result.homeGoals < result.awayGoals
                ? "AWAY_WIN"
                : "DRAW";
          return {
            ...e,
            result: { ...result, outcome, correct: outcome === predictedOutcome(e) },
          };
        }),
      );
    },
    [],
  );

  const remove = useCallback((matchId: number) => {
    setEntries((prev) => prev.filter((e) => e.matchId !== matchId));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const accuracy = useMemo(() => {
    const graded = entries.filter((e) => e.result);
    const correct = graded.filter((e) => e.result?.correct).length;
    // Brier score: mean squared error between the predicted probability
    // vector [homeWin, draw, awayWin] and the one-hot actual outcome.
    // 0 = perfect calibration, 0.667 = uninformative guessing, lower is better.
    const brier = graded.length
      ? graded.reduce((sum, e) => {
          const outcome = e.result!.outcome;
          const err =
            (e.homeWin - (outcome === "HOME_WIN" ? 1 : 0)) ** 2 +
            (e.draw - (outcome === "DRAW" ? 1 : 0)) ** 2 +
            (e.awayWin - (outcome === "AWAY_WIN" ? 1 : 0)) ** 2;
          return sum + err;
        }, 0) / graded.length
      : null;
    return {
      graded: graded.length,
      correct,
      pct: graded.length ? correct / graded.length : null,
      brier,
    };
  }, [entries]);

  return (
    <HistoryContext.Provider value={{ entries, log, recordResult, remove, clear, accuracy }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}
