/**
 * Aktive Rate-Card der Preis-Engine (kitchen_pricing_rate_cards.overrides)
 * und Marktabgleich (kitchen_price_calibration), gemeinsam für kw-planner
 * (Konfigurator), kw-lead (Funnel A) und kw-maintenance (Kalibrierung).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { calibrationFromRows, mergeRateCard, type PriceCalibration, type RateCard } from "./kitchen-pricing.ts";

export async function loadRateCard(
  sb: SupabaseClient,
): Promise<{ card: RateCard; version: number | null; calibration: PriceCalibration | null }> {
  const [{ data }, { data: rows, error: calibrationError }] = await Promise.all([
    sb.from("kitchen_pricing_rate_cards").select("version, overrides").eq("is_active", true).maybeSingle(),
    sb.from("kitchen_price_calibration").select("segment, factor, sample_count"),
  ]);
  if (calibrationError) console.warn("[rate-card] Marktabgleich nicht lesbar", calibrationError.message);
  return {
    card: mergeRateCard(data?.overrides ?? {}),
    version: (data?.version as number | undefined) ?? null,
    calibration: calibrationFromRows(rows ?? null),
  };
}
