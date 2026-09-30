/**
 * Click-ID-Service (Google Ads, Microsoft Ads, Meta)
 *
 * Erfasst gclid, gbraid, wbraid, msclkid und fbclid aus der Einstiegs-URL,
 * damit eine Anfrage später der Kampagne zugeordnet werden kann.
 *
 * Einwilligung (TTDSG §25): Ohne Marketing-Einwilligung bleiben die IDs nur
 * im Speicher dieses Tabs. Erst mit Einwilligung landen sie für 90 Tage im
 * localStorage; wird sie widerrufen, werden sie dort gelöscht. An den Server
 * gehen sie nur über getConsentedClickIds().
 *
 * Referenz: https://support.google.com/google-ads/answer/9744275
 */

import { hasMarketingConsent } from '@/components/CookieBanner';
import { logger } from '@/lib/logger';

const STORAGE_PREFIX = "kuechenwert_";
const CLICK_ID_EXPIRY_DAYS = 90;

type ClickIdKey = "gclid" | "gbraid" | "wbraid" | "msclkid" | "fbclid";
const CLICK_ID_KEYS: readonly ClickIdKey[] = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"];

/** Längen je Typ; ungültige IDs erzeugen in Google Ads „GCLID kann nicht geparst werden“. */
const LENGTH_LIMITS: Record<ClickIdKey, [number, number]> = {
  gclid: [30, 200],
  gbraid: [10, 200],
  wbraid: [10, 200],
  msclkid: [16, 64],
  fbclid: [20, 500],
};

function isValidClickId(value: string, type: ClickIdKey): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  const [min, max] = LENGTH_LIMITS[type];
  if (trimmed.length < min || trimmed.length > max) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

interface StoredClickId {
  value: string;
  timestamp: number;
  landingPage: string;
}

export interface ClickIds {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  msclkid: string | null;
  fbclid: string | null;
}

/** Click-IDs dieses Tabs, unabhängig von der Einwilligung. */
const memory: Partial<Record<ClickIdKey, StoredClickId>> = {};

function isExpired(data: StoredClickId): boolean {
  return Date.now() - data.timestamp > CLICK_ID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

function persist(key: ClickIdKey, data: StoredClickId): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // localStorage nicht verfügbar (z.B. Private Browsing in Safari)
  }
}

function removeStored(): void {
  try {
    for (const key of CLICK_ID_KEYS) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    }
  } catch {
    // ignorieren
  }
}

function storeClickId(key: ClickIdKey, value: string): void {
  const data: StoredClickId = {
    value,
    timestamp: Date.now(),
    landingPage: window.location.pathname + window.location.search,
  };
  memory[key] = data;
  if (hasMarketingConsent()) persist(key, data);
}

function readStored(key: ClickIdKey): StoredClickId | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredClickId;
    if (!data?.value || isExpired(data)) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Liest eine Click-ID: erst aus diesem Tab, dann aus dem localStorage (nur mit Einwilligung). */
function readClickId(key: ClickIdKey): string | null {
  const fromMemory = memory[key];
  if (fromMemory && !isExpired(fromMemory)) return fromMemory.value;
  if (!hasMarketingConsent()) return null;
  return readStored(key)?.value ?? null;
}

let consentListenerAttached = false;

function attachConsentListener(): void {
  if (consentListenerAttached || typeof window === "undefined") return;
  consentListenerAttached = true;
  window.addEventListener('consent-updated', (event) => {
    const consent = (event as CustomEvent<{ marketing?: boolean }>).detail;
    if (consent?.marketing) {
      for (const key of CLICK_ID_KEYS) {
        const data = memory[key];
        if (data && !isExpired(data)) persist(key, data);
      }
    } else {
      removeStored();
    }
  });
}

/**
 * Extrahiert Click-IDs aus den aktuellen URL-Parametern.
 * Wird beim App-Start aufgerufen.
 */
export function captureClickIds(): void {
  try {
    if (typeof window === "undefined") return;
    attachConsentListener();

    const params = new URLSearchParams(window.location.search);
    for (const key of CLICK_ID_KEYS) {
      const value = params.get(key);
      if (!value) continue;
      if (isValidClickId(value, key)) {
        storeClickId(key, value.trim());
        if (process.env.NODE_ENV === "development") {
          logger.log(`[ClickIdService] ${key} erfasst:`, value.substring(0, 10) + "...");
        }
      } else {
        logger.log(`[ClickIdService] Ungültige ${key} verworfen (Länge: ${value.length})`);
      }
    }
  } catch {
    // Fehler bei Click-ID-Erfassung ignorieren – darf nie die UX beeinträchtigen
  }
}

/** Alle bekannten Click-IDs (dieser Tab plus, mit Einwilligung, localStorage). */
export function getStoredClickIds(): ClickIds {
  return {
    gclid: readClickId("gclid"),
    gbraid: readClickId("gbraid"),
    wbraid: readClickId("wbraid"),
    msclkid: readClickId("msclkid"),
    fbclid: readClickId("fbclid"),
  };
}

/**
 * Click-IDs für die Anfrage an den Server – nur mit Marketing-Einwilligung,
 * sonst null. Leere Werte werden weggelassen.
 */
export function getConsentedClickIds(): Partial<Record<ClickIdKey, string>> | null {
  if (!hasMarketingConsent()) return null;
  const ids = getStoredClickIds();
  const out: Partial<Record<ClickIdKey, string>> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = ids[key];
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Gibt die GA4 Client-ID zurück (aus dem _ga Cookie).
 * Die Client-ID wird von GA4 automatisch gesetzt und identifiziert
 * den Browser/Nutzer. Sie wird für die GA4 Measurement Protocol
 * Zuordnung benötigt.
 * 
 * Format: XXXXXXXXXX.XXXXXXXXXX (zwei Zahlen getrennt durch Punkt)
 */
export function getGA4ClientId(): string | null {
  try {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith("_ga=")) {
        // _ga Cookie Format: GA1.1.XXXXXXXXXX.XXXXXXXXXX
        // Wir brauchen die letzten beiden Teile
        const parts = trimmed.substring(4).split(".");
        if (parts.length >= 4) {
          return `${parts[2]}.${parts[3]}`;
        }
        if (parts.length >= 2) {
          return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gibt ein vollständiges Tracking-Datenpaket zurück, das bei jeder
 * Lead-Erfassung an den Server gesendet werden sollte.
 * 
 * Enthält:
 * - Click-IDs (gclid, gbraid, wbraid, msclkid, fbclid)
 * - GA4 Client-ID
 * - User-Agent
 * - Referrer
 * - Landing Page URL
 */
export function getTrackingData(): ClickIds & {
  ga4ClientId: string | null;
  userAgent: string;
  referrer: string;
  pageUrl: string;
} {
  const clickIds = getStoredClickIds();
  return {
    ...clickIds,
    ga4ClientId: getGA4ClientId(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
    pageUrl: typeof window !== "undefined" ? window.location.href : "",
  };
}
