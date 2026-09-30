/**
 * Modell-Testlauf (kw-ai-lab): Testfotos und -bilder liegen privat unter
 * planner-media/ai-lab/ und werden nach LAB_RETENTION_DAYS gelöscht
 * (kw-maintenance, Task retention).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

export const LAB_BUCKET = "planner-media";
export const LAB_PHOTO_PREFIX = "ai-lab/photos/";
export const LAB_RETENTION_DAYS = 90;

export const labResultPath = (runId: string, renderId: string, ext: string) => `ai-lab/${runId}/${renderId}.${ext}`;

/** Abgelaufene Testbilder samt Fotos entfernen, die kein jüngerer Lauf mehr nutzt. */
export async function expireLabRenders(sb: SupabaseClient, limit = 200): Promise<number> {
  const cutoff = new Date(Date.now() - LAB_RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("kw_ai_lab_renders")
    .select("id, photo_path, image_path")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; photo_path: string; image_path: string | null }>;
  if (rows.length === 0) return 0;

  const photos = [...new Set(rows.map((r) => r.photo_path))];
  const { data: stillUsed, error: usedErr } = await sb
    .from("kw_ai_lab_renders")
    .select("photo_path")
    .in("photo_path", photos)
    .gte("created_at", cutoff);
  if (usedErr) throw usedErr;
  const keep = new Set((stillUsed ?? []).map((r) => r.photo_path as string));
  const files = [...rows.map((r) => r.image_path).filter((p): p is string => !!p), ...photos.filter((p) => !keep.has(p))];
  if (files.length) {
    const { error: removeErr } = await sb.storage.from(LAB_BUCKET).remove(files);
    if (removeErr) throw removeErr;
  }
  const { error: delErr } = await sb.from("kw_ai_lab_renders").delete().in("id", rows.map((r) => r.id));
  if (delErr) throw delErr;
  return rows.length;
}
