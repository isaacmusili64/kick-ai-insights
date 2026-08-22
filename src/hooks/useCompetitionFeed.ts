import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { getCompetitionFeed } from "@/lib/football.functions";
import { readCache, writeCache } from "@/lib/query-persist";
import type { FeedFixture } from "@/lib/types";

type CompFeedResult = {
  code: string;
  fixtures: FeedFixture[];
  modelled: boolean;
  error: string | null;
};

const FEED_MAX_AGE_MS = 30 * 60_000;
const FEED_STALE_MS = 3 * 60_000;

/**
 * Loads the board one competition per request. Results are persisted in
 * localStorage (client only) so revisits paint quickly under rate limits.
 */
export function useCompetitionFeed(codes: string[]) {
  const feedFn = useServerFn(getCompetitionFeed);
  // Avoid SSR/client hydration mismatch: only read localStorage after mount.
  const [cacheReady, setCacheReady] = useState(false);
  useEffect(() => setCacheReady(true), []);

  const results = useQueries({
    queries: codes.map((code) => {
      const cached =
        cacheReady ? readCache<CompFeedResult>(["comp-feed", code], FEED_MAX_AGE_MS) : null;
      return {
        queryKey: ["comp-feed", code] as const,
        queryFn: async (): Promise<CompFeedResult> => {
          const data = (await feedFn({ data: { code } })) as CompFeedResult;
          if (!data.error) writeCache(["comp-feed", code], data);
          return data;
        },
        staleTime: FEED_STALE_MS,
        gcTime: FEED_MAX_AGE_MS,
        retry: 1,
        refetchOnWindowFocus: false,
        // placeholderData does not affect SSR HTML the way initialData can.
        ...(cached ? { placeholderData: cached.data } : {}),
      };
    }),
  });

  const dataStamp = results.map((r) => r.dataUpdatedAt).join(",");
  const fixtures = useMemo(() => {
    const all: FeedFixture[] = [];
    for (const r of results) if (r.data?.fixtures) all.push(...(r.data.fixtures as FeedFixture[]));
    return all.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStamp]);

  const loaded = results.filter((r) => !r.isPending || r.isPlaceholderData).length;
  const failed = results.filter((r) => r.data?.error || r.isError).length;

  return {
    fixtures,
    isPending: fixtures.length === 0 && results.some((r) => r.isPending && !r.isPlaceholderData),
    isLoadingMore: results.some((r) => r.isPending && !r.isPlaceholderData),
    loaded,
    total: codes.length,
    failed,
  };
}
