import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, ImageIcon, UserPlus, TrendingUp, ChevronRight } from "lucide-react";

/**
 * Kompaktes Dashboard-Widget fuer Funnel C (Traumkueche-AI).
 *
 * Zeigt:
 * - AI-Renders heute
 * - AI-Leads heute (funnel_type=traumkueche)
 * - Conversion-Rate der letzten 7 Tage
 * - Aktive Sessions (status=active, noch ohne Lead)
 *
 * Klickt man drauf -> /admin/planner-sessions (Details).
 */
function useFunnelCInsights() {
  return useQuery({
    queryKey: ["admin-funnel-c-insights"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [rendersTodayRes, leadsTodayRes, sessions7dRes, leads7dRes, activeRes] =
        await Promise.all([
          supabase
            .from("planner_renders")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayStart)
            .eq("status", "success"),
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("funnel_type", "traumkueche")
            .gte("created_at", todayStart),
          supabase
            .from("planner_sessions")
            .select("*", { count: "exact", head: true })
            .gte("created_at", weekStart),
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("funnel_type", "traumkueche")
            .gte("created_at", weekStart),
          supabase
            .from("planner_sessions")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

      const sessions7d = sessions7dRes.count ?? 0;
      const leads7d = leads7dRes.count ?? 0;
      const conversionPct = sessions7d > 0 ? Math.round((leads7d / sessions7d) * 100) : 0;

      return {
        rendersToday: rendersTodayRes.count ?? 0,
        leadsToday: leadsTodayRes.count ?? 0,
        conversion7dPct: conversionPct,
        sessions7d,
        leads7d,
        activeSessions: activeRes.count ?? 0,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function FunnelCInsightCard() {
  const { data, isLoading } = useFunnelCInsights();

  // Wenn nichts los ist und alles 0 ist + laedt nicht mehr, zeigen wir trotzdem
  // eine Einstiegs-Karte (Funnel-C ist so neu, dass User sonst gar nicht weiss,
  // dass es das gibt).
  const rendersToday = data?.rendersToday ?? 0;
  const leadsToday = data?.leadsToday ?? 0;
  const conv = data?.conversion7dPct ?? 0;
  const active = data?.activeSessions ?? 0;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Traumküchen-KI (Funnel&nbsp;C)</h3>
              <p className="text-xs text-muted-foreground">
                AI-Bildgenerierung · letzte 7 Tage
              </p>
            </div>
          </div>
          <Link
            to="/admin/planner-sessions"
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
            aria-label="Alle Planner-Sessions ansehen"
          >
            Details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Link
            to="/admin/planner-sessions"
            className="rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ImageIcon className="h-3.5 w-3.5" /> Renders heute
            </div>
            <div className="text-xl sm:text-2xl font-bold">
              {isLoading ? "—" : rendersToday}
            </div>
          </Link>

          <Link
            to="/admin/leads?funnel=traumkueche"
            className="rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <UserPlus className="h-3.5 w-3.5" /> Leads heute
            </div>
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {isLoading ? "—" : leadsToday}
            </div>
          </Link>

          <Link
            to="/admin/planner-sessions"
            className="rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Conversion (7d)
            </div>
            <div className="text-xl sm:text-2xl font-bold">
              {isLoading ? "—" : `${conv}%`}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {data ? `${data.leads7d} / ${data.sessions7d} Sessions` : ""}
            </div>
          </Link>

          <Link
            to="/admin/planner-sessions"
            className="rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Sparkles className="h-3.5 w-3.5" /> Aktive Sessions
            </div>
            <div className="text-xl sm:text-2xl font-bold">
              {isLoading ? "—" : active}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">noch kein Lead</div>
          </Link>
        </div>
      </div>
    </Card>
  );
}
