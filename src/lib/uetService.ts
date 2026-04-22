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
 * Setzt User-Daten für Microsoft "Enhanced Conversions" via UET-Pixel.
 * Microsoft erwartet das Wrapper-Format `{ pid: { em, ph } }` — `em` für
 * gehashte E-Mail, `ph` für gehashte Telefonnummer. NICHT verwechseln mit
 * `pid` als Feldname (das ist NUR der Wrapper).
 *
 * E-Mail-Normalisierung (per MS-Spec):
 *  1. Whitespace trimmen
 *  2. Punkte aus dem User-Part entfernen
 *  3. +Alias aus dem User-Part entfernen
 *  4. Komplett lowercase
 *
 * Telefon-Normalisierung: defensiv auf nur-Ziffern + führendes "+",
 * E.164 ist die offizielle Empfehlung (DE = +49…).
 *
 * Diese `set`-Daten gelten für ALLE nachfolgenden uetq-Events (auch
 * `pageLoad`), daher idealerweise vor dem ersten Conversion-Event aufrufen.
 *
 * Doku: https://learn.microsoft.com/en-us/advertising/guides/uet-conversion-api-integration
 */
export async function setBingEnhancedConversionData(userData: {
  email?: string;
  phone?: string;
}): Promise<void> {
  if (!isMicrosoftAdsEnabled()) return;
  try {
    const pid: Record<string, string> = {};
    if (userData.email) {
      const normEmail = normalizeEmailForBing(userData.email);
      if (normEmail) pid.em = await sha256Hex(normEmail);
    }
    if (userData.phone) {
      const normPhone = normalizePhoneForBing(userData.phone);
      if (normPhone) pid.ph = await sha256Hex(normPhone);
    }
    if (Object.keys(pid).length === 0) return;
    safeUet('set', { pid });
  } catch (err) {
    logger.warn('[UetService] setBingEnhancedConversionData failed:', err);
  }
}

/**
 * Normalisiert eine E-Mail-Adresse nach MS-Bing-Spec für Enhanced
 * Conversions. Gibt einen leeren String zurück wenn die Eingabe kein
 * gültiges E-Mail-Format hat (verhindert Müll-Hashes).
 */
function normalizeEmailForBing(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '';
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  // Remove +alias-Teil (alles ab dem ersten +)
  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);
  // Remove Punkte aus User-Part (Gmail-konform; für andere Provider neutral)
  local = local.replace(/\./g, '');
  if (!local) return '';
  return `${local}@${domain}`;
}

/**
 * Normalisiert eine Telefonnummer auf reines E.164-Format (digits + leading '+').
 * Wenn keine Landeskennung erkennbar ist, fallback auf "+49" (DE-Markt).
 */
function normalizePhoneForBing(raw: string): string {
  const stripped = raw.replace(/[^\d+]/g, '');
  if (!stripped) return '';
  if (stripped.startsWith('+')) return stripped;
  if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
  if (stripped.startsWith('0')) return `+49${stripped.slice(1)}`;
  return `+${stripped}`;
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
