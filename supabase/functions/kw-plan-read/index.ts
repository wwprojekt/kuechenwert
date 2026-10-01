/**
 * kw-plan-read — liest hochgeladene Planungen und Angebote aus Funnel B mit
 * einem KI-Modell aus (Mistral AI, EU-Endpunkt, _shared/mistral.ts) und legt
 * das Ergebnis als Vorschlag fürs Briefing des Experten-Checks ab
 * (kw_plan_readings). Studios sehen davon nichts, bis das Team den Vorschlag
 * ins Briefing übernimmt und speichert.
 *
 * Aktionen (POST { action, ... }); Admin, Service-Role oder Cron-Geheimnis:
 *   sweep   nächste wartende Auslesung (Cron kw-plan-reading, jede Minute nur
 *           bei Bedarf); antwortet sofort, liest im Hintergrund
 *   read    { lead_id }: jetzt auslesen und das Ergebnis zurückgeben (Admin)
 *   status  Schlüssel vorhanden, eingeschaltet, Modell
 *
 * Neue Unterlagen stellt der Trigger auf lead_files in die Warteschlange.
 * Ohne Schlüssel warten Auslesungen und werden alle 6 Stunden erneut
 * versucht; Störungen bei Mistral nach 5, 30 und 120 Minuten, dann
 * „fehlgeschlagen“. Namen und Kontaktdaten von den Unterlagen landen nicht
 * im Ergebnis (_shared/plan-reading.ts).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { checkCronOrServiceRoleOrAdmin } from "../_shared/auth.ts";
import { HttpError, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";
import { MistralError, mistralApiKey, mistralChatJson } from "../_shared/mistral.ts";
import {
  PLAN_READING_CATEGORIES,
  PLAN_READING_MAX_FILES,
  PLAN_READING_MODELS,
  PLAN_READING_TYPES,
  buildPlanReadingRequest,
  isRedactedCopy,
  normalizePlanReading,
  planReadingModel,
} from "../_shared/plan-reading.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const BUCKET = "lead-files";
const SIGNED_URL_TTL = 600;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const RETRY_MINUTES = [5, 30, 120];
const NOT_CONFIGURED_RETRY_MINUTES = 360;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const READING_COLUMNS =
  "lead_id, status, requested_at, started_at, finished_at, attempts, model, file_ids, result, error_code, error_message, duration_ms";

interface ReadingRow {
  lead_id: string;
  status: string;
  attempts: number;
  started_at: string | null;
  requested_at: string;
}

interface Settings {
  enabled: boolean;
  model: string;
}

type Outcome =
  | { status: "done"; patch: Record<string, unknown> }
  | { status: "failed" | "skipped"; code: string; message: string }
  | { status: "retry"; code: string; message: string; minutes: number };

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function loadSettings(sb: SupabaseClient): Promise<Settings> {
  const { data, error } = await sb.from("kw_ai_settings").select("plan_reading_enabled, plan_reading_model").eq("id", true).maybeSingle();
  if (error) throw error;
  return { enabled: data?.plan_reading_enabled !== false, model: planReadingModel(data?.plan_reading_model) };
}

/** Planung und Angebote, die das Modell lesen kann; geschwärzte Kopien nur, wenn es keine Originale gibt. */
async function readableFiles(sb: SupabaseClient, leadId: string) {
  const { data, error } = await sb
    .from("lead_files")
    .select("id, file_url, file_name, file_type, file_size_bytes")
    .eq("lead_id", leadId)
    .in("category", [...PLAN_READING_CATEGORIES])
    .order("created_at");
  if (error) throw error;
  const readable = (data ?? []).filter((f) => PLAN_READING_TYPES[f.file_type ?? ""] && (f.file_size_bytes ?? 0) <= MAX_FILE_BYTES);
  const originals = readable.filter((f) => !isRedactedCopy(f.file_name));
  return (originals.length > 0 ? originals : readable).slice(0, PLAN_READING_MAX_FILES);
}

async function readPlanning(sb: SupabaseClient, leadId: string, settings: Settings, apiKey: string | null): Promise<Outcome> {
  const { data: lead, error } = await sb.from("leads").select("funnel_type, anonymized_at").eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!lead || lead.funnel_type !== "b" || lead.anonymized_at) {
    return { status: "skipped", code: "not_applicable", message: "Keine Funnel-B-Anfrage oder Daten gelöscht." };
  }
  if (!settings.enabled) return { status: "skipped", code: "disabled", message: "Auslesen ist unter „KI & Preis-Engine“ ausgeschaltet." };
  if (!apiKey) {
    return { status: "retry", code: "not_configured", message: "Mistral-Schlüssel fehlt (Vault: mistral_api_key).", minutes: NOT_CONFIGURED_RETRY_MINUTES };
  }

  const files = await readableFiles(sb, leadId);
  if (files.length === 0) {
    return { status: "skipped", code: "no_readable_files", message: "Keine lesbare Planung (PDF, JPG, PNG oder WebP bis 20 MB)." };
  }
  const signed = await Promise.all(files.map((f) => sb.storage.from(BUCKET).createSignedUrl(f.file_url, SIGNED_URL_TTL)));
  const parts = files.flatMap((f, i) => {
    const url = signed[i]?.data?.signedUrl;
    const kind = PLAN_READING_TYPES[f.file_type ?? ""];
    return url && kind ? [{ kind, url }] : [];
  });
  if (parts.length === 0) return { status: "retry", code: "storage", message: "Dateien im Speicher nicht abrufbar.", minutes: RETRY_MINUTES[0]! };

  const startedAt = Date.now();
  const response = await mistralChatJson(apiKey, buildPlanReadingRequest(settings.model, parts));
  return {
    status: "done",
    patch: {
      result: normalizePlanReading(response.content),
      model: settings.model,
      file_ids: files.map((f) => f.id),
      duration_ms: Date.now() - startedAt,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
    },
  };
}

function errorOutcome(err: unknown, attempts: number): Outcome {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
  if (err instanceof MistralError && (err.status === 401 || err.status === 403)) {
    return { status: "retry", code: "not_configured", message: `${message} – Schlüssel prüfen.`, minutes: NOT_CONFIGURED_RETRY_MINUTES };
  }
  const retryable = !(err instanceof MistralError) || err.retryable;
  if (retryable && attempts < RETRY_MINUTES.length + 1) {
    return { status: "retry", code: err instanceof MistralError ? "provider" : "internal", message, minutes: RETRY_MINUTES[attempts - 1] ?? 120 };
  }
  return { status: "failed", code: err instanceof MistralError ? "provider" : "internal", message };
}

/**
 * Ergebnis festhalten, solange die Auslesung noch diesem Lauf gehört. Kam
 * währenddessen eine neue Datei (requested_at nach dem Start), wartet sie
 * gleich wieder, damit alle Unterlagen gelesen werden.
 */
async function finish(sb: SupabaseClient, row: ReadingRow, outcome: Outcome): Promise<void> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> =
    outcome.status === "done"
      ? { ...outcome.patch, status: "done", error_code: null, error_message: null, next_attempt_at: null, finished_at: now }
      : outcome.status === "retry"
        ? {
            status: "pending",
            error_code: outcome.code,
            error_message: outcome.message,
            next_attempt_at: minutesFromNow(outcome.minutes),
            // Warten auf den Schlüssel zählt nicht als Fehlversuch.
            ...(outcome.code === "not_configured" ? { attempts: 0 } : {}),
          }
        : { status: outcome.status, error_code: outcome.code, error_message: outcome.message, next_attempt_at: null, finished_at: now };
  if (outcome.status === "done") {
    const { data: current } = await sb.from("kw_plan_readings").select("requested_at").eq("lead_id", row.lead_id).maybeSingle();
    if (current && row.started_at && new Date(current.requested_at).getTime() > new Date(row.started_at).getTime()) {
      update.status = "pending";
      update.attempts = 0;
    }
  }
  let query = sb.from("kw_plan_readings").update(update).eq("lead_id", row.lead_id).eq("status", "running");
  if (row.started_at) query = query.eq("started_at", row.started_at);
  const { error } = await query;
  if (error) console.error("[kw-plan-read] finish failed", row.lead_id, error.message);
}

async function process(sb: SupabaseClient, row: ReadingRow, settings: Settings, apiKey: string | null): Promise<Outcome> {
  let outcome: Outcome;
  try {
    outcome = await readPlanning(sb, row.lead_id, settings, apiKey);
  } catch (err) {
    console.error("[kw-plan-read] reading failed", row.lead_id, err instanceof Error ? err.message : err);
    outcome = errorOutcome(err, row.attempts);
  }
  await finish(sb, row, outcome);
  return outcome;
}

function inBackground(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else void work;
}

async function actionSweep(req: Request, sb: SupabaseClient) {
  const { data, error } = await sb.rpc("kw_plan_readings_claim", { p_limit: 1 });
  if (error) throw error;
  const rows = (data ?? []) as ReadingRow[];
  if (rows.length === 0) return jsonResponse(req, { claimed: 0 });
  const settings = await loadSettings(sb);
  const apiKey = await mistralApiKey(sb);
  inBackground(Promise.all(rows.map((row) => process(sb, row, settings, apiKey))));
  return jsonResponse(req, { claimed: rows.length }, 202);
}

async function actionRead(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const leadId = String(body.lead_id ?? "");
  if (!UUID_RE.test(leadId)) throw new HttpError(400, "Ungültige Anfrage-ID.", "invalid_lead");
  const { data: lead, error: leadError } = await sb.from("leads").select("funnel_type, anonymized_at").eq("id", leadId).maybeSingle();
  if (leadError) throw leadError;
  if (!lead || lead.funnel_type !== "b" || lead.anonymized_at) {
    throw new HttpError(422, "Auslesen lassen sich nur Funnel-B-Anfragen, deren Daten nicht gelöscht sind.", "not_applicable");
  }
  const settings = await loadSettings(sb);
  if (!settings.enabled) throw new HttpError(409, "Das Auslesen von Planungen ist unter „KI & Preis-Engine“ ausgeschaltet.", "disabled");
  const apiKey = await mistralApiKey(sb);
  if (!apiKey) throw new HttpError(409, "Mistral AI ist noch nicht eingerichtet: Schlüssel „mistral_api_key“ im Supabase Vault fehlt.", "not_configured");
  const { data, error } = await sb.rpc("kw_plan_reading_start", { p_lead_id: leadId });
  if (error) throw error;
  const row = ((data ?? []) as ReadingRow[])[0];
  if (!row) throw new HttpError(409, "Die Unterlagen werden gerade ausgelesen. Bitte gleich noch einmal nachsehen.", "running");
  const outcome = await process(sb, row, settings, apiKey);
  if (outcome.status === "skipped" && outcome.code === "no_readable_files") throw new HttpError(422, outcome.message, outcome.code);
  const { data: reading } = await sb.from("kw_plan_readings").select(READING_COLUMNS).eq("lead_id", leadId).maybeSingle();
  return jsonResponse(req, { reading });
}

async function actionStatus(req: Request, sb: SupabaseClient) {
  const settings = await loadSettings(sb);
  const apiKey = await mistralApiKey(sb);
  return jsonResponse(req, { configured: !!apiKey, enabled: settings.enabled, model: settings.model, models: PLAN_READING_MODELS });
}

serve(async (req) => {
  const auth = await checkCronOrServiceRoleOrAdmin(req);
  if (!auth.authorized) throw new HttpError(401, "Nicht autorisiert.", "unauthorized");
  const body = await readJson(req);
  const sb = serviceClient();
  switch (body.action) {
    case "sweep":
      return actionSweep(req, sb);
    case "read":
      return actionRead(req, sb, body);
    case "status":
      return actionStatus(req, sb);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
