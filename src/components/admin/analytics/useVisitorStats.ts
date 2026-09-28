import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

const DEVICE_LABELS: Record<string, string> = { desktop: "Desktop", mobile: "Mobil", tablet: "Tablet" };

type Entry = { name: string; value: number };

export interface VisitorStats {
  totalPageViews: number;
  sessions: number;
  avgSessionSeconds: number;
  topPages: Entry[];
  devices: Entry[];
  countries: Entry[];
  dailyPageViews: { date: string; views: number }[];
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function topEntries(counts: Map<string, number>, limit: number): Entry[] {
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Seitenaufrufe der letzten 30 Tage (nur mit Statistik-Einwilligung erfasst). */
export function useVisitorStats() {
  return useQuery({
    queryKey: ["adminVisitorStats"],
    queryFn: async (): Promise<VisitorStats | null> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const now = new Date();
      const { data, error } = await supabase
        .from("analytics_page_views")
        .select("session_id, page_path, device_type, country, time_on_page_seconds, created_at")
        .gte("created_at", subDays(now, 30).toISOString());
      if (error) throw error;

      const pageViews = data ?? [];
      const sessions = new Set(pageViews.map((pv) => pv.session_id)).size;
      const secondsOnSite = pageViews.reduce((sum, pv) => sum + (pv.time_on_page_seconds ?? 0), 0);

      const pages = new Map<string, number>();
      const devices = new Map<string, number>();
      const countries = new Map<string, number>();
      const days = new Map<string, number>();
      for (const pv of pageViews) {
        increment(pages, pv.page_path || "/");
        increment(devices, DEVICE_LABELS[pv.device_type ?? "desktop"] ?? "Tablet");
        increment(countries, pv.country || "Unbekannt");
        increment(days, format(new Date(pv.created_at), "yyyy-MM-dd"));
      }

      return {
        totalPageViews: pageViews.length,
        sessions,
        avgSessionSeconds: sessions > 0 ? secondsOnSite / sessions : 0,
        topPages: topEntries(pages, 10),
        devices: topEntries(devices, 3),
        countries: topEntries(countries, 5),
        dailyPageViews: Array.from({ length: 30 }, (_, i) => {
          const date = subDays(now, 29 - i);
          return {
            date: format(date, "dd.MM", { locale: de }),
            views: days.get(format(date, "yyyy-MM-dd")) ?? 0,
          };
        }),
      };
    },
    staleTime: 120000,
  });
}
