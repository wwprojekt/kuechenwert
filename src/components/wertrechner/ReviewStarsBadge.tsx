import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useWertrechnerReviewStats } from "@/hooks/useWertrechnerReviewStats";

export type ReviewStarsBadgeSize = "sm" | "md" | "lg";
export type ReviewStarsBadgeVariant = "compact" | "full" | "inline";

interface ReviewStarsBadgeProps {
  /**
   * Size affects font + star dimensions. sm = 12px text, md = 14px, lg = 16px.
   */
  size?: ReviewStarsBadgeSize;
  /**
   * `compact` = `★★★★★ 4,8` (just rating, no count)
   * `full`    = `★★★★★ 4,8 · 342 Bewertungen` (full social proof)
   * `inline`  = `★ 4,8 (342)` — minimal, single star icon, for dense contexts
   */
  variant?: ReviewStarsBadgeVariant;
  /**
   * If true, wraps the badge in a Link to /wertrechner#reviews.
   * Default: false (caller decides).
   */
  link?: boolean;
  /**
   * Override link target. Defaults to `/wertrechner#reviews`.
   */
  linkTo?: string;
  /**
   * Additional classes for the outer element.
   */
  className?: string;
  /**
   * Override rendering even below threshold — useful for Admin previews.
   * Default: false (threshold enforced).
   */
  forceShow?: boolean;
}

const SIZE_CLASSES: Record<ReviewStarsBadgeSize, { text: string; star: string; gap: string }> = {
  sm: { text: "text-xs", star: "h-3 w-3", gap: "gap-1" },
  md: { text: "text-sm", star: "h-4 w-4", gap: "gap-1.5" },
  lg: { text: "text-base", star: "h-5 w-5", gap: "gap-2" },
};

function formatDeDecimal(value: number, fractionDigits: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Renders a row of 5 stars, partially filled based on `rating` (1-5).
 * Accessible: wrapped in a span with role="img" and aria-label.
 */
function StarRow({ rating, starClass }: { rating: number; starClass: string }) {
  const safe = Math.max(0, Math.min(5, rating));
  return (
    <span
      role="img"
      aria-label={`${formatDeDecimal(safe, 1)} von 5 Sternen`}
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

/**
 * Small star-rating badge shown next to Wertrechner CTAs across the site.
 *
 * IMPORTANT: Renders `null` unless the live review count meets
 * `WERTRECHNER_BADGE_MIN_REVIEWS`. We do not want "0 Bewertungen" or
 * undersized counts shown next to CTAs — that hurts conversion more than
 * helping it. Pass `forceShow` only for admin preview UIs.
 *
 * The badge is PURE UI / social proof. It does NOT inject JSON-LD structured
 * data — that is the job of `generateWertrechnerSchema()` on calculator
 * pages only.
 */
export function ReviewStarsBadge({
  size = "md",
  variant = "full",
  link = false,
  linkTo = "/wertrechner#reviews",
  className,
  forceShow = false,
}: ReviewStarsBadgeProps) {
  const { stats, hasEnoughReviewsForBadge, isLoading } = useWertrechnerReviewStats();

  if (isLoading && !forceShow) return null;
  if (!hasEnoughReviewsForBadge && !forceShow) return null;

  const sizeCls = SIZE_CLASSES[size];
  const average = stats.average || 0;
  const count = stats.count || 0;
  const averageDe = formatDeDecimal(average, 1);
  const countDe = count.toLocaleString("de-DE");

  const Content = (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        sizeCls.text,
        sizeCls.gap,
        link && "hover:opacity-80 transition-opacity",
        className,
      )}
    >
      {variant === "inline" ? (
        <Star
          className={cn(sizeCls.star, "fill-amber-400 text-amber-400 shrink-0")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ) : (
        <StarRow rating={average} starClass={cn(sizeCls.star, "shrink-0")} />
      )}
      <span className="tabular-nums text-foreground">{averageDe}</span>
      {variant === "full" && (
        <span className="text-muted-foreground font-normal">
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{countDe}</span>{" "}
          {count === 1 ? "Bewertung" : "Bewertungen"}
        </span>
      )}
      {variant === "inline" && (
        <span className="text-muted-foreground font-normal tabular-nums">
          ({countDe})
        </span>
      )}
    </span>
  );

  if (link) {
    return (
      <Link
        to={linkTo}
        className="no-underline"
        aria-label={`Wertrechner-Bewertungen: ${averageDe} von 5 Sternen aus ${countDe} Bewertungen`}
      >
        {Content}
      </Link>
    );
  }

  return Content;
}

export default ReviewStarsBadge;
