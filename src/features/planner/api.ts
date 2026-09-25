import { supabase } from "@/integrations/supabase/client";
import { callFunction, ApiError } from "@/features/marketplace/api-client";
import type { KitchenEstimate, PlannerConfig, RoomInput } from "./core";

export interface PlannerPhoto {
  path: string;
  url: string | null;
}

export interface PlannerRender {
  id: string;
  version: number;
  status: "pending" | "success" | "failed";
  mode: "edit" | "text";
  variant_label: string | null;
  image_url: string | null;
  error?: string | null;
}

export interface PlannerSessionState {
  session_token: string;
  submitted: boolean;
  config: Partial<PlannerConfig>;
  room: Partial<RoomInput>;
  estimate: KitchenEstimate | null;
  photos: PlannerPhoto[];
  renders: PlannerRender[];
}

export interface GenerateResult {
  session_token: string;
  render_id: string;
  version: number;
  mode: "edit" | "text";
  estimate: KitchenEstimate;
}

export interface RenderStatus {
  status: "pending" | "success" | "failed";
  render_id: string;
  version?: number;
  image_url?: string | null;
  error?: string;
}

export interface SubmitPayload {
  session_token: string;
  contact: { first_name: string; last_name: string; email: string; phone: string; postal_code: string; city?: string };
  consents: { share_with_studios: boolean; contact_by_phone: boolean; marketing: boolean };
  timeframe_months: number | null;
  housing_type: "own" | "rent" | "unknown";
  turnstile_token: string | null;
  website?: string;
  landing_page?: string;
}

export interface SubmitResult {
  ok: true;
  lead_id: string;
  tender_status: string | null;
  project_token: string;
  project_url: string;
  estimate: { min: number; max: number; mid: number };
}

const FN = "kw-planner";
const MAX_UPLOAD_EDGE = 2048;

export function loadSession(sessionToken: string) {
  return callFunction<{ session: PlannerSessionState | null }>(FN, { action: "session", session_token: sessionToken });
}

/**
 * Verkleinert Fotos im Browser auf max. 2048 px (JPEG), bevor sie hochgeladen
 * werden: schneller Upload und identische Qualität für die KI.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new ApiError("Bitte ein Foto im Format JPG, PNG oder WebP wählen.", 415);
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg" && file.size < 4 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return blob ?? file;
}

export async function uploadPhoto(sessionToken: string | null, file: File, utm?: Record<string, string>) {
  const blob = await preparePhoto(file);
  const target = await callFunction<{ session_token: string; path: string; token: string }>(FN, {
    action: "upload-url",
    session_token: sessionToken,
    content_type: blob.type || "image/jpeg",
    size: blob.size,
    utm,
  });
  const { error } = await supabase.storage.from("planner-media").uploadToSignedUrl(target.path, target.token, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000, immutable",
  });
  if (error) throw new ApiError("Das Foto konnte nicht hochgeladen werden. Bitte erneut versuchen.");
  const attached = await callFunction<{ photos: PlannerPhoto[] }>(FN, {
    action: "attach-photo",
    session_token: target.session_token,
    path: target.path,
  });
  return { sessionToken: target.session_token, path: target.path, photos: attached.photos };
}

export function removePhoto(sessionToken: string, path: string) {
  return callFunction<{ photos: PlannerPhoto[] }>(FN, { action: "remove-photo", session_token: sessionToken, path });
}

export function generateRender(input: {
  sessionToken: string | null;
  config: PlannerConfig;
  room: RoomInput;
  photoPath: string | null;
  postalCode?: string | null;
  variantHint?: string | null;
  variantLabel?: string | null;
  utm?: Record<string, string>;
}) {
  return callFunction<GenerateResult>(FN, {
    action: "generate",
    session_token: input.sessionToken,
    config: input.config,
    room: input.room,
    photo_path: input.photoPath,
    postal_code: input.postalCode ?? null,
    variant_hint: input.variantHint ?? null,
    variant_label: input.variantLabel ?? null,
    utm: input.utm,
  });
}

export function savePlanning(input: {
  sessionToken: string | null;
  config: PlannerConfig;
  room: RoomInput;
  postalCode?: string | null;
  utm?: Record<string, string>;
}) {
  return callFunction<{ session_token: string; estimate: KitchenEstimate }>(FN, {
    action: "save",
    session_token: input.sessionToken,
    config: input.config,
    room: input.room,
    postal_code: input.postalCode ?? null,
    utm: input.utm,
  });
}

export function renderStatus(sessionToken: string, renderId: string) {
  return callFunction<RenderStatus>(FN, { action: "status", session_token: sessionToken, render_id: renderId });
}

export function submitProject(payload: SubmitPayload) {
  return callFunction<SubmitResult>(FN, { action: "submit", ...payload });
}
