import { supabase } from "@/integrations/supabase/client";
import type { FunnelId } from "@/lib/funnelRoutes";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

export type UxAlertSeverity = "high" | "medium" | "low";
export type UxAlertCategory = "kaputt" | "abbruch" | "reibung";
export type UxAlertStatus = "open" | "resolved";

export interface UxAlert {
  id: string;
  kind: string;
  category: UxAlertCategory;
  severity: UxAlertSeverity;
  funnel: FunnelId | null;
  step: string | null;
  step_index: number | null;
  step_label: string | null;
  field: string | null;
  title: string;
  detail: string;
  hint: string;
  status: UxAlertStatus;
  window_hours: number;
  first_seen_at: string;
  last_seen_at: string;
  occurrences: number;
  reopened_count: number;
  resolved_at: string | null;
  resolved_note: string | null;
  auto_resolved: boolean;
}

export interface UxAlertCheck {
  checked_at: string;
  candidates: number;
  open: number;
  auto_resolved: number;
}

const COLUMNS =
  "id, kind, category, severity, funnel, step, step_index, step_label, field, title, detail, hint, status, window_hours, " +
  "first_seen_at, last_seen_at, occurrences, reopened_count, resolved_at, resolved_note, auto_resolved";

async function requireSession(): Promise<void> {
  if (!(await ensureValidRLSSession())) throw new Error("Sitzung abgelaufen – bitte neu anmelden.");
}

/** Offene Alerts nach Schwere, erledigte nach Datum (die letzten 100). */
export async function fetchUxAlerts(status: UxAlertStatus): Promise<UxAlert[]> {
  await requireSession();
  const base = supabase.from("kw_ux_alerts").select(COLUMNS).eq("status", status);
  const { data, error } =
    status === "open"
      ? await base.order("severity_rank", { ascending: false }).order("last_seen_at", { ascending: false })
      : await base.order("resolved_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UxAlert[];
}

/** Erledigt blendet den Alert für sein Zeitfenster aus; Wieder öffnen holt ihn sofort zurück. */
export async function setUxAlertStatus(id: string, status: UxAlertStatus, userId: string | null): Promise<void> {
  await requireSession();
  const patch =
    status === "resolved"
      ? { status, resolved_at: new Date().toISOString(), resolved_by: userId, resolved_note: null, auto_resolved: false }
      : { status, resolved_at: null, resolved_by: null, resolved_note: null, auto_resolved: false };
  const { error } = await supabase.from("kw_ux_alerts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Dieselbe Prüfung wie der stündliche Job (kw-ux-alerts), sofort. */
export async function runUxAlertCheck(): Promise<UxAlertCheck> {
  await requireSession();
  const { data, error } = await supabase.rpc("kw_ux_detect_alerts");
  if (error) throw new Error(error.message);
  return data as unknown as UxAlertCheck;
}
