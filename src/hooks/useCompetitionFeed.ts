import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { getCompetitionFeed } from "@/lib/football.functions";
import type { FeedFixture } from "@/lib/types";

/**
 * Loads the board one competition per request. Each league resolves on its own,
 * so selecting every competition still fills the page instead of timing out on
 * a single long request.
 */
export function useCompetitionFeed(codes: string[]) {
  const feedFn = useServerFn(getCompetitionFeed);

  const results = useQueries({
    queries: codes.map((code) => ({
      queryKey: ["comp-feed", code],
      queryFn: () => feedFn({ data: { code } }),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
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