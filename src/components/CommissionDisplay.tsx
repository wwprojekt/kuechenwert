/**
 * Commission Display Component
 * Shows commission amount (no percentage) to dealers on auction pages.
 * Intentionally discreet — just two muted lines: commission and total cost.
 *
 * Uses the shared useCommissionFromTiers hook (cached client-side tier
 * calculation) so this matches AuctionCommissionOverview 1:1 and does
 * not fire an RPC on every keystroke in the bid input.
 */

import { useCommissionFromTiers } from "@/lib/commissionCalculator";

interface CommissionDisplayProps {
  bidAmount?: number;
  variant?: "compact" | "detailed";
  className?: string;
}

export const CommissionDisplay = ({
  bidAmount = 0,
  variant = "detailed",
  className = "",
}: CommissionDisplayProps) => {
  const info = useCommissionFromTiers(bidAmount);

  if (info.isLoading || info.commission <= 0 || bidAmount <= 0) {
    return null;
  }

  if (variant === "compact") {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        Provision: €{info.commission.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
      </span>
    );
  }

  return (
    <div className={`text-xs text-muted-foreground space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span>Provision{info.isMinApplied ? " (mind.)" : ""}</span>
        <span className="font-medium text-foreground">
          €{info.commission.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Gesamtkosten (netto)</span>
        <span className="font-medium text-foreground">
          €{info.totalCost.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
};

export default CommissionDisplay;
