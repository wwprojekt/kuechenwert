import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_RATE_CARD, calibrationFromRows, mergeRateCard, type PriceCalibration, type RateCard } from "./core";

export interface PriceModel {
  card: RateCard;
  calibration: PriceCalibration | null;
  rateCardVersion: number | null;
}

async function fetchPriceModel() {
  const [rateCard, calibration] = await Promise.all([
    supabase.from("kitchen_pricing_rate_cards").select("version, overrides").eq("is_active", true).maybeSingle(),
    supabase.from("kitchen_price_calibration").select("segment, factor, sample_count"),
  ]);
  if (rateCard.error) throw rateCard.error;
  return {
    overrides: rateCard.data?.overrides ?? {},
    version: rateCard.data?.version ?? null,
    calibrationRows: calibration.error ? [] : (calibration.data ?? []),
  };
}

/**
 * Rate-Card und Marktabgleich wie auf dem Server (kw-planner, kw-lead), damit
 * die angezeigte Schätzung der gespeicherten entspricht. Bis die Daten geladen
 * sind oder wenn sie fehlen, rechnet die Engine mit den Standardsätzen.
 */
export function usePriceModel(): PriceModel {
  const { data } = useQuery({
    queryKey: ["kw-price-model"],
    queryFn: fetchPriceModel,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  return useMemo(
    () => ({
      card: data ? mergeRateCard(data.overrides) : DEFAULT_RATE_CARD,
      calibration: calibrationFromRows(data?.calibrationRows),
      rateCardVersion: data?.version ?? null,
    }),
    [data],
  );
}
