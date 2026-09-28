import { supabase } from "@/integrations/supabase/client";
import { callFunction, ApiError } from "@/features/marketplace/api-client";
import type { KitchenEstimate, PlannerConfig, RoomInput } from "./core";

export interface PlannerPhoto {
  path: string;
  url: string | null;
}

export type RenderFeedback = 1 | -1 | null;

export interface PlannerRender {
  id: string;
  version: number;
  status: "pending" | "success" | "failed";
  mode: "edit" | "text";
  variant_label: string | null;
  image_url: string | null;
  error?: string | null;
  feedback?: RenderFeedback;
  /** Variante: Visualisierung, auf der sie aufbaut. */
  base_render_id?: string | null;
  /** Planung (plannerRenderKey), aus der die Visualisierung entstand. */
  config_key?: string | null;
}

/** Render, wie ihn kw-planner/session liefert (Planung statt fertigem Schlüssel). */
export interface PlannerSessionRender extends Omit<PlannerRender, "config_key"> {
  spec?: { config: Partial<PlannerConfig> | null; room: Partial<RoomInput> | null; photo_path: string | null } | null;
}

export interface PlannerSessionState {
  session_token: string;
  submitted: boolean;
  config: Partial<PlannerConfig>;
  room: Partial<RoomInput>;
  estimate: KitchenEstimate | null;
  photos: PlannerPhoto[];
  renders: PlannerSessionRender[];
}

export interface GenerateResult {
  session_token: string;
  render_id: string;
  version: number;
  mode: "edit" | "text";
  base_render_id?: string | null;
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
  consents: { share_with_studios: boolean; contact_by_phone: boolean; marketing: boolean; ai_training: boolean };
  /** Gewählte Visualisierung: Titelbild für die Studios. */
  active_render_id: string | null;
  timeframe_months: number | null;
  housing_type: "own" | "rent" | "unknown";
  turnstile_token: string | null;
  website?: string;
  landing_page?: string;
  /** Nur mit Marketing-Einwilligung gesetzt. */
  click_ids?: Record<string, string> | null;
}

export interface SubmitResult {
  ok: true;
  lead_id: string;
  /** Die Planung war schon abgeschickt: nicht erneut als Conversion zählen. */
  already_submitted?: boolean;
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

const PHOTO_UNREADABLE = "Dieses Foto können wir nicht verarbeiten. Bitte ein Foto im Format JPG, PNG oder WebP wählen.";

/**
 * Verkleinert Fotos im Browser auf max. 2048 px und kodiert sie immer neu als
 * JPEG: schneller Upload, gleiche Qualität für die KI und keine eingebetteten
 * Metadaten wie GPS-Position (der Server entfernt sie zusätzlich).
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new ApiError("Bitte ein Foto im Format JPG, PNG oder WebP wählen.", 415);
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new ApiError(PHOTO_UNREADABLE, 415);
  const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ApiError(PHOTO_UNREADABLE, 415);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new ApiError(PHOTO_UNREADABLE, 415);
  return blob;
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
  /** Mit variantHint: diese fertige Visualisierung gezielt ändern statt neu zu planen. */
  baseRenderId?: string | null;
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
    base_render_id: input.baseRenderId ?? null,
    utm: input.utm,
  });
}

export function sendRenderFeedback(sessionToken: string, renderId: string, value: RenderFeedback) {
  return callFunction<{ ok: true; feedback: RenderFeedback }>(FN, {
    action: "feedback",
    session_token: sessionToken,
    render_id: renderId,
    value,
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
