/**
 * Trainingsdaten für die KI-Visualisierung – nur mit Einwilligung
 * (lead_consents purpose "ai_training").
 *
 * Kopiert die Raumfotos einer Planung ohne Kontaktdaten in den privaten
 * Bucket ai-training (kw_ai_training_samples, höchstens 36 Monate). Gespeichert
 * werden nur Kundenfotos, Planung und Bewertungen, keine KI-Bilder: Eigene
 * Modelle sollen aus echten Räumen lernen, nicht aus den Ausgaben fremder
 * Modelle. Widerruf und Löschung entfernen Dateien vor den Zeilen.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

export const TRAINING_BUCKET = "ai-training";
const PLANNER_BUCKET = "planner-media";

const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function storeTrainingSamples(
  sb: SupabaseClient,
  input: {
    sessionId: string;
    leadId: string;
    photoPaths: string[];
    config: object;
    room: object;
    consentTextVersion: string;
  },
): Promise<number> {
  const { data: existing } = await sb.from("kw_ai_training_samples").select("id").eq("planner_session_id", input.sessionId).limit(1);
  if (existing?.length) return 0;

  const { data: renders } = await sb
    .from("planner_renders")
    .select("model_slug, fallback_from, mode, feedback, base_render_id, variant_label")
    .eq("session_id", input.sessionId)
    .eq("status", "success")
    .order("version", { ascending: true });
  const renderFeedback = (renders ?? []).map((r) => ({
    model: r.model_slug,
    mode: r.mode,
    variant: r.base_render_id ? (r.variant_label ?? true) : null,
    fallback_from: r.fallback_from ?? null,
    feedback: r.feedback ?? null,
  }));
  // Freitexte können Namen oder Adressen enthalten.
  const config = { ...input.config, wishes: null };
  const room = { ...input.room, notes: null };

  let stored = 0;
  for (const photoPath of input.photoPaths) {
    const ext = (photoPath.split(".").pop() ?? "").toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) continue;
    const id = crypto.randomUUID();
    const target = `${id}.${ext === "jpeg" ? "jpg" : ext}`;
    try {
      const { data: blob, error } = await sb.storage.from(PLANNER_BUCKET).download(photoPath);
      if (error || !blob) throw error ?? new Error("download failed");
      const { error: upErr } = await sb.storage.from(TRAINING_BUCKET).upload(target, blob, {
        contentType,
        cacheControl: "31536000, immutable",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await sb.from("kw_ai_training_samples").insert({
        id,
        lead_id: input.leadId,
        planner_session_id: input.sessionId,
        photo_path: target,
        config,
        room,
        render_feedback: renderFeedback,
        consent_text_version: input.consentTextVersion,
      });
      if (insErr) {
        await sb.storage.from(TRAINING_BUCKET).remove([target]);
        throw insErr;
      }
      stored++;
    } catch (err) {
      console.error("[ai-training] Foto nicht übernommen", err instanceof Error ? err.message : err);
    }
  }
  return stored;
}

async function removeSamples(sb: SupabaseClient, rows: Array<{ id: string; photo_path: string }>): Promise<number> {
  if (rows.length === 0) return 0;
  const { error: removeErr } = await sb.storage.from(TRAINING_BUCKET).remove(rows.map((r) => r.photo_path));
  if (removeErr) throw removeErr;
  const { error } = await sb.from("kw_ai_training_samples").delete().in("id", rows.map((r) => r.id));
  if (error) throw error;
  return rows.length;
}

/** Widerruf oder Löschwunsch: alle Trainingskopien einer Anfrage entfernen. */
export async function forgetTrainingSamples(sb: SupabaseClient, leadId: string): Promise<number> {
  const { data, error } = await sb.from("kw_ai_training_samples").select("id, photo_path").eq("lead_id", leadId);
  if (error) throw error;
  return removeSamples(sb, (data ?? []) as Array<{ id: string; photo_path: string }>);
}

/** Abgelaufene Trainingskopien (expires_at) löschen, höchstens limit je Lauf. */
export async function expireTrainingSamples(sb: SupabaseClient, limit = 200): Promise<number> {
  const { data, error } = await sb
    .from("kw_ai_training_samples")
    .select("id, photo_path")
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return removeSamples(sb, (data ?? []) as Array<{ id: string; photo_path: string }>);
}
