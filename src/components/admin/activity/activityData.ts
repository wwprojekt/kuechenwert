import { supabase } from "@/integrations/supabase/client";

export interface ProjectFacts {
  postal_code: string;
  city: string | null;
  kitchen_style: string | null;
  kitchen_form: string | null;
  budget_midpoint: number | null;
}

export interface UserProject extends ProjectFacts {
  id: string;
  funnel_type: string;
  status: string;
  created_at: string;
}

export interface UserOffer {
  id: string;
  price_eur: number;
  status: string;
  created_at: string;
  auction: { id: string; status: string; lead: ProjectFacts | null } | null;
}

const PROJECT_COLUMNS =
  "id, funnel_type, status, kitchen_style, kitchen_form, budget_midpoint, postal_code, city, created_at";

// lead_bids und lead_auctions sind doppelt verknüpft (auction_id und won_bid_id),
// deshalb braucht die Einbettung den Fremdschlüssel-Hinweis.
const OFFER_COLUMNS = `id, price_eur, status, created_at,
  auction:lead_auctions!lead_bids_auction_id_fkey(
    id,
    status,
    lead:leads!lead_auctions_lead_id_fkey(postal_code, city, kitchen_style, kitchen_form, budget_midpoint)
  )`;

export async function fetchUserProjects(userId: string, limit = 10) {
  const { data, count, error } = await supabase
    .from("leads")
    .select(PROJECT_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { projects: (data ?? []) as UserProject[], total: count ?? 0 };
}

export async function fetchDealerOffers(dealerId: string, limit = 10) {
  const { data, count, error } = await supabase
    .from("lead_bids")
    .select(OFFER_COLUMNS, { count: "exact" })
    .eq("dealer_id", dealerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { offers: (data ?? []) as unknown as UserOffer[], total: count ?? 0 };
}

export async function countDealerOffers(dealerId: string, status: string) {
  const { count, error } = await supabase
    .from("lead_bids")
    .select("id", { count: "exact", head: true })
    .eq("dealer_id", dealerId)
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}
