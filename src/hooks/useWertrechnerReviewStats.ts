import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WertrechnerReviewStats {
  count: number;
  average: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

const DEFAULT_STATS: WertrechnerReviewStats = {
  count: 0,
  average: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

// Threshold — below this count the badge renders null everywhere on the site.
// Raise only after collecting enough real approved reviews so the social proof
// is credible. Keep in sync with BADGE_MIN_REVIEWS on the component.
export const WERTRECHNER_BADGE_MIN_REVIEWS = 10;

// SEO threshold — below this count the JSON-LD AggregateRating schema is NOT
// injected on calculator pages. Google generally expects at least 5 reviews
// before showing stars in search results; we require 30 to be safely above the
// noise floor and to avoid emitting schema for tiny sample sizes.
export const WERTRECHNER_SCHEMA_MIN_REVIEWS = 30;

export const wertrechnerReviewStatsQueryKey = ["wertrechner-review-stats"] as const;

/**
 * Public hook: returns aggregate review stats (count, average, distribution).
 *
 * - Uses the public RPC `get_wertrechner_review_stats` (approved reviews only)
 * - Cached 5 min, refetched on window focus
 * - Falls back to zeros on any error so callers never crash
 */
export function useWertrechnerReviewStats() {
  const query = useQuery({
    queryKey: wertrechnerReviewStatsQueryKey,
    queryFn: async (): Promise<WertrechnerReviewStats> => {
      const { data, error } = await supabase.rpc("get_wertrechner_review_stats");
      if (error) throw error;

      const raw = (data ?? {}) as Partial<WertrechnerReviewStats> & {
        distribution?: Partial<WertrechnerReviewStats["distribution"]>;
      };
      return {
        count: Number(raw.count ?? 0) || 0,
        average: Number(raw.average ?? 0) || 0,
        distribution: {
          1: Number(raw.distribution?.[1] ?? 0) || 0,
          2: Number(raw.distribution?.[2] ?? 0) || 0,
          3: Number(raw.distribution?.[3] ?? 0) || 0,
          4: Number(raw.distribution?.[4] ?? 0) || 0,
          5: Number(raw.distribution?.[5] ?? 0) || 0,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    stats: query.data ?? DEFAULT_STATS,
    isLoading: query.isLoading,
    isError: query.isError,
    hasEnoughReviewsForBadge:
      (query.data?.count ?? 0) >= WERTRECHNER_BADGE_MIN_REVIEWS,
    hasEnoughReviewsForSchema:
      (query.data?.count ?? 0) >= WERTRECHNER_SCHEMA_MIN_REVIEWS,
  };
}
