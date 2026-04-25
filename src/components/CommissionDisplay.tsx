/**
 * Commission Display Component
 * Shows commission amount (no percentage) to dealers on auction pages.
 * Intentionally discreet — just two muted lines: commission and total cost.
 */

import { useCommissionCalculation } from "@/lib/commissionCalculator";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const { calculation, loading } = useCommissionCalculation(bidAmount, user?.id);

  if (loading || !calculation || bidAmount <= 0) {
    return null;
  }

  const commissionAmount = calculation.commission_amount;
  const totalCost = calculation.total_cost;

  if (variant === "compact") {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        Provision: €{commissionAmount.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
      </span>
    );
  }

  return (
    <div className={`text-xs text-muted-foreground space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span>Provision</span>
        <span className="font-medium text-foreground">
          €{commissionAmount.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Gesamtkosten (netto)</span>
        <span className="font-medium text-foreground">
          €{totalCost.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
};

// NOTE: A duplicate flat-rate `useCommissionCalculation` hook used to live here
// and pulled `site_settings.commission_rate_percent`. It was removed in favour
// of the tier-based hook in `@/lib/commissionCalculator` to keep a single
// source of truth (commission_tiers table). Import from there instead.

export default CommissionDisplay;
