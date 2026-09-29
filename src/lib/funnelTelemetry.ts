/**
 * Funnel-Telemetrie: Schritt- und Feldereignisse der drei Funnels für die
 * Abbruchanalyse (Admin → Analytics → Funnels). Wie die Wizard-Telemetrie von
 * CaravanWert: Puffer im Speicher, gebündelter Versand an kw-funnel-telemetry,
 * beim Verlassen der Seite per sendBeacon.
 *
 * Datenschutz: nur Feldschlüssel (z. B. "email"), nie Eingaben; keine
 * Click-IDs, keine IP-Adresse. Gesendet wird nur mit Statistik-Einwilligung.
 * Bis zur Entscheidung im Cookie-Banner wartet der Puffer, bei Ablehnung wird
 * er verworfen (wie analyticsService). Fehler hier dürfen den Funnel nie stören.
 */

import { getConsentId, getStoredConsent, type CookieConsent } from "@/components/CookieBanner";
import { getStoredClickIds } from "@/lib/clickIdService";
import type { FunnelId } from "@/lib/funnelRoutes";
import { getEntryPath, getStoredUtm } from "@/lib/utm";
import {
  MAX_METADATA_STRING,
  MAX_TELEMETRY_BATCH,
  isFieldKey,
  sanitizeTelemetryMetadata,
  type FunnelTelemetryEvent,
  type TelemetryDeviceType,
  type TelemetryMetadata,
} from "../../supabase/functions/_shared/funnel-telemetry.ts";

export type { FunnelTelemetryEvent, TelemetryMetadata };

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL || "https://gzqayoalwtmypndrmqes.supabase.co"}/functions/v1/kw-funnel-telemetry`;
const FLUSH_DELAY_MS = 2000;
const FLUSH_AT = 20;
/** Obergrenze, solange die Einwilligung noch aussteht. */
const MAX_PENDING = 300;
const STORAGE_PREFIX = "kw_funnel_telemetry_";

export interface FunnelEventInput {
  funnel: FunnelId;
  step: string;
  stepIndex: number;
  event: FunnelTelemetryEvent;
  field?: string | null;
  errorFields?: readonly string[] | null;
  timeOnStepMs?: number | null;
  metadata?: TelemetryMetadata | null;
}

interface QueuedEvent {
  funnel: FunnelId;
  sessionId: string;
  step: string;
  step_index: number;
  event: FunnelTelemetryEvent;
  field_name: string | null;
  error_fields: string[] | null;
  time_on_step_ms: number | null;
  metadata: TelemetryMetadata | null;
}

export interface ActiveFunnelStep {
  funnel: FunnelId;
  step: string;
  stepIndex: number;
  enteredAt: number;
}

type ConsentState = "granted" | "denied" | "pending";

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let active: ActiveFunnelStep | null = null;
const sessions = new Map<FunnelId, string>();
/** Sitzungen, deren Start (erste Antwort) schon an GA4/Meta ging. */
const started = new Set<string>();
let listening = false;

function consentState(consent: CookieConsent | null = getStoredConsent()): ConsentState {
  if (!consent) return "pending";
  return consent.analytics ? "granted" : "denied";
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function storageKey(funnel: FunnelId): string {
  return `${STORAGE_PREFIX}${funnel}`;
}

/** Nur mit Einwilligung im sessionStorage, damit Neuladen die Sitzung nicht teilt. */
function persistSessions(): void {
  try {
    for (const [funnel, id] of sessions) sessionStorage.setItem(storageKey(funnel), id);
  } catch {
    /* Speicher nicht verfügbar */
  }
}

function forgetStoredSessions(): void {
  try {
    for (const funnel of ["a", "b", "c"] as const) sessionStorage.removeItem(storageKey(funnel));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

function deviceType(): TelemetryDeviceType {
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function send(funnel: FunnelId, sessionId: string, events: QueuedEvent[], viaBeacon: boolean): void {
  const body = JSON.stringify({
    session_id: sessionId,
    funnel,
    consent_id: getConsentId(),
    device_type: deviceType(),
    viewport_width: window.innerWidth,
    events: events.map((e) => ({
      step: e.step,
      step_index: e.step_index,
      event: e.event,
      field_name: e.field_name,
      error_fields: e.error_fields,
      time_on_step_ms: e.time_on_step_ms,
      metadata: e.metadata,
    })),
  });
  // text/plain ist eine einfache Anfrage ohne CORS-Preflight; sendBeacon kann ohnehin keine Header setzen.
  if (viaBeacon && typeof navigator.sendBeacon === "function") {
    try {
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
    } catch {
      /* weiter mit fetch */
    }
  }
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

function scheduleFlush(delayMs: number): void {
  if (flushTimer) {
    if (delayMs > 0) return;
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushFunnelTelemetry();
  }, delayMs);
}

function handleConsentUpdate(event: Event): void {
  const consent = (event as CustomEvent<CookieConsent>).detail ?? null;
  const state = consentState(consent);
  if (state === "granted") {
    persistSessions();
    flushFunnelTelemetry();
  } else if (state === "denied") {
    queue = [];
    forgetStoredSessions();
  }
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("consent-updated", handleConsentUpdate);
}

/**
 * Sitzungskennung eines Funnel-Durchlaufs; isNew nur beim ersten Aufruf.
 * Nach dem Absenden beginnt mit endFunnelSession ein neuer Durchlauf.
 */
export function beginFunnelSession(funnel: FunnelId): { sessionId: string; isNew: boolean } {
  listen();
  const known = sessions.get(funnel);
  if (known) return { sessionId: known, isNew: false };
  let stored: string | null = null;
  if (consentState() === "granted") {
    try {
      stored = sessionStorage.getItem(storageKey(funnel));
    } catch {
      stored = null;
    }
  }
  const sessionId = stored ?? randomId();
  sessions.set(funnel, sessionId);
  // Nach einem Neuladen wurde der Start schon gemeldet.
  if (stored) started.add(sessionId);
  if (consentState() === "granted") persistSessions();
  return { sessionId, isNew: !stored };
}

export function endFunnelSession(funnel: FunnelId): void {
  flushFunnelTelemetry();
  const sessionId = sessions.get(funnel);
  if (active?.funnel === funnel) active = null;
  sessions.delete(funnel);
  if (sessionId) started.delete(sessionId);
  try {
    sessionStorage.removeItem(storageKey(funnel));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

/** true genau einmal pro Durchlauf: bei der ersten Antwort. */
export function markFunnelStarted(funnel: FunnelId): boolean {
  const sessionId = sessions.get(funnel);
  if (!sessionId || started.has(sessionId)) return false;
  started.add(sessionId);
  return true;
}

export function logFunnelEvent(input: FunnelEventInput): void {
  try {
    if (typeof window === "undefined") return;
    listen();
    const state = consentState();
    if (state === "denied") return;
    const sessionId = sessions.get(input.funnel);
    if (!sessionId) return;
    if (queue.length >= MAX_PENDING) queue.shift();
    const errorFields = input.errorFields ? [...new Set(input.errorFields.filter(isFieldKey))] : [];
    queue.push({
      funnel: input.funnel,
      sessionId,
      step: input.step,
      step_index: input.stepIndex,
      event: input.event,
      field_name: isFieldKey(input.field) ? input.field : null,
      error_fields: errorFields.length > 0 ? errorFields : null,
      time_on_step_ms: input.timeOnStepMs == null ? null : Math.max(0, Math.round(input.timeOnStepMs)),
      metadata: sanitizeTelemetryMetadata(input.metadata),
    });
    if (state === "granted") scheduleFlush(queue.length >= FLUSH_AT ? 0 : FLUSH_DELAY_MS);
  } catch {
    /* Telemetrie darf den Funnel nie stören */
  }
}

/** Sendet den Puffer; beim Verlassen der Seite per sendBeacon. */
export function flushFunnelTelemetry(viaBeacon = false): void {
  try {
    if (typeof window === "undefined" || queue.length === 0) return;
    if (consentState() !== "granted") return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const pending = queue;
    queue = [];
    const groups = new Map<string, QueuedEvent[]>();
    for (const item of pending) {
      const key = `${item.funnel}:${item.sessionId}`;
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    for (const group of groups.values()) {
      const { funnel, sessionId } = group[0]!;
      for (let i = 0; i < group.length; i += MAX_TELEMETRY_BATCH) {
        send(funnel, sessionId, group.slice(i, i + MAX_TELEMETRY_BATCH), viaBeacon);
      }
    }
  } catch {
    /* Telemetrie darf den Funnel nie stören */
  }
}

export function setActiveFunnelStep(step: ActiveFunnelStep | null): void {
  active = step;
}

export function getActiveFunnelStep(): ActiveFunnelStep | null {
  return active;
}

/** Ereignis zum gerade angezeigten Schritt, z. B. aus Kopf- oder Fußzeile. */
export function trackActiveFunnelEvent(event: FunnelTelemetryEvent, metadata?: TelemetryMetadata): void {
  if (!active) return;
  logFunnelEvent({
    funnel: active.funnel,
    step: active.step,
    stepIndex: active.stepIndex,
    event,
    timeOnStepMs: Date.now() - active.enteredAt,
    metadata,
  });
}

/** Fehlertexte ohne E-Mail-Adressen und lange Ziffernfolgen (Telefon, PLZ, Preise). */
export function scrubErrorText(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")
    .replace(/\d{5,}/g, "[zahl]")
    .slice(0, MAX_METADATA_STRING);
}

function clickSource(): string | null {
  const ids = getStoredClickIds();
  if (ids.gclid || ids.gbraid || ids.wbraid) return "google";
  if (ids.msclkid) return "microsoft";
  if (ids.fbclid) return "meta";
  return null;
}

/** Herkunft des Durchlaufs für die Auswertung nach Kanal (einmal pro Sitzung). */
export function entryMetadata(): TelemetryMetadata {
  const utm = getStoredUtm();
  let referrerHost: string | null = null;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname : null;
  } catch {
    referrerHost = null;
  }
  if (referrerHost === window.location.hostname) referrerHost = null;
  return {
    entry_path: getEntryPath() ?? window.location.pathname,
    utm_source: utm.utm_source ?? null,
    utm_medium: utm.utm_medium ?? null,
    utm_campaign: utm.utm_campaign ?? null,
    click_source: clickSource(),
    referrer_host: referrerHost,
  };
}
