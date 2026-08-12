import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MarketId } from "./markets";

const KEY = "pitchmodel.acca";

export type AccaSelection = {
  matchId: number;
  fixture: string;
  market: MarketId;
  label: string;
  probability: number;
};

export type AccaStyle = "conservative" | "balanced" | "aggressive";

export const ACCA_STYLES: { id: AccaStyle; label: string; note: string; min: number }[] = [
  { id: "conservative", label: "Conservative", note: "Only selections at 70% model probability or higher", min: 0.7 },
  { id: "balanced", label: "Balanced", note: "Selections at 60% or higher", min: 0.6 },
  { id: "aggressive", label: "Aggressive", note: "Any selection above 45%", min: 0.45 },
];

type AccaContextValue = {
  selections: AccaSelection[];
  add: (selection: AccaSelection) => void;
  remove: (matchId: number, label: string) => void;
  clear: () => void;
  has: (matchId: number, label: string) => boolean;
  style: AccaStyle;
  setStyle: (style: AccaStyle) => void;
  combined: number;
};

const AccaContext = createContext<AccaContextValue | null>(null);

export function AccaProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<AccaSelection[]>([]);
  const [style, setStyle] = useState<AccaStyle>("balanced");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSelections(JSON.parse(raw) as AccaSelection[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(selections));
    } catch {
      /* ignore */
    }
  }, [selections]);

  const add = useCallback((selection: AccaSelection) => {
    setSelections((prev) => {
      const without = prev.filter((s) => s.matchId !== selection.matchId);
      return [...without, selection];
    });
  }, []);

  const remove = useCallback((matchId: number, label: string) => {
    setSelections((prev) => prev.filter((s) => !(s.matchId === matchId && s.label === label)));
  }, []);

  const clear = useCallback(() => setSelections([]), []);

  const has = useCallback(
    (matchId: number, label: string) => selections.some((s) => s.matchId === matchId && s.label === label),
    [selections],
  );

  const combined = useMemo(
    () => selections.reduce((acc, s) => acc * s.probability, 1),
    [selections],
  );

  return (
    <AccaContext.Provider
      value={{ selections, add, remove, clear, has, style, setStyle, combined: selections.length ? combined : 0 }}
    >
      {children}
    </AccaContext.Provider>
  );
}

export function useAcca() {
  const ctx = useContext(AccaContext);
  if (!ctx) throw new Error("useAcca must be used inside AccaProvider");
  return ctx;
}