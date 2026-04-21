/**
 * Client-side telemetry helper for the sales wizard.
 *
 * Implements a lightweight event buffer that flushes to the
 * `wizard-telemetry` Edge Function in batches (every 2s or at
 * buffer-full). On page hide / tab close we use `navigator.sendBeacon`
 * so in-flight events do not get dropped when the user abandons the
 * tab — which is the exact moment we care most about in the funnel.
 *
 * Privacy:
 *   - No PII in event payloads. We only track field KEYS (e.g. "mileage"),
 *     never values.
 *   - Legal basis: Art. 6(1)(f) DSGVO (legitimate interest: product
 *     analytics for drop-off reduction). No cross-device tracking, no
 *     advertising use. Data retention 90 days (pg_cron cleanup job).
 *
 * This module is a plain singleton — one buffer per tab — so multiple
 * components can call `logWizardEvent` without coordinating state.
 */

import { logger } from "@/lib/logger";

export type WizardTelemetryEvent =
  | "step_enter"
  | "next_clicked"
  | "validation_failed"
  | "back_clicked"
  | "submit_clicked"
  | "submit_succeeded"
  | "submit_failed"
  | "leave"
  | "field_focus"
  | "field_blur_empty"
  | "field_blur_filled"
  | "field_change";

export interface WizardEventPayload {
  step: number;
  event: WizardTelemetryEvent;
  field_name?: string | null;
  error_fields?: string[] | null;
  time_on_step_ms?: number | null;
  metadata?: Record<string, unknown> | null;
  ts?: number;
}

interface BatchPayload {
  session_id: string;
  viewport_width: number;
  device_type: "mobile" | "tablet" | "desktop";
  events: WizardEventPayload[];
}

// Buffer limits. We flush eagerly on large buffers so we never keep
// more than ~20 events in memory (roughly 5 field focuses + 10 blurs).
const MAX_BUFFER = 20;
const MAX_BATCH = 50;
const FLUSH_INTERVAL_MS = 2000;

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://zcrwqxsyptjwkuxfacvq.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/wizard-telemetry`;

let buffer: WizardEventPayload[] = [];
let currentSessionId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let disabled = false;

function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function viewportWidth(): number {
  if (typeof window === "undefined") return 0;
  return window.innerWidth || 0;
}

export function setWizardTelemetrySession(sessionId: string | null): void {
  currentSessionId = sessionId;
  // Flush anything buffered against the previous session before it
  // gets mis-attributed.
  if (!sessionId && buffer.length > 0) {
    buffer = [];
  }
}

export function isWizardTelemetryEnabled(): boolean {
  return !disabled && !!currentSessionId && !!SUPABASE_ANON_KEY;
}

/**
 * Queue a wizard event. Safe to call with no session — the event is
 * simply dropped.
 *
 * Never throws. Errors are swallowed because telemetry must never
 * break the user-facing flow.
 */
export function logWizardEvent(ev: WizardEventPayload): void {
  try {
    if (disabled || !currentSessionId) return;
    if (buffer.length >= MAX_BATCH) {
      // Hard cap — drop oldest to avoid unbounded growth in pathological
      // cases (e.g. user holds down Tab on a broken keyboard).
      buffer.shift();
    }
    buffer.push({ ...ev, ts: Date.now() });
    if (buffer.length >= MAX_BUFFER) {
      scheduleFlush(0);
    } else {
      scheduleFlush(FLUSH_INTERVAL_MS);
    }
  } catch (err) {
    logger.warn("wizardTelemetry: logWizardEvent failed", err);
  }
}

function scheduleFlush(delayMs: number): void {
  // If a flush is already pending, normally we keep it. BUT: when a
  // buffer-full trigger asks for delay=0, we must preempt the existing
  // (potentially 2s) timer so events go out immediately. Otherwise the
  // MAX_BUFFER threshold would be effectively pointless when a slower
  // interval timer is already running.
  if (flushTimer) {
    if (delayMs === 0) {
      clearTimeout(flushTimer);
      flushTimer = null;
    } else {
      return;
    }
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWizardTelemetry("interval");
  }, delayMs);
}

async function sendBatch(batch: BatchPayload, viaBeacon: boolean): Promise<void> {
  const bodyString = JSON.stringify(batch);

  if (viaBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      // sendBeacon cannot set auth headers, but our Edge Function does
      // not enforce auth on this endpoint. Browsers pick text/plain by
      // default; the server accepts that too.
      const blob = new Blob([bodyString], { type: "text/plain" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    } catch {
      // fall through to fetch
    }
  }

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: bodyString,
      keepalive: true,
    });
  } catch (err) {
    logger.warn("wizardTelemetry: fetch failed", err);
  }
}

/**
 * Flush the buffer to the server. When `reason === "pagehide"` we use
 * navigator.sendBeacon so the request survives the tab unload.
 */
export async function flushWizardTelemetry(
  reason: "interval" | "manual" | "pagehide" = "manual",
): Promise<void> {
  if (disabled || !currentSessionId) return;
  if (buffer.length === 0) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const toSend = buffer.splice(0, MAX_BATCH);
  const batch: BatchPayload = {
    session_id: currentSessionId,
    viewport_width: viewportWidth(),
    device_type: detectDeviceType(),
    events: toSend,
  };

  await sendBatch(batch, reason === "pagehide");
}

/**
 * Disable telemetry entirely for this tab (e.g. after unrecoverable
 * errors). Any future `logWizardEvent` calls become no-ops.
 */
export function disableWizardTelemetry(): void {
  disabled = true;
  buffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
