/**
 * Commission Calculator Library
 * Handles complex tiered commission calculations with volume discounts
 */

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureValidRLSSession } from '@/lib/sessionGuard';
import { logger } from './logger';

/**
 * Module-level Realtime guard: ensures only ONE Supabase channel is opened
 * for commission_tiers changes per app session, even when multiple
 * components mount useCommissionFromTiers simultaneously.
 *
 * The channel invalidates the shared React Query cache key when any tier
 * row changes, so admin edits propagate to all open tabs in seconds
 * (without lowering the 10-min staleTime that protects against polling).
 */
let commissionTiersChannel: ReturnType<typeof supabase.channel> | null = null;
let commissionTiersChannelRefCount = 0;

const COMMISSION_TIERS_QUERY_KEY = ['commission-tiers'] as const;

export interface CommissionTier {
  id: string;
  min_amount: number;
  max_amount: number;
  rate_type: 'percentage' | 'fixed';
  rate_value: number;
  min_commission: number;
  is_active: boolean;
}

export interface VolumeDiscount {
  id: string;
  dealer_id: string;
  purchase_volume: number;
  discount_rate: number;
  active_until?: string;
  is_active: boolean;
}

export interface CommissionCalculation {
  base_rate: number;
  volume_discount: number;
  final_rate: number;
  commission_amount: number;
  tier_id?: string;
  total_cost: number;
  savings: number;
}

class CommissionCalculatorService {
  /**
   * Calculate commission for a given sale amount
   */
  async calculateCommission(
    saleAmount: number,
    dealerId?: string
  ): Promise<CommissionCalculation> {
    try {
      // Use the database function for accurate calculation
      const { data, error } = await supabase
        .rpc('calculate_commission', {
          sale_amount: saleAmount,
          dealer_id_param: dealerId || null
        });

      if (error) throw error;

      const result = data[0];
      if (!result) {
        throw new Error('No commission calculation result');
      }

      const totalCost = saleAmount + result.commission_amount;
      const savings = dealerId ? (saleAmount * (result.base_rate / 100)) - result.commission_amount : 0;

      return {
        base_rate: result.base_rate,
        volume_discount: result.volume_discount,
        final_rate: result.final_rate,
        commission_amount: result.commission_amount,
        tier_id: result.tier_id,
        total_cost: totalCost,
        savings: savings,
      };
    } catch (error) {
      logger.error('Commission calculation error:', error);
      
      // Fallback calculation using site settings
      const { data: settings } = await supabase
        .from('public_site_settings')
        .select('commission_rate_percent')
        .single();

      const fallbackRate = settings?.commission_rate_percent || 1.5;
      const fallbackCommission = saleAmount * (fallbackRate / 100);

      return {
        base_rate: fallbackRate,
        volume_discount: 0,
        final_rate: fallbackRate,
        commission_amount: fallbackCommission,
        total_cost: saleAmount + fallbackCommission,
        savings: 0,
      };
    }
  }

  /**
   * Get all active commission tiers
   */
  async getCommissionTiers(): Promise<CommissionTier[]> {
    const { data, error } = await supabase
      .from('commission_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_amount');

    if (error) {
      logger.error('Error fetching commission tiers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get dealer volume discount
   */
  async getDealerVolumeDiscount(dealerId: string): Promise<VolumeDiscount | null> {
    const { data, error } = await supabase
      .from('dealer_volume_discounts')
      .select('*')
      .eq('dealer_id', dealerId)
      .eq('is_active', true)
      .order('discount_rate', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching volume discount:', error);
      return null;
    }

    return data;
  }

  /**
   * Update dealer volume based on purchase
   */
  async updateDealerVolume(dealerId: string, purchaseAmount: number): Promise<void> {
    try {
      // Get current volume
      const { data: currentDiscount } = await supabase
        .from('dealer_volume_discounts')
        .select('purchase_volume')
        .eq('dealer_id', dealerId)
        .eq('is_active', true)
        .maybeSingle();

      const newVolume = (currentDiscount?.purchase_volume || 0) + purchaseAmount;

      // Determine new discount rate based on volume
      let newDiscountRate = 0;
      if (newVolume >= 500000) newDiscountRate = 15; // €500k+ = 15% discount
      else if (newVolume >= 300000) newDiscountRate = 10; // €300k+ = 10% discount
      else if (newVolume >= 150000) newDiscountRate = 5;  // €150k+ = 5% discount

      // Upsert volume discount record
      const { error } = await supabase
        .from('dealer_volume_discounts')
        .upsert({
          dealer_id: dealerId,
          purchase_volume: newVolume,
          discount_rate: newDiscountRate,
          is_active: true,
        }, {
          onConflict: 'dealer_id',
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating dealer volume:', error);
      throw error;
    }
  }

  /**
   * Record commission calculation for audit
   */
  async recordCommissionCalculation(
    auctionId: string,
    dealerId: string,
    calculation: CommissionCalculation
  ): Promise<void> {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { error } = await supabase
        .from('commission_calculations')
        .insert({
          auction_id: auctionId,
          dealer_id: dealerId,
          sale_amount: calculation.total_cost - calculation.commission_amount,
          base_commission_rate: calculation.base_rate,
          volume_discount_rate: calculation.volume_discount,
          final_commission_rate: calculation.final_rate,
          commission_amount: calculation.commission_amount,
          tier_used_id: calculation.tier_id,
          calculation_details: {
            total_cost: calculation.total_cost,
            savings: calculation.savings,
            calculated_at: new Date().toISOString(),
          },
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error recording commission calculation:', error);
      throw error;
    }
  }

  /**
   * Get commission breakdown for display
   */
  formatCommissionBreakdown(calculation: CommissionCalculation): {
    baseCommission: string;
    volumeDiscount: string;
    finalCommission: string;
    totalCost: string;
    savings: string;
  } {
    const baseAmount = calculation.volume_discount > 0
      ? calculation.commission_amount / (1 - calculation.volume_discount / 100)
      : calculation.commission_amount;
    return {
      baseCommission: baseAmount.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }),
      volumeDiscount: calculation.volume_discount > 0 
        ? `${calculation.volume_discount}% Rabatt` 
        : 'Kein Rabatt',
      finalCommission: calculation.commission_amount.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }),
      totalCost: calculation.total_cost.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }),
      savings: calculation.savings > 0 
        ? calculation.savings.toLocaleString('de-DE', {
            style: 'currency',
            currency: 'EUR',
          })
        : '€0,00',
    };
  }
}

// Export singleton instance
export const commissionCalculator = new CommissionCalculatorService();

// Export convenience functions
export const calculateCommission = (saleAmount: number, dealerId?: string) =>
  commissionCalculator.calculateCommission(saleAmount, dealerId);

export const getCommissionTiers = () =>
  commissionCalculator.getCommissionTiers();

export const updateDealerVolume = (dealerId: string, purchaseAmount: number) =>
  commissionCalculator.updateDealerVolume(dealerId, purchaseAmount);

export const recordCommissionCalculation = (
  auctionId: string,
  dealerId: string,
  calculation: CommissionCalculation
) => commissionCalculator.recordCommissionCalculation(auctionId, dealerId, calculation);

export const formatCommissionBreakdown = (calculation: CommissionCalculation) =>
  commissionCalculator.formatCommissionBreakdown(calculation);

// React hook for commission calculations (RPC-based, legacy)
export const useCommissionCalculation = (saleAmount: number, dealerId?: string) => {
  const [calculation, setCalculation] = React.useState<CommissionCalculation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (saleAmount > 0) {
      setLoading(true);
      calculateCommission(saleAmount, dealerId)
        .then(setCalculation)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [saleAmount, dealerId]);

  return { calculation, loading, error };
};

/**
 * Pure function: compute commission from cached tiers (no RPC).
 * Mirrors DB logic: find tier → rate × amount → GREATEST(result, min_commission)
 */
export function computeCommissionFromTiers(
  tiers: CommissionTier[],
  saleAmount: number
): { commission: number; rate: number; minCommission: number } | null {
  if (!tiers.length || saleAmount <= 0) return null;

  const tier = tiers.find(
    t => t.is_active && saleAmount >= t.min_amount && saleAmount < t.max_amount
  );

  const computeForTier = (t: CommissionTier) => {
    const raw = t.rate_type === 'fixed'
      ? t.rate_value
      : saleAmount * (t.rate_value / 100);
    const commission = Math.max(raw, t.min_commission);
    return { commission, rate: t.rate_value, minCommission: t.min_commission };
  };

  if (!tier) {
    const sorted = [...tiers].filter(t => t.is_active).sort((a, b) => b.min_amount - a.min_amount);
    const fallback = sorted[0];
    if (!fallback) return null;
    return computeForTier(fallback);
  }

  return computeForTier(tier);
}

/**
 * Subscribes to Realtime updates on public.commission_tiers and invalidates
 * the cached query when admins change a tier. Reference-counted across
 * components – the channel is only opened once and torn down when the
 * last consumer unmounts.
 */
function useCommissionTiersRealtime() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    commissionTiersChannelRefCount += 1;

    if (!commissionTiersChannel) {
      commissionTiersChannel = supabase
        .channel('commission-tiers-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'commission_tiers' },
          () => {
            queryClient.invalidateQueries({ queryKey: COMMISSION_TIERS_QUERY_KEY });
          }
        )
        .subscribe();
    }

    return () => {
      commissionTiersChannelRefCount -= 1;
      if (commissionTiersChannelRefCount <= 0 && commissionTiersChannel) {
        supabase.removeChannel(commissionTiersChannel);
        commissionTiersChannel = null;
        commissionTiersChannelRefCount = 0;
      }
    };
  }, [queryClient]);
}

/**
 * React Query hook: loads tiers once, computes commission client-side.
 * Subscribes to Realtime updates so admin tier edits propagate within
 * seconds to all open tabs.
 */
export function useCommissionFromTiers(saleAmount: number) {
  useCommissionTiersRealtime();

  const tiersQuery = useQuery({
    queryKey: [...COMMISSION_TIERS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_tiers')
        .select('*')
        .eq('is_active', true)
        .order('min_amount');
      if (error) throw error;
      return (data ?? []) as CommissionTier[];
    },
    staleTime: 10 * 60 * 1000, // 10 min – tiers rarely change; Realtime handles invalidation
    gcTime: 30 * 60 * 1000,
  });

  const result = React.useMemo(
    () => tiersQuery.data ? computeCommissionFromTiers(tiersQuery.data, saleAmount) : null,
    [tiersQuery.data, saleAmount]
  );

  return {
    tiers: tiersQuery.data ?? [],
    commission: result?.commission ?? 0,
    rate: result?.rate ?? 0,
    minCommission: result?.minCommission ?? 0,
    totalCost: saleAmount + (result?.commission ?? 0),
    isLoading: tiersQuery.isLoading,
    isMinApplied: result ? result.commission > saleAmount * (result.rate / 100) : false,
  };
}

/**
 * Returns the lowest active commission rate (e.g. for "ab 1,2 %" marketing texts).
 * Returns null while loading so consumers can render a skeleton/fallback.
 */
export function useLowestCommissionRate(): {
  lowestRate: number | null;
  isLoading: boolean;
} {
  useCommissionTiersRealtime();

  const tiersQuery = useQuery({
    queryKey: [...COMMISSION_TIERS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_tiers')
        .select('*')
        .eq('is_active', true)
        .order('min_amount');
      if (error) throw error;
      return (data ?? []) as CommissionTier[];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const lowestRate = React.useMemo(() => {
    const tiers = tiersQuery.data ?? [];
    const percentageTiers = tiers.filter(
      t => t.is_active && t.rate_type === 'percentage'
    );
    if (percentageTiers.length === 0) return null;
    return Math.min(...percentageTiers.map(t => Number(t.rate_value)));
  }, [tiersQuery.data]);

  return {
    lowestRate,
    isLoading: tiersQuery.isLoading,
  };
}
