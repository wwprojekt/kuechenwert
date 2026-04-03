/**
 * Google Ads Click ID Service
 * 
 * Erfasst und speichert Google Ads Click-IDs (GCLID, GBRAID, WBRAID)
 * aus URL-Parametern. Diese IDs sind essentiell für die serverseitige
 * Conversion-Attribution, da sie Google Ads ermöglichen, Conversions
 * direkt dem ursprünglichen Anzeigenklick zuzuordnen.
 * 
 * Funktionsweise:
 * 1. Beim Seitenaufruf werden URL-Parameter auf Click-IDs geprüft
 * 2. Gefundene IDs werden in localStorage gespeichert (90 Tage gültig)
 * 3. Bei Lead-Erfassung werden die IDs an den Server gesendet
 * 
 * Click-ID-Typen:
 * - GCLID: Google Click Identifier (Standard, Third-Party-Cookie-basiert)
 * - GBRAID: Google Broad Identifier (iOS App-Kampagnen, First-Party)
 * - WBRAID: Web Broad Identifier (Web-Kampagnen ohne Third-Party-Cookies)
 * 
 * Referenz: https://support.google.com/google-ads/answer/9744275
 */

import { logger } from '@/lib/logger';

const STORAGE_PREFIX = "caravanwert_";
const CLICK_ID_EXPIRY_DAYS = 90;

/**
 * Validiert eine GCLID auf grundlegende Korrektheit.
 * Ungültige GCLIDs (zu kurz, ungültige Zeichen) werden nicht gespeichert,
 * um "GCLID kann nicht geparst werden" Fehler in Google Ads zu vermeiden.
 * 
 * Gültige GCLIDs:
 * - Bestehen aus alphanumerischen Zeichen, Bindestrichen und Unterstrichen
 * - Sind mindestens 30 Zeichen lang
 * - Sind maximal 200 Zeichen lang
 */
function isValidClickId(value: string, type: 'gclid' | 'gbraid' | 'wbraid'): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  // GCLIDs sind typischerweise 50-100+ Zeichen lang
  if (type === 'gclid' && (trimmed.length < 30 || trimmed.length > 200)) return false;
  // GBRAID/WBRAID können kürzer sein
  if ((type === 'gbraid' || type === 'wbraid') && (trimmed.length < 10 || trimmed.length > 200)) return false;
  // Nur alphanumerische Zeichen, Bindestriche und Unterstriche erlaubt
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return false;
  return true;
}

interface StoredClickId {
  value: string;
  timestamp: number;
  landingPage: string;
}

interface ClickIds {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
}

/**
 * Speichert eine Click-ID mit Zeitstempel in localStorage.
 */
function storeClickId(key: string, value: string): void {
  try {
    const data: StoredClickId = {
      value,
      timestamp: Date.now(),
      landingPage: window.location.pathname + window.location.search,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // localStorage nicht verfügbar (z.B. Private Browsing in Safari)
  }
}

/**
 * Liest eine Click-ID aus localStorage. Gibt null zurück wenn
 * die ID nicht existiert oder abgelaufen ist (> 90 Tage).
 */
function readClickId(key: string): string | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;

    const data: StoredClickId = JSON.parse(raw);
    const ageMs = Date.now() - data.timestamp;
    const maxAgeMs = CLICK_ID_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return data.value;
  } catch {
    return null;
  }
}

/**
 * Extrahiert Click-IDs aus den aktuellen URL-Parametern und speichert
 * sie in localStorage. Sollte bei jedem Seitenaufruf aufgerufen werden.
 * 
 * Google Ads hängt automatisch einen der folgenden Parameter an die URL:
 * - ?gclid=... (Standard)
 * - ?gbraid=... (iOS ohne Third-Party-Cookies)
 * - ?wbraid=... (Web ohne Third-Party-Cookies)
 */
export function captureClickIds(): void {
  try {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    const gclid = params.get("gclid");
    const gbraid = params.get("gbraid");
    const wbraid = params.get("wbraid");

    if (gclid) {
      if (isValidClickId(gclid, 'gclid')) {
        storeClickId("gclid", gclid);
        if (process.env.NODE_ENV === "development") {
          logger.log("[ClickIdService] GCLID erfasst:", gclid.substring(0, 10) + "...");
        }
      } else {
        logger.log("[ClickIdService] Ungültige GCLID verworfen (Länge:", gclid.length + ")");
      }
    }

    if (gbraid) {
      if (isValidClickId(gbraid, 'gbraid')) {
        storeClickId("gbraid", gbraid);
        if (process.env.NODE_ENV === "development") {
          logger.log("[ClickIdService] GBRAID erfasst:", gbraid.substring(0, 10) + "...");
        }
      } else {
        logger.log("[ClickIdService] Ungültiger GBRAID verworfen (Länge:", gbraid.length + ")");
      }
    }

    if (wbraid) {
      if (isValidClickId(wbraid, 'wbraid')) {
        storeClickId("wbraid", wbraid);
        if (process.env.NODE_ENV === "development") {
          logger.log("[ClickIdService] WBRAID erfasst:", wbraid.substring(0, 10) + "...");
        }
      } else {
        logger.log("[ClickIdService] Ungültiger WBRAID verworfen (Länge:", wbraid.length + ")");
      }
    }
  } catch {
    // Fehler bei Click-ID-Erfassung ignorieren – darf nie die UX beeinträchtigen
  }
}

/**
 * Gibt alle gespeicherten Click-IDs zurück.
 * Wird bei der Lead-Erfassung aufgerufen um die IDs an den Server zu senden.
 */
export function getStoredClickIds(): ClickIds {
  return {
    gclid: readClickId("gclid"),
    gbraid: readClickId("gbraid"),
    wbraid: readClickId("wbraid"),
  };
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
 * - Click-IDs (gclid, gbraid, wbraid)
 * - GA4 Client-ID
 * - User-Agent
 * - Referrer
 * - Landing Page URL
 */
export function getTrackingData(): {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
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
