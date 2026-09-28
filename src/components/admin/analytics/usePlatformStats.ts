import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { formLabel } from "@/features/funnel-a/catalog";

export interface PlatformStats {
  leads30: number;
  leadsTrend: number | null;
  offers30: number;
  offersTrend: number | null;
  activeTenders: number;
  awardedTenders: number;
  daily: { date: string; leads: number; offers: number }[];
  kitchenForms: { name: string; value: number }[];
  topStudios: { name: string; count: number }[];
  totalUsers: number;
  activeStudios: number;
  avgOfferEur: number | null;
}

function trend(recent: number, previous: number): number | null {
  return previous > 0 ? ((recent - previous) / previous) * 100 : null;
}

function dayKey(date: Date | string): string {
  return format(new Date(date), "yyyy-MM-dd");
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

async function studioNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, company_name, first_name, last_name, email")
    .in("id", ids);
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      p.company_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Unbekannt",
    ]),
  );
}

/** Marktplatz-Kennzahlen: Anfragen, Ausschreibungen und Studio-Angebote der letzten 30 Tage. */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["adminPlatformStats"],
    queryFn: async (): Promise<PlatformStats | null> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const now = new Date();
      const since30 = subDays(now, 30);
      const since60 = subDays(now, 60).toISOString();

      const [leadsRes, offersRes, activeRes, awardedRes, usersRes, studiosRes] = await Promise.all([
        supabase.from("leads").select("created_at, kitchen_form").gte("created_at", since60),
        supabase.from("lead_bids").select("dealer_id, price_eur, created_at").gte("created_at", since60),
        supabase.from("lead_auctions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("lead_auctions").select("id", { count: "exact", head: true }).eq("status", "awarded"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "dealer"),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (offersRes.error) throw offersRes.error;

      const isRecent = (createdAt: string) => new Date(createdAt) >= since30;
      const leads = leadsRes.data ?? [];
      const offers = offersRes.data ?? [];
      const recentLeads = leads.filter((l) => isRecent(l.created_at));
      const recentOffers = offers.filter((o) => isRecent(o.created_at));

      const leadsPerDay = countBy(recentLeads, (l) => dayKey(l.created_at));
      const offersPerDay = countBy(recentOffers, (o) => dayKey(o.created_at));
      const daily = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(now, 29 - i);
        const key = dayKey(date);
        return {
          date: format(date, "dd.MM", { locale: de }),
          leads: leadsPerDay.get(key) ?? 0,
          offers: offersPerDay.get(key) ?? 0,
        };
      });

      const kitchenForms = [...countBy(recentLeads, (l) => formLabel(l.kitchen_form) ?? "Ohne Angabe")]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const topStudioCounts = [...countBy(recentOffers, (o) => o.dealer_id)]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const names = await studioNames(topStudioCounts.map(([id]) => id));
      const topStudios = topStudioCounts.map(([id, count]) => ({ name: names.get(id) ?? "Unbekannt", count }));

      const prices = recentOffers.map((o) => Number(o.price_eur)).filter((p) => p > 0);

      return {
        leads30: recentLeads.length,
        leadsTrend: trend(recentLeads.length, leads.length - recentLeads.length),
        offers30: recentOffers.length,
        offersTrend: trend(recentOffers.length, offers.length - recentOffers.length),
        activeTenders: activeRes.count ?? 0,
        awardedTenders: awardedRes.count ?? 0,
        daily,
        kitchenForms,
        topStudios,
        totalUsers: usersRes.count ?? 0,
        activeStudios: studiosRes.count ?? 0,
        avgOfferEur: prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : null,
      };
    },
    staleTime: 120000,
  });
}
