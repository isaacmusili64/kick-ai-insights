import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { getCompetitionFeed } from "@/lib/football.functions";
import { readCache, writeCache } from "@/lib/query-persist";
import type { FeedFixture } from "@/lib/types";

type CompFeedResult = {
  code: string;
  fixtures: FeedFixture[];
  modelled: boolean;
  error: string | null;
};

/** Board feed cache: show yesterday's board instantly, refresh in the background. */
const FEED_MAX_AGE_MS = 30 * 60_000; // keep in localStorage up to 30 min
const FEED_STALE_MS = 3 * 60_000; // refetch after 3 min

/**
 * Loads the board one competition per request. Each league resolves on its own,
 * so selecting every competition still fills the page instead of timing out on
 * a single long request. Results are persisted in localStorage so revisits
 * paint immediately under rate limits.
 */
export function useCompetitionFeed(codes: string[]) {
  const feedFn = useServerFn(getCompetitionFeed);

  const results = useQueries({
    queries: codes.map((code) => {
      const cached = readCache<CompFeedResult>(["comp-feed", code], FEED_MAX_AGE_MS);
      return {
        queryKey: ["comp-feed", code] as const,
        queryFn: async (): Promise<CompFeedResult> => {
          const data = (await feedFn({ data: { code } })) as CompFeedResult;
          // Only persist successful payloads with fixtures (or clean empty days).
          if (!data.error) writeCache(["comp-feed", code], data);
          return data;
        },
        staleTime: FEED_STALE_MS,
        gcTime: FEED_MAX_AGE_MS,
        retry: 1,
        refetchOnWindowFocus: false,
        ...(cached
          ? {
              initialData: cached.data,
              initialDataUpdatedAt: cached.savedAt,
            }
          : {}),
      };
    }),
  });

  const fixtures = useMemo(() => {
    const all: FeedFixture[] = [];
    for (const r of results) if (r.data?.fixtures) all.push(...(r.data.fixtures as FeedFixture[]));
    return all.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(",")]);

  const loaded = results.filter((r) => !r.isPending).length;
  const failed = results.filter((r) => r.data?.error || r.isError).length;

  return {
    fixtures,
    isPending: fixtures.length === 0 && results.some((r) => r.isPending),
    isLoadingMore: results.some((r) => r.isPending),
    loaded,
    total: codes.length,
    failed,
  };
}
