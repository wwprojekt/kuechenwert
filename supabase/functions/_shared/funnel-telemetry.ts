/**
 * Funnel-Telemetrie: Ereignisse und Prüfung der Batches für kw-funnel-telemetry.
 * Der Browser (src/lib/funnelTelemetry.ts) nutzt dieselbe Liste, damit kein
 * Ereignis erst auf dem Server verworfen wird.
 *
 * Gespeichert werden nur Schritt- und Feldschlüssel (z. B. "email"), nie
 * Eingaben. Metadaten sind flache, kurze Werte.
 */

export const FUNNEL_IDS = ["a", "b", "c"] as const;
export type TelemetryFunnelId = (typeof FUNNEL_IDS)[number];

export const FUNNEL_TELEMETRY_EVENTS = [
  "segmentation",
  "step_enter",
  "next_clicked",
  "back_clicked",
  "validation_failed",
  "submit_clicked",
  "submit_succeeded",
  "submit_failed",
  "field_focus",
  "field_blur_empty",
  "field_blur_filled",
  "field_change",
  "field_corrected",
  "idle",
  "tab_switch",
  "scroll_depth",
  "leave",
  "exit_intent",
  "exit_confirmed",
  "exit_cancelled",
  "help_clicked",
  "js_error",
] as const;
export type FunnelTelemetryEvent = (typeof FUNNEL_TELEMETRY_EVENTS)[number];

export const DEVICE_TYPES = ["mobile", "tablet", "desktop"] as const;
export type TelemetryDeviceType = (typeof DEVICE_TYPES)[number];

export const MAX_TELEMETRY_BATCH = 50;
export const MAX_ERROR_FIELDS = 20;
export const MAX_METADATA_KEYS = 12;
export const MAX_METADATA_STRING = 160;
/** Obergrenze für Verweildauern; alles darüber ist ein vergessener Tab. */
export const MAX_TIME_ON_STEP_MS = 24 * 60 * 60 * 1000;
export const MAX_STEP_INDEX = 40;

export const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const STEP_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const METADATA_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const CONSENT_ID_PATTERN = /^[A-Za-z0-9-]{6,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TelemetryMetadata = Record<string, string | number | boolean | null>;

export interface FunnelTelemetryRow {
  session_id: string;
  funnel: TelemetryFunnelId;
  step: string;
  step_index: number;
  event: FunnelTelemetryEvent;
  field_name: string | null;
  error_fields: string[] | null;
  time_on_step_ms: number | null;
  device_type: TelemetryDeviceType | null;
  viewport_width: number | null;
  consent_id: string | null;
  metadata: TelemetryMetadata | null;
}

export type TelemetryBatchResult =
  | { ok: true; rows: FunnelTelemetryRow[]; skipped: number }
  | { ok: false; error: string };

const EVENT_SET: ReadonlySet<string> = new Set(FUNNEL_TELEMETRY_EVENTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function isFieldKey(value: unknown): value is string {
  return typeof value === "string" && FIELD_KEY_PATTERN.test(value);
}

function fieldList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const fields = [...new Set(value.filter(isFieldKey))].slice(0, MAX_ERROR_FIELDS);
  return fields.length > 0 ? fields : null;
}

function duration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), MAX_TIME_ON_STEP_MS);
}

export function sanitizeTelemetryMetadata(value: unknown): TelemetryMetadata | null {
  if (!isRecord(value)) return null;
  const out: TelemetryMetadata = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (!METADATA_KEY_PATTERN.test(key)) continue;
    if (raw === null) out[key] = null;
    else if (typeof raw === "boolean") out[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
    else if (typeof raw === "string") out[key] = raw.slice(0, MAX_METADATA_STRING);
    else continue;
    count += 1;
  }
  return count > 0 ? out : null;
}

/** Prüft einen Batch aus dem Browser; ungültige Einzelereignisse werden übersprungen. */
export function parseTelemetryBatch(body: unknown): TelemetryBatchResult {
  if (!isRecord(body)) return { ok: false, error: "Ungültige Anfrage." };
  const sessionId = body.session_id;
  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) return { ok: false, error: "Ungültige Sitzung." };
  const funnel = body.funnel;
  if (!includes(FUNNEL_IDS, funnel)) return { ok: false, error: "Unbekannter Funnel." };
  const events = body.events;
  if (!Array.isArray(events)) return { ok: false, error: "Keine Ereignisse." };
  if (events.length > MAX_TELEMETRY_BATCH) return { ok: false, error: `Höchstens ${MAX_TELEMETRY_BATCH} Ereignisse pro Anfrage.` };

  const deviceType = includes(DEVICE_TYPES, body.device_type) ? body.device_type : null;
  const width = body.viewport_width;
  const viewportWidth = typeof width === "number" && Number.isFinite(width) && width > 0 && width < 10_000 ? Math.round(width) : null;
  const consentId = typeof body.consent_id === "string" && CONSENT_ID_PATTERN.test(body.consent_id) ? body.consent_id : null;

  const rows: FunnelTelemetryRow[] = [];
  for (const raw of events) {
    if (!isRecord(raw)) continue;
    const { event, step, step_index: stepIndex } = raw;
    if (typeof event !== "string" || !EVENT_SET.has(event)) continue;
    if (typeof step !== "string" || !STEP_KEY_PATTERN.test(step)) continue;
    if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > MAX_STEP_INDEX) continue;
    rows.push({
      session_id: sessionId.toLowerCase(),
      funnel,
      step,
      step_index: stepIndex,
      event: event as FunnelTelemetryEvent,
      field_name: isFieldKey(raw.field_name) ? raw.field_name : null,
      error_fields: fieldList(raw.error_fields),
      time_on_step_ms: duration(raw.time_on_step_ms),
      device_type: deviceType,
      viewport_width: viewportWidth,
      consent_id: consentId,
      metadata: sanitizeTelemetryMetadata(raw.metadata),
    });
  }
  return { ok: true, rows, skipped: events.length - rows.length };
}
