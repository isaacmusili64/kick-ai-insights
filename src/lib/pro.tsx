import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "pitchmodel.pro";

type ProContextValue = { isPro: boolean; setPro: (value: boolean) => void };

const ProContext = createContext<ProContextValue>({ isPro: false, setPro: () => {} });

export function ProProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    try {
      setIsPro(window.localStorage.getItem(KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setPro = useCallback((value: boolean) => {
    setIsPro(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, []);

  return <ProContext.Provider value={{ isPro, setPro }}>{children}</ProContext.Provider>;
}

export function usePro() {
  return useContext(ProContext);
}

export const FREE_ACCA_SELECTIONS = 3;