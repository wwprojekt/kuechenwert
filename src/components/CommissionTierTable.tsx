/**
 * CommissionTierTable
 *
 * Single source of truth for displaying the commission tier ladder
 * across all marketing, pricing, and dealer-facing pages.
 *
 * Reads live from `public.commission_tiers` (via useCommissionFromTiers)
 * and re-renders within seconds when an admin changes a tier (Realtime).
 *
 * Variants:
 *  - "compact-grid":  4-column stat cards used in the dealer landing hero
 *                     ("bis 10.000 € → 2,0 %") – no min_commission shown.
 *  - "full-table":    full pricing table with min_amount / max_amount /
 *                     rate / min_commission – used on /preise.
 */

import { useCommissionFromTiers, type CommissionTier } from "@/lib/commissionCalculator";

interface CommissionTierTableProps {
  variant: "compact-grid" | "full-table";
  className?: string;
}

const formatRate = (tier: CommissionTier): string => {
  if (tier.rate_type === "fixed") {
    return `€${Number(tier.rate_value).toLocaleString("de-DE")} pauschal`;
  }
  return `${Number(tier.rate_value).toLocaleString("de-DE")} %`;
};

const formatRange = (tier: CommissionTier, opts: { short?: boolean } = {}): string => {
  const min = Number(tier.min_amount);
  const max = Number(tier.max_amount);
  const isUnbounded = max >= 99_999_999;

  if (opts.short) {
    if (isUnbounded) return `ab ${(min / 1000).toLocaleString("de-DE")}.000 €`;
    return `bis ${(max / 1000).toLocaleString("de-DE")}.000 €`;
  }

  if (isUnbounded) return `ab €${min.toLocaleString("de-DE")}`;
  return `€${min.toLocaleString("de-DE")} – €${max.toLocaleString("de-DE")}`;
};

export const CommissionTierTable = ({ variant, className = "" }: CommissionTierTableProps) => {
  // saleAmount = 0 → we only need the tier list, not a calculation
  const { tiers, isLoading } = useCommissionFromTiers(0);

  if (isLoading || tiers.length === 0) {
    if (variant === "compact-grid") {
      return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10 animate-pulse">
              <div className="h-7 w-16 mx-auto bg-primary/10 rounded" />
              <div className="h-3 w-20 mx-auto mt-2 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className={`rounded-lg border overflow-hidden ${className}`} aria-busy="true">
        <div className="h-32 bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (variant === "compact-grid") {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10"
          >
            <div className="text-2xl font-bold text-primary">{formatRate(tier)}</div>
            <div className="text-xs text-muted-foreground mt-1">{formatRange(tier, { short: true })}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            <th className="px-4 py-2.5 font-medium">Kaufpreis</th>
            <th className="px-4 py-2.5 font-medium text-right">Satz</th>
            <th className="px-4 py-2.5 font-medium text-right">Mindestprovision</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => (
            <tr key={tier.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
              <td className="px-4 py-2">{formatRange(tier)}</td>
              <td className="px-4 py-2 text-right font-medium">{formatRate(tier)}</td>
              <td className="px-4 py-2 text-right">
                €{Number(tier.min_commission).toLocaleString("de-DE", { minimumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CommissionTierTable;
