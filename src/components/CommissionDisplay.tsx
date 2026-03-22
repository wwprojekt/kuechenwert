/**
 * Commission Display Component
 * Shows commission amount in EUR to dealers on auction pages
 * Note: Only the euro amount is shown, not the percentage rate
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Euro } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommissionCalculation } from "@/lib/commissionCalculator";
import { useAuth } from "@/contexts/AuthContext";

interface CommissionDisplayProps {
  bidAmount?: number;
  variant?: "compact" | "detailed";
  className?: string;
}

export const CommissionDisplay = ({ 
  bidAmount = 0, 
  variant = "compact",
  className = "" 
}: CommissionDisplayProps) => {
  const { user } = useAuth();
  const { calculation, loading, error } = useCommissionCalculation(
    bidAmount, 
    user?.id
  );

  // Don't render anything while loading, on error, or if no calculation
  if (loading || error || !calculation || bidAmount <= 0) {
    return null;
  }

  const commissionAmount = calculation.commission_amount;

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Euro className="h-3 w-3" />
          Provision: €{commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
        </Badge>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`p-4 border-orange-200 bg-orange-50 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Euro className="h-5 w-5 text-orange-600" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-orange-900">Provision</h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-orange-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Die Provision wird bei erfolgreichem Kauf automatisch berechnet</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div>
              <p className="text-sm text-orange-700">Provision bei diesem Gebot</p>
              <p className="text-lg font-bold text-orange-900 flex items-center gap-1">
                <Euro className="h-4 w-4" />
                {commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="pt-2 border-t border-orange-200">
              <div className="flex justify-between text-sm">
                <span className="text-orange-700">Gebotssumme:</span>
                <span className="font-medium">€{bidAmount.toLocaleString('de-DE')}</span>
              </div>
              {calculation.volume_discount > 0 && calculation.savings > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Volumenrabatt:</span>
                  <span className="font-medium">-€{calculation.savings.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-orange-700">Provision:</span>
                <span className="font-medium">€{commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-orange-200 pt-1 mt-1">
                <span className="text-orange-900">Gesamtkosten:</span>
                <span className="text-orange-900">€{calculation.total_cost.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
              </div>
              {calculation.savings > 0 && (
                <div className="text-xs text-green-600 text-center mt-2">
                  Sie sparen €{calculation.savings.toLocaleString('de-DE', { minimumFractionDigits: 2 })} durch Ihren Volumenrabatt!
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

export default CommissionDisplay;
