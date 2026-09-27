import { callFunction } from "@/features/marketplace/api-client";
import { supabase } from "@/integrations/supabase/client";

export type FunnelBFileCategory = "angebot" | "grundriss" | "kueche_bild";

export interface FunnelBUpload {
  category: FunnelBFileCategory;
  file: File;
}

export interface FunnelBSubmitPayload {
  /** Formularfelder ohne Dateien (siehe FunnelBClient). */
  data: Record<string, unknown>;
  uploads: FunnelBUpload[];
  turnstileToken: string | null;
  /** Honeypot: bleibt bei Menschen leer. */
  website: string;
  submissionId: string;
  /** Nur mit Marketing-Einwilligung gesetzt. */
  clickIds: Record<string, string> | null;
  utm: Record<string, string | undefined>;
  landingPage: string | null;
}

interface SubmitResult {
  ok: boolean;
  upload_token?: string;
  uploads?: { index: number; path: string; token: string }[];
}

/**
 * Sendet Funnel B an kw-lead-b und lädt danach die Dateien über die
 * signierten URLs hoch. Liefert die Zahl der Dateien, die nicht ankamen.
 */
export async function submitFunnelB(payload: FunnelBSubmitPayload): Promise<{ failedUploads: number }> {
  const result = await callFunction<SubmitResult>("kw-lead-b", {
    action: "submit",
    data: payload.data,
    files: payload.uploads.map(({ category, file }) => ({
      category,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    })),
    turnstile_token: payload.turnstileToken,
    website: payload.website,
    submission_id: payload.submissionId,
    click_ids: payload.clickIds,
    utm: payload.utm,
    landing_page: payload.landingPage,
  });

  const targets = result.uploads ?? [];
  if (!targets.length || !result.upload_token) return { failedUploads: 0 };

  const uploaded: { path: string; category: FunnelBFileCategory; name: string; type: string; size: number }[] = [];
  for (const target of targets) {
    const upload = payload.uploads[target.index];
    if (!upload) continue;
    const { error } = await supabase.storage.from("lead-files").uploadToSignedUrl(target.path, target.token, upload.file, {
      contentType: upload.file.type || "application/octet-stream",
      cacheControl: "31536000, immutable",
    });
    if (error) {
      console.error("Funnel B upload failed", error);
      continue;
    }
    uploaded.push({
      path: target.path,
      category: upload.category,
      name: upload.file.name,
      type: upload.file.type,
      size: upload.file.size,
    });
  }

  let attached = 0;
  if (uploaded.length) {
    try {
      const res = await callFunction<{ attached: number }>("kw-lead-b", {
        action: "attach-files",
        upload_token: result.upload_token,
        files: uploaded,
      });
      attached = res.attached ?? 0;
    } catch (err) {
      console.error("Funnel B attach-files failed", err);
    }
  }
  return { failedUploads: payload.uploads.length - Math.min(attached, uploaded.length) };
}
