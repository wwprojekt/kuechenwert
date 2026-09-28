import { callFunction } from "@/features/marketplace/api-client";
import type { PendingLeadFile } from "./files";
import { announceFiles, uploadToTargets, type UploadTarget } from "./upload";

export interface FunnelBSubmitPayload {
  /** Formularfelder ohne Dateien (siehe FunnelBClient). */
  data: Record<string, unknown>;
  uploads: PendingLeadFile[];
  turnstileToken: string | null;
  /** Honeypot: bleibt bei Menschen leer. */
  website: string;
  submissionId: string;
  /** Nur mit Marketing-Einwilligung gesetzt. */
  clickIds: Record<string, string> | null;
  utm: Record<string, string | undefined>;
  landingPage: string | null;
  onUploadProgress?: (done: number, total: number) => void;
}

interface SubmitResult {
  ok: boolean;
  studios_in_area?: number | null;
  review_required?: boolean;
  upload_token?: string;
  uploads?: UploadTarget[];
}

export interface FunnelBSubmitOutcome {
  failedUploads: number;
  /** Aktive Studios im Umkreis der PLZ; null, wenn der Server es nicht meldet. */
  studiosInArea: number | null;
  /** Ohne gültige Bot-Prüfung gibt das Team die Anfrage erst nach Sichtung frei. */
  reviewRequired: boolean;
}

/**
 * Sendet Funnel B an kw-lead-b und lädt danach die Dateien über die
 * signierten URLs hoch. Liefert u. a. die Zahl der Dateien, die nicht ankamen.
 */
export async function submitFunnelB(payload: FunnelBSubmitPayload): Promise<FunnelBSubmitOutcome> {
  const result = await callFunction<SubmitResult>("kw-lead-b", {
    action: "submit",
    data: payload.data,
    files: announceFiles(payload.uploads),
    turnstile_token: payload.turnstileToken,
    website: payload.website,
    submission_id: payload.submissionId,
    click_ids: payload.clickIds,
    utm: payload.utm,
    landing_page: payload.landingPage,
  });

  const studiosInArea = typeof result.studios_in_area === "number" ? result.studios_in_area : null;
  const reviewRequired = result.review_required === true;
  const targets = result.uploads ?? [];
  if (!targets.length || !result.upload_token) return { failedUploads: 0, studiosInArea, reviewRequired };

  const uploaded = await uploadToTargets(payload.uploads, targets, payload.onUploadProgress);
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
  return {
    failedUploads: payload.uploads.length - Math.min(attached, uploaded.length),
    studiosInArea,
    reviewRequired,
  };
}
