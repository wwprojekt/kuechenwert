import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";
import { ApiError } from "./api-client";
import type { PlanReading } from "./plan-reading";

export type PlanReadingStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** Zeile aus kw_plan_readings (nur Admins lesen). */
export interface PlanReadingRow {
  lead_id: string;
  status: PlanReadingStatus;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  next_attempt_at: string | null;
  attempts: number;
  model: string | null;
  result: PlanReading | null;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

export interface PlanReadingSetup {
  /** Mistral-Schlüssel vorhanden (Edge-Secret oder Vault). */
  configured: boolean;
  enabled: boolean;
  model: string;
}

const COLUMNS = "lead_id, status, requested_at, started_at, finished_at, next_attempt_at, attempts, model, result, error_code, error_message, duration_ms";

async function requireSession() {
  if (!(await ensureValidRLSSession())) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

async function planRead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await invokeWithAuth("kw-plan-read", { body });
  if (error) {
    const info = error as Error & { httpStatus?: number; parsedBody?: unknown };
    const parsed = info.parsedBody && typeof info.parsedBody === "object" ? (info.parsedBody as Record<string, unknown>) : {};
    throw new ApiError(error.message, info.httpStatus ?? 502, typeof parsed.code === "string" ? parsed.code : undefined);
  }
  return data as T;
}

export async function fetchPlanReading(leadId: string): Promise<PlanReadingRow | null> {
  await requireSession();
  const { data, error } = await supabase.from("kw_plan_readings").select(COLUMNS).eq("lead_id", leadId).maybeSingle();
  if (error) throw new ApiError(error.message, 409, error.code);
  return (data as unknown as PlanReadingRow | null) ?? null;
}

/** Jetzt auslesen (Planung oder Angebot der Anfrage); läuft im Hintergrund, das Ergebnis kommt per Abfrage. */
export const readPlanNow = (leadId: string) =>
  planRead<{ reading: PlanReadingRow | null }>({ action: "read", lead_id: leadId }).then((r) => r.reading);

export const fetchPlanReadingSetup = () => planRead<PlanReadingSetup>({ action: "status" });

export interface PlanReadingCounts {
  done: number;
  waiting: number;
  failed: number;
}

/** Auslesungen der letzten 30 Tage nach Ergebnis. */
export async function fetchPlanReadingCounts(): Promise<PlanReadingCounts> {
  await requireSession();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase.from("kw_plan_readings").select("status").gte("requested_at", since);
  if (error) throw new ApiError(error.message, 409, error.code);
  const rows = data ?? [];
  return {
    done: rows.filter((r) => r.status === "done").length,
    waiting: rows.filter((r) => r.status === "pending" || r.status === "running").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}
