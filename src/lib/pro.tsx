import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { useAuth } from "./auth";
import { supabase } from "@/integrations/supabase/client";

export type ActivePass = { plan: string; expires_at: string } | null;

type ProContextValue = {
  isPro: boolean;
  pass: ActivePass;
  loading: boolean;
  refresh: () => void;
};

const ProContext = createContext<ProContextValue>({
  isPro: false,
  pass: null,
  loading: false,
  refresh: () => {},
});

export function ProProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const { data, isPending, refetch } = useQuery({
    queryKey: ["active-pass", user?.id ?? "anon"],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async (): Promise<ActivePass> => {
      const { data: rows } = await supabase
        .from("subscriptions")
        .select("plan, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1);
      return rows?.[0] ?? null;
    },
  });

  const pass = user ? data ?? null : null;

  return (
    <ProContext.Provider
      value={{
        isPro: Boolean(pass),
        pass,
        loading: authLoading || (Boolean(user) && isPending),
        refresh: () => void refetch(),
      }}
    >
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}

export const FREE_ACCA_SELECTIONS = 3;