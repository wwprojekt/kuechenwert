/**
 * Aktive Rate-Card der Preis-Engine (kitchen_pricing_rate_cards.overrides),
 * gemeinsam für kw-planner (Konfigurator) und kw-lead (Funnel A).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { mergeRateCard, type RateCard } from "./kitchen-pricing.ts";

export async function loadRateCard(sb: SupabaseClient): Promise<{ card: RateCard; version: number | null }> {
  const { data } = await sb
    .from("kitchen_pricing_rate_cards")
    .select("version, overrides")
    .eq("is_active", true)
    .maybeSingle();
  return { card: mergeRateCard(data?.overrides ?? {}), version: (data?.version as number | undefined) ?? null };
}
