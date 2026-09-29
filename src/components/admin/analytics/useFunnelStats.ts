import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FunnelId } from "@/lib/funnelRoutes";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

export interface FunnelStepStats {
  step_index: number;
  step: string;
  label: string | null;
  reached: number;
  dropped: number;
  median_ms: number | null;
  validation_failed: number;
  validation_sessions: number;
  back_clicks: number;
  idle_sessions: number;
  exit_intents: number;
  error_fields: Array<{ field: string; count: number }>;
}

export interface FunnelFieldStats {
  field: string;
  step: string;
  step_index: number;
  sessions: number;
  focuses: number;
  left_empty: number;
  corrected: number;
  changes: number;
  validation_errors: number;
}

export interface FunnelStats {
  funnel: FunnelId;
  days: number;
  totals: { sessions: number; answered: number; converted: number; median_duration_ms: number | null };
  steps: FunnelStepStats[];
  fields: FunnelFieldStats[];
  devices: Array<{ device: string; sessions: number; converted: number }>;
  sources: Array<{ source: string; sessions: number; converted: number }>;
  problems: Array<{ event: "js_error" | "submit_failed"; message: string; count: number; sessions: number; last_seen: string }>;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "–";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/** Funnel-Telemetrie (kw_funnel_events) über kw_admin_funnel_stats, nur mit Statistik-Einwilligung erfasst. */
export function useFunnelStats(funnel: FunnelId, days: number) {
  return useQuery({
    queryKey: ["adminFunnelStats", funnel, days],
    queryFn: async (): Promise<FunnelStats | null> => {
      if (!(await ensureValidRLSSession())) return null;
      const { data, error } = await supabase.rpc("kw_admin_funnel_stats", { p_funnel: funnel, p_days: days });
      if (error) throw new Error(error.message);
      return data as unknown as FunnelStats;
    },
    staleTime: 60_000,
  });
}
