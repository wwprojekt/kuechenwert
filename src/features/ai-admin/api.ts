import { ApiError } from "@/features/marketplace/api-client";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";

/** Einzeilige Tabelle kw_ai_settings (id = true); Wertebereiche sichern CHECK-Constraints. */
export type AiSettingsRow = Tables<"kw_ai_settings">;
export type AiSettingsUpdate = Pick<
  AiSettingsRow,
  | "edit_model"
  | "text_model"
  | "variant_model"
  | "fallback_edit_model"
  | "fallback_edit_model_2"
  | "fallback_text_model"
  | "challenger_edit_model"
  | "challenger_share"
  | "lora_url"
  | "lora_scale"
  | "daily_render_cap"
>;

async function requireSession() {
  if (!(await ensureValidRLSSession())) throw new ApiError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401);
}

export async function fetchAiSettings(): Promise<AiSettingsRow> {
  await requireSession();
  const { data, error } = await supabase.from("kw_ai_settings").select("*").eq("id", true).single();
  if (error) throw new ApiError(error.message, 409, error.code);
  return { ...data, lora_scale: Number(data.lora_scale) };
}

export async function saveAiSettings(update: AiSettingsUpdate): Promise<void> {
  await requireSession();
  const { error } = await supabase.from("kw_ai_settings").update(update).eq("id", true);
  if (error) {
    throw new ApiError(
      error.code === "23514"
        ? "Ein Wert liegt außerhalb des erlaubten Bereichs."
        : error.code === "42501"
          ? "Nur Admins dürfen die KI-Einstellungen ändern."
          : error.message,
      409,
      error.code,
    );
  }
}

export interface AiModelStats {
  model: string;
  mode: "edit" | "text";
  /** Als erstes Modell gestartet. */
  started: number;
  first_try_success: number;
  /** Auf das Ausweichmodell gewechselt. */
  fell_back: number;
  failed: number;
  /** Fertige Bilder dieses Modells (auch als Ausweichmodell). */
  images: number;
  as_fallback: number;
  variants: number;
  avg_ms: number | null;
  p50_ms: number | null;
  p90_ms: number | null;
  cost_cents: number;
  thumbs_up: number;
  thumbs_down: number;
  /** Gründe bei „Gefällt mir nicht“ (render-feedback.ts) mit Anzahl. */
  reasons: Record<string, number>;
}

/** A/B-Gruppe über die Bilder mit Foto; Erfolg, Ausweichen und Bewertung nur der Erstbilder. */
export interface AiGroupStats {
  group: "control" | "challenger";
  sessions: number;
  leads: number;
  renders: number;
  first_renders: number;
  success: number;
  fell_back: number;
  variants: number;
  thumbs_up: number;
  thumbs_down: number;
  cost_cents: number;
}

export interface AiStats {
  days: number;
  since: string;
  /** open: Bilder ungeprüfter Besucher, die sich höchstens open_cap teilen. */
  today: { renders: number; cap: number; open: number; open_cap: number };
  models: AiModelStats[];
  groups: AiGroupStats[];
  reasons: Record<string, number>;
  funnel: {
    sessions: number;
    with_render: number;
    with_photo_render: number;
    leads: number;
    ai_training_consents: number;
    cost_cents: number;
  };
  training: { samples: number; sessions: number };
}

export async function fetchAiStats(days: number): Promise<AiStats> {
  await requireSession();
  const { data, error } = await supabase.rpc("kw_admin_ai_stats", { p_days: days });
  if (error) throw new ApiError(error.message, 409, error.code);
  return data as unknown as AiStats;
}

export interface CalibrationRow {
  segment: string;
  factor: number;
  sample_count: number;
  observed_ratio: number | null;
  updated_at: string;
}

export async function fetchCalibration(): Promise<CalibrationRow[]> {
  const { data, error } = await supabase
    .from("kitchen_price_calibration")
    .select("segment, factor, sample_count, observed_ratio, updated_at");
  if (error) throw new ApiError(error.message, 409, error.code);
  return (data ?? []).map((r) => ({
    ...r,
    factor: Number(r.factor),
    observed_ratio: r.observed_ratio === null ? null : Number(r.observed_ratio),
  }));
}

/** Marktabgleich sofort neu berechnen (sonst täglich 03:40 per Cron). */
export async function recomputeCalibration(): Promise<{ observations: number; globalFactor: number }> {
  const { data, error } = await invokeWithAuth("kw-maintenance", { body: { task: "price-calibration" } });
  if (error) throw new ApiError(error.message, 502);
  return data as { observations: number; globalFactor: number };
}
