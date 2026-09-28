import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import type { CommissionTier, UnlockPriceRule } from "@/components/pricing/studio-pricing";

const STALE_TIME = 10 * 60 * 1000;

export function useCommissionTiers() {
  return useQuery({
    queryKey: ["studio-pricing", "commission-tiers"],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<CommissionTier[]> => {
      await ensureValidRLSSession();
      const { data, error } = await supabase
        .from("lead_commission_tiers")
        .select("order_value_min_cents,order_value_max_cents,percent,min_cents,max_cents")
        .eq("is_active", true)
        .order("order_value_min_cents");
      if (error) throw error;
      return (data ?? []).map((tier) => ({ ...tier, percent: Number(tier.percent) }));
    },
  });
}

export function useUnlockPriceRules() {
  return useQuery({
    queryKey: ["studio-pricing", "unlock-rules"],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<UnlockPriceRule[]> => {
      await ensureValidRLSSession();
      const { data, error } = await supabase
        .from("lead_pricing_rules")
        .select("budget_min_cents,budget_max_cents,min_price_cents,max_price_cents,percent_of_budget,tier")
        .eq("is_active", true)
        .order("budget_min_cents");
      if (error) throw error;
      return (data ?? []).map((rule) => ({ ...rule, percent_of_budget: Number(rule.percent_of_budget) }));
    },
  });
}
