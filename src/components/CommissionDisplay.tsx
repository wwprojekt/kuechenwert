/**
 * Commission Display Component
 * Shows commission rates to dealers on auction pages
 */

import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Percent, Euro } from "lucide-react";
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
  const { calculation, loading } = useCommissionCalculation(
    bidAmount, 
    user?.id
  );

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded"></div>
      </div>
    );
  }

  if (!calculation) {
    return null;
  }

  const commissionRate = calculation.final_rate;
  const commissionAmount = calculation.commission_amount;

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Percent className="h-3 w-3" />
          {commissionRate}% Provision
        </Badge>
        {bidAmount > 0 && (
          <span className="text-sm text-muted-foreground">
            (€{commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })})
          </span>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`p-4 border-orange-200 bg-orange-50 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Percent className="h-5 w-5 text-orange-600" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-orange-900">Provisionsrate</h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-orange-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Die Provision wird bei erfolgreichem Kauf automatisch berechnet</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-orange-700">Provisionsrate</p>
                <p className="text-lg font-bold text-orange-900">
                  {commissionRate}%
                </p>
              </div>
              
              {bidAmount > 0 && (
                <div>
                  <p className="text-sm text-orange-700">Provision bei diesem Gebot</p>
                  <p className="text-lg font-bold text-orange-900 flex items-center gap-1">
                    <Euro className="h-4 w-4" />
                    {commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
            
            {bidAmount > 0 && (
              <div className="pt-2 border-t border-orange-200">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">Gebotssumme:</span>
                  <span className="font-medium">€{bidAmount.toLocaleString('de-DE')}</span>
                </div>
                {calculation.volume_discount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700">Basis-Provision ({calculation.base_rate}%):</span>
                      <span className="font-medium line-through text-muted-foreground">
                        €{(bidAmount * (calculation.base_rate / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Volumenrabatt ({calculation.volume_discount}%):</span>
                      <span className="font-medium">-€{calculation.savings.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">
                    {calculation.volume_discount > 0 ? 'Reduzierte ' : ''}Provision ({commissionRate.toFixed(2)}%):
                  </span>
                  <span className="font-medium">€{commissionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-orange-200 pt-1 mt-1">
                  <span className="text-orange-900">Gesamtkosten:</span>
                  <span className="text-orange-900">€{calculation.total_cost.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                {calculation.savings > 0 && (
                  <div className="text-xs text-green-600 text-center mt-2">
                    💰 Sie sparen €{calculation.savings.toLocaleString('de-DE', { minimumFractionDigits: 2 })} durch Ihren Volumenrabatt!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

/**
 * Hook for commission calculations
 */
export const useCommissionCalculation = (bidAmount: number = 0) => {
  const { settings } = useSettings();
  
  const commissionRate = settings?.commission_rate_percent || 0;
  const commissionAmount = bidAmount * (commissionRate / 100);
  const totalCost = bidAmount + commissionAmount;

  return {
    commissionRate,
    commissionAmount,
    totalCost,
    formattedCommissionAmount: commissionAmount.toLocaleString('de-DE', { 
      style: 'currency', 
      currency: 'EUR' 
    }),
    formattedTotalCost: totalCost.toLocaleString('de-DE', { 
      style: 'currency', 
      currency: 'EUR' 
    }),
  };
};

export default CommissionDisplay;
