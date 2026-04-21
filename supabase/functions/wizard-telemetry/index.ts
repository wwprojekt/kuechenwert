// =====================================================================
// Edge Function: wizard-telemetry
// =====================================================================
//
// Zweck: Nimmt batched Telemetry-Events vom Verkaufswizard entgegen und
// schreibt sie in public.wizard_step_events. Public unprotected (der
// Wizard laeuft anonym), geschuetzt durch:
//  - Rate-Limiting per IP (60 Requests / Minute, grosszuegig da Batches)
//  - session_id MUSS in wizard_sessions existieren
//  - Whitelist auf event-Namen (Input-Validierung)
//  - max 50 Events pro Request, max 1 KB pro field_name
//  - field_name gegen Regex [a-zA-Z0-9_]{1,64}
//
// Datenschutz:
//  - Keine PII im Body (wir tracken nur Feld-SCHLUESSEL, keine Werte).
//  - Kein IP-Logging in der DB. Nur fuers Rate-Limit gebraucht.
//
// Aufruf:
//  - POST /functions/v1/wizard-telemetry
//  - Content-Type: application/json  (oder text/plain bei sendBeacon)
//  - Body: { session_id, events: [...], viewport_width?, device_type? }
//
// Hinweis zu sendBeacon: Browser duerfen bei navigator.sendBeacon die
// Content-Type NICHT frei setzen. Wir akzeptieren darum auch
// text/plain und versuchen, den Body als JSON zu parsen.
// =====================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, createRateLimitErrorResponse } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 60 Requests / Minute pro IP. Wizard-Hooks batchen alle 2 s — bei einem
// "normalen" Funnel entsteht selten mehr als 1 Request/2 s, also viel
// Puffer fuer Resume-User.
const TELEMETRY_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

const ALLOWED_EVENTS = new Set([
  "step_enter",
  "next_clicked",
  "validation_failed",
  "back_clicked",
  "submit_clicked",
  "submit_succeeded",
  "submit_failed",
  "leave",
  "field_focus",
  "field_blur_empty",
  "field_blur_filled",
  "field_change",
]);

const ALLOWED_DEVICE_TYPES = new Set(["mobile", "tablet", "desktop"]);

const MAX_BATCH = 50;
const FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

interface TelemetryEvent {
  step: number;
  event: string;
  field_name?: string | null;
  error_fields?: string[] | null;
  time_on_step_ms?: number | null;
  metadata?: Record<string, unknown> | null;
  // client timestamp (nicht in DB geschrieben, nur fuer spaetere Sort-Referenz)
  ts?: number;
}

interface TelemetryRequest {
  session_id?: string;
  viewport_width?: number;
  device_type?: string;
  events?: TelemetryEvent[];
}

function sanitizeFieldName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  if (!FIELD_NAME_REGEX.test(name)) return null;
  return name;
}

function sanitizeErrorFields(fields: unknown): string[] | null {
  if (!Array.isArray(fields)) return null;
  const out: string[] = [];
  for (const f of fields) {
    const clean = sanitizeFieldName(f);
    if (clean) out.push(clean);
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : null;
}

function sanitizeMetadata(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const entries = Object.entries(meta as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of entries) {
    if (count >= 10) break;
    if (typeof k !== "string" || k.length > 32) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      if (typeof v === "string" && v.length > 128) continue;
      out[k] = v;
      count++;
    }
  }
  return count > 0 ? out : null;
}

async function parseBody(req: Request): Promise<TelemetryRequest | null> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return (await req.json()) as TelemetryRequest;
    }
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as TelemetryRequest;
  } catch {
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate-Limit — failing open on errors, grosszuegiger Limit fuer Batches.
  const rate = await checkRateLimit(req, TELEMETRY_RATE_LIMIT);
  if (!rate.allowed) {
    return createRateLimitErrorResponse(rate, corsHeaders);
  }

  const body = await parseBody(req);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!UUID_REGEX.test(sessionId)) {
    return new Response(JSON.stringify({ error: "Invalid session_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) {
    return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (events.length > MAX_BATCH) {
    return new Response(
      JSON.stringify({ error: `Too many events (max ${MAX_BATCH})` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Viewport/Device einmal pro Batch. Wir schreiben sie in jede Row,
  // damit Funnel-Queries ohne Self-Joins laufen.
  let viewportWidth: number | null = null;
  if (typeof body.viewport_width === "number" && body.viewport_width > 0 && body.viewport_width < 30000) {
    viewportWidth = Math.round(body.viewport_width);
  }
  const deviceType = typeof body.device_type === "string" && ALLOWED_DEVICE_TYPES.has(body.device_type)
    ? body.device_type
    : null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Defense in depth: session_id muss existieren — verhindert, dass ein
  // Angreifer beliebige UUIDs sendet und die Tabelle mit Muell beschreibt.
  const { data: sessionRow, error: sessionErr } = await supabase
    .from("wizard_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) {
    console.error("wizard-telemetry: session lookup failed", sessionErr);
    return new Response(JSON.stringify({ error: "Session lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!sessionRow) {
    return new Response(JSON.stringify({ error: "Unknown session" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const step = typeof ev.step === "number" ? Math.floor(ev.step) : NaN;
    if (!Number.isFinite(step) || step < 0 || step > 10) continue;
    if (typeof ev.event !== "string" || !ALLOWED_EVENTS.has(ev.event)) continue;

    const timeOnStep = typeof ev.time_on_step_ms === "number" && ev.time_on_step_ms >= 0
      ? Math.min(Math.floor(ev.time_on_step_ms), 2_147_483_647)
      : null;

    rows.push({
      session_id: sessionId,
      step,
      event: ev.event,
      field_name: sanitizeFieldName(ev.field_name),
      error_fields: sanitizeErrorFields(ev.error_fields),
      viewport_width: viewportWidth,
      device_type: deviceType,
      time_on_step_ms: timeOnStep,
      metadata: sanitizeMetadata(ev.metadata),
    });
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, inserted: 0, skipped: events.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insertErr } = await supabase
    .from("wizard_step_events")
    .insert(rows);

  if (insertErr) {
    console.error("wizard-telemetry: insert failed", insertErr);
    return new Response(JSON.stringify({ error: "Insert failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, inserted: rows.length, skipped: events.length - rows.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
