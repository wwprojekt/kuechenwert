/**
 * Microsoft Advertising (Bing) UET Conversion Tracking Service
 *
 * Pendant zu gadsConversionService.ts — feuert dieselben Conversion-Events
 * parallel auch an Microsoft Ads (Bing). Der Google-Pfad bleibt unverändert
 * und ist NICHT von dieser Datei abhängig.
 *
 * Architektur:
 * - UET-Pixel wird in index.html dynamisch geladen, wenn
 *   `microsoft_ads.enabled === true` UND eine `uet_tag_id` konfiguriert ist
 * - Das geladene Pixel registriert die globale Funktion `window.uetq`
 * - Conversion-Events werden via `window.uetq.push('event', goalName, {...})`
 *   gesendet — Bing matched dann automatisch über den `msclkid`-Cookie
 *   den Klick auf eine bestimmte Anzeige
 *
 * DSGVO: Genau wie Meta Pixel wird UET nur nach Marketing-Consent geladen.
 * Diese Service-Datei ist consent-aware (gating via isMicrosoftAdsEnabled()).
 *
 * Doku: https://help.ads.microsoft.com/#apex/3/en/56684/2
 */

import { logger } from '@/lib/logger';
import {
  getMicrosoftConversionGoal,
  getMicrosoftConversionValue,
  isMicrosoftAdsEnabled,
  type ConversionLabelKey,
  type ConversionValueKey,
} from '@/lib/trackingConfig';

declare global {
  interface Window {
    /**
     * Microsoft UET queue. Wird vom UET-Pixel-Loader (index.html) belegt.
     * Vor dem Laden des Pixels ist es ein Array (Push-Queue), danach ein
     * Object mit `.push(...)` Methode.
     */
    uetq?: unknown[] | { push: (...args: unknown[]) => void };
  }
}

/**
 * Sicherer Zugriff auf window.uetq.
 * Gibt false zurück wenn Bing-Tracking deaktiviert oder uetq nicht
 * verfügbar ist (z.B. weil Marketing-Consent fehlt).
 */
function safeUet(...args: unknown[]): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!isMicrosoftAdsEnabled()) return false;
    if (!window.uetq) {
      // UET noch nicht geladen — wir queuen via Array-Push, das echte uetq
      // übernimmt die Queue beim Initialisieren.
      window.uetq = [];
    }
    if (Array.isArray(window.uetq)) {
      window.uetq.push(args);
    } else if (typeof (window.uetq as { push?: unknown }).push === 'function') {
      (window.uetq as { push: (...args: unknown[]) => void }).push(...args);
    }
    logger.log('[UetService] Event gesendet:', args);
    return true;
  } catch (err) {
    logger.warn('[UetService] Fehler beim Senden des Events:', err);
    return false;
  }
}

/**
 * Sendet einen Bing-Conversion-Event basierend auf einem internen
 * Conversion-Key. Der Goal-Name in Microsoft Ads MUSS exakt dem in
 * `tracking_config.microsoft_ads.conversion_goals[key]` hinterlegten
 * String entsprechen ("Custom Event Goal").
 *
 * Wert + Währung werden mitgesendet, damit Bing-Smart-Bidding auf
 * Conversion-Wert optimieren kann.
 *
 * Diese Funktion ist NIE blocking. Sie schluckt alle Fehler intern,
 * damit eine Bing-API-Störung niemals den Google-Pfad beeinträchtigt.
 */
export function sendBingConversion(
  key: ConversionLabelKey,
  valueKey: ConversionValueKey,
  transactionId?: string,
): void {
  const goalName = getMicrosoftConversionGoal(key);
  if (!goalName) return;
  const revenueValue = getMicrosoftConversionValue(valueKey);
  const eventParams: Record<string, unknown> = {
    revenue_value: revenueValue,
    currency: 'EUR',
    event_category: 'Lead',
    event_label: key,
  };
  if (transactionId) {
    eventParams.transaction_id = transactionId;
  }
  safeUet('event', goalName, eventParams);
}

/**
 * Sendet ein leichtes Bing-Custom-Event ohne Conversion-Goal-Mapping.
 * Sinnvoll für Mikro-Conversions (z.B. Phone-Click, CTA-Click), die in
 * Bing Ads nur als Beobachtungs-Goal angelegt sind.
 */
export function sendBingCustomEvent(
  eventAction: string,
  params?: Record<string, unknown>,
): void {
  if (!eventAction) return;
  safeUet('event', eventAction, {
    event_category: 'Custom',
    ...(params ?? {}),
  });
}

/**
 * Setzt User-Daten für Microsoft "Enhanced Conversions". Microsoft erwartet
 * (anders als Google) gehashte E-Mail/Telefon DIREKT im Event, nicht via
 * separatem `set`-Call. Diese Funktion bereitet die gehashten Werte vor und
 * pusht sie via `set` in die UET-Queue, damit nachfolgende Events sie
 * automatisch mitsenden.
 *
 * Doku: https://help.ads.microsoft.com/apex/3/en/60118/2
 */
export async function setBingEnhancedConversionData(userData: {
  email?: string;
  phone?: string;
}): Promise<void> {
  if (!isMicrosoftAdsEnabled()) return;
  try {
    const data: Record<string, string> = {};
    if (userData.email) {
      data.pid = await sha256Lower(userData.email);
    }
    if (userData.phone) {
      // Microsoft akzeptiert Telefon entweder gehashed oder normalisiert.
      // Wir gehashed es defensiv.
      const normalized = userData.phone.replace(/[\s\-()]/g, '');
      data.ph = await sha256Lower(normalized);
    }
    if (Object.keys(data).length === 0) return;
    safeUet('set', { pid: data });
  } catch (err) {
    logger.warn('[UetService] setBingEnhancedConversionData failed:', err);
  }
}

async function sha256Lower(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
