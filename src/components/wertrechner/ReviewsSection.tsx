import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWertrechnerReviewStats } from "@/hooks/useWertrechnerReviewStats";

interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  reviewer_location: string | null;
  vehicle_type: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

function formatDeDecimal(value: number, fractionDigits: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function StarRow({
  rating,
  size = "md",
  label,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const safe = Math.max(0, Math.min(5, rating));
  const starClass =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      role="img"
      aria-label={label ?? `${formatDeDecimal(safe, 1)} von 5 Sternen`}
      className="inline-flex items-center"
    >
      {[1, 2, 3, 4, 5].map((pos) => {
        const filled = safe >= pos;
        const partial = !filled && safe > pos - 1 ? safe - (pos - 1) : 0;
        return (
          <span key={pos} className="relative inline-flex">
            <Star
              className={cn(starClass, "text-gray-300 dark:text-gray-600")}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {(filled || partial > 0) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : `${partial * 100}%` }}
                aria-hidden="true"
              >
                <Star
                  className={cn(starClass, "fill-amber-400 text-amber-400")}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function DistributionBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-8 text-right text-muted-foreground">{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} Sterne: ${count} Bewertungen (${pct}%)`}
      >
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function ReviewItem({ review }: { review: PublicReview }) {
  const created = new Date(review.created_at);
  const dateStr = Number.isNaN(created.getTime())
    ? ""
    : format(created, "dd.MM.yyyy", { locale: de });

  const nameLabel = review.reviewer_name?.trim()
    ? review.reviewer_name.trim()
    : "Anonym";
  const locationLabel = review.reviewer_location?.trim() ?? "";

  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRow rating={review.rating} size="sm" />
        <span className="text-sm font-medium text-foreground">{nameLabel}</span>
        {locationLabel && (
          <span className="text-xs text-muted-foreground">aus {locationLabel}</span>
        )}
        {dateStr && (
          <>
            <span className="text-muted-foreground" aria-hidden="true">·</span>
            <time dateTime={review.created_at} className="text-xs text-muted-foreground">
              {dateStr}
            </time>
          </>
        )}
      </header>
      {review.comment && (
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {review.comment}
        </p>
      )}
    </article>
  );
}

interface ReviewsSectionProps {
  /**
   * Optional HTML id for anchor linking (e.g. badge linkTo="#reviews").
   * Default: "reviews".
   */
  anchorId?: string;
  /**
   * Hide entire section when below minimum. Default true — we do not want
   * an empty "Noch keine Bewertungen" section under an SEO landing page.
   * Pass `false` for the canonical /wertrechner page where the admin may
   * want to see the empty state.
   */
  hideWhenEmpty?: boolean;
  className?: string;
}

/**
 * Full reviews section for the canonical /wertrechner page.
 *
 * Shows:
 *  - Aggregate header (big average, count, star row, distribution bars)
 *  - Paginated list of approved reviews ("Mehr anzeigen" loads another page)
 *
 * Reads data via public RPCs `get_wertrechner_review_stats` and
 * `get_wertrechner_reviews_public` — no auth, no RLS surprises.
 */
export function ReviewsSection({
  anchorId = "reviews",
  hideWhenEmpty = true,
  className,
}: ReviewsSectionProps) {
  const { stats, hasEnoughReviewsForBadge } = useWertrechnerReviewStats();
  const [page, setPage] = useState(1);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["wertrechner-reviews-list", page],
    queryFn: async (): Promise<PublicReview[]> => {
      const { data, error } = await supabase.rpc("get_wertrechner_reviews_public", {
        p_limit: PAGE_SIZE * page,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as PublicReview[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: hasEnoughReviewsForBadge || !hideWhenEmpty,
  });

  if (hideWhenEmpty && !hasEnoughReviewsForBadge) return null;

  const total = stats.count;
  const totalForDistribution = total || 1;
  const hasMore = reviews.length >= PAGE_SIZE * page && reviews.length < total;

  return (
    <section
      id={anchorId}
      className={cn("scroll-mt-24", className)}
      aria-labelledby={`${anchorId}-heading`}
    >
      <Card>
        <CardContent className="space-y-6 p-6">
          <header className="space-y-4">
            <h2 id={`${anchorId}-heading`} className="text-2xl font-bold">
              Was unsere Nutzer sagen
            </h2>

            {total > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col items-start justify-center gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold tabular-nums">
                      {formatDeDecimal(stats.average, 1)}
                    </span>
                    <span className="text-sm text-muted-foreground">von 5</span>
                  </div>
                  <StarRow rating={stats.average} size="lg" />
                  <p className="text-sm text-muted-foreground">
                    Basierend auf{" "}
                    <span className="tabular-nums font-medium text-foreground">
                      {total.toLocaleString("de-DE")}
                    </span>{" "}
                    {total === 1 ? "Bewertung" : "Bewertungen"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((level) => (
                    <DistributionBar
                      key={level}
                      label={`${level}★`}
                      count={stats.distribution[level as 1 | 2 | 3 | 4 | 5]}
                      total={totalForDistribution}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Bewertungen — sei die/der Erste!
              </p>
            )}
          </header>

          {reviews.length > 0 && (
            <div className="divide-y divide-border">
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}

          {isLoading && reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">Bewertungen werden geladen…</p>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
              >
                Mehr anzeigen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default ReviewsSection;
