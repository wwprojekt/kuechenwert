/**
 * Stammdaten-Loader fuer Funnel A (und perspektivisch B/C).
 *
 * Liest die Catalog-Tabellen aus Supabase:
 *   - catalog_front_materials      -> Fronten-Auswahl (Step 11)
 *   - catalog_worktop_materials    -> Arbeitsplatten (fuer spaetere Funnels)
 *   - catalog_appliance_brands     -> Geraete-Marken (Step 12)
 *
 * RLS: Policies "public read active" erlauben anon + authenticated READ,
 *      solange is_active = true (siehe Migration 20260429000400).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FunnelAStammdaten } from "@/config/funnel-a";

const emptyStammdaten: FunnelAStammdaten = {
  frontMaterials: [],
  worktopMaterials: [],
  applianceBrands: [],
};

async function loadFunnelAStammdaten(): Promise<FunnelAStammdaten> {
  const [frontsResult, worktopsResult, brandsResult] = await Promise.all([
    supabase
      .from("catalog_front_materials")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("catalog_worktop_materials")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("catalog_appliance_brands")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (frontsResult.error) throw frontsResult.error;
  if (worktopsResult.error) throw worktopsResult.error;
  if (brandsResult.error) throw brandsResult.error;

  return {
    frontMaterials: frontsResult.data ?? [],
    worktopMaterials: worktopsResult.data ?? [],
    applianceBrands: brandsResult.data ?? [],
  };
}

export function useFunnelAStammdaten() {
  return useQuery({
    queryKey: ["funnel-a-stammdaten"],
    queryFn: loadFunnelAStammdaten,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    initialData: emptyStammdaten,
  });
}
