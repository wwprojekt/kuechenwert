/**
 * Google Ads Conversion Tracking Service
 * 
 * Zentraler Service für alle Google Ads Conversion-Events.
 * Trackt Küchenanfragen, das Kontaktformular, Registrierung/Login und
 * Kontakt-Klicks (Telefon, WhatsApp, E-Mail).
 * 
 * Konto, Conversion-ID und Labels kommen aus site_settings.tracking_config
 * (Admin → Tracking). Küchenanfragen aller Funnels: Label-Key KUECHEN_LEAD.
 * 
 * Conversion-Strategie:
 * - PRIMÄRE Conversions: Jede Lead-Erfassung mit Kontaktdaten (für Gebotsoptimierung)
 * - Alles andere nur als GA4-/Bing-Event (Beobachtung, Zielgruppen)
 */

import { logger } from '@/lib/logger';
import {
  getConversionLabel,
  getConversionValue,
  getGoogleAdsId,
  isGoogleAdsEnabled,
  type ConversionLabelKey,
} from '@/lib/trackingConfig';
import {
  sendBingConversion,
  sendBingCustomEvent,
  setBingEnhancedConversionData,
} from '@/lib/uetService';

// TypeScript-Deklaration für gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ============================================================
// TRANSACTION ID FÜR DEDUPLIZIERUNG
// Google Ads dedupliziert Conversions automatisch anhand der transaction_id.
// Wenn dieselbe transaction_id über mehrere Quellen kommt (gtag, GA4-Import,
// Google Ads API), wird die Conversion nur einmal gezählt.
// ============================================================

/**
 * Generiert eine eindeutige Transaction ID für Conversion-Deduplizierung.
 * Format: cv_{lead_type}_{timestamp}_{random}
 * 
 * Diese ID wird über alle 3 Tracking-Schichten geteilt:
 * - Schicht 1: Client-Side gtag (transaction_id Parameter)
 * - Schicht 2b: GA4-Import nach Google Ads (transaction_id im generate_lead Event)
 * - Schicht 3: Google Ads API (orderId Feld)
 * 
 * @param leadType - Der Lead-Typ (z.B. 'funnel_a', 'kontakt')
 * @returns Eindeutige Transaction ID
 */
export function generateTransactionId(leadType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `cv_${leadType}_${timestamp}_${random}`;
}

// Hilfsfunktion: gtag sicher aufrufen
// Verwendet window.gtag (explizit in index.html gesetzt) oder
// fällt auf dataLayer.push zurück falls gtag nicht verfügbar ist
function safeGtag(...args: unknown[]): void {
  try {
    if (typeof window === 'undefined') return;

    // Primär: window.gtag verwenden (wird in index.html gesetzt)
    if (typeof window.gtag === 'function') {
      window.gtag(...args);
      if (process.env.NODE_ENV === 'development') {
        logger.log('[GadsTracking] Event gesendet via window.gtag:', args);
      }
      return;
    }

    // Fallback: Direkt auf dataLayer pushen
    if (window.dataLayer) {
      window.dataLayer.push(args);
      if (process.env.NODE_ENV === 'development') {
        logger.log('[GadsTracking] Event gesendet via dataLayer.push:', args);
      }
      return;
    }

    logger.warn('[GadsTracking] Weder window.gtag noch dataLayer verfügbar. Event verworfen:', args);
  } catch (error) {
    logger.warn('[GadsTracking] Fehler beim Senden des Events:', error);
  }
}

/**
 * Sendet ein Google Ads Conversion-Event mit Schutz gegen Navigation-Abbruch.
 * Verwendet 'beacon' als transport_type damit der Request auch bei
 * sofortiger Navigation (z.B. zur Danke-Seite) ankommt.
 */
function sendConversion(label: string, value: number, transactionId?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    // Timeout-Fallback: Nach 1s trotzdem weiter navigieren
    const timeout = setTimeout(resolve, 1000);
    const conversionId = getGoogleAdsId();
    if (!isGoogleAdsEnabled() || !conversionId || !label) {
      clearTimeout(timeout);
      resolve();
      return;
    }
    const eventParams: Record<string, unknown> = {
      send_to: `${conversionId}/${label}`,
      value,
      currency: 'EUR',
      transport_type: 'beacon',
      event_callback: () => {
        clearTimeout(timeout);
        resolve();
      },
    };
    // Transaction ID für Deduplizierung über alle Quellen
    if (transactionId) {
      eventParams.transaction_id = transactionId;
    }
    safeGtag('event', 'conversion', eventParams);
  });
}

/**
 * Schickt eine Conversion mit dynamischem Label aus der Tracking-Config.
 * Bevorzugte Variante – akzeptiert den Label-Key statt des Roh-Strings.
 */
function sendConversionByKey(key: ConversionLabelKey, valueKey: ConversionLabelKey, transactionId?: string): Promise<void> {
  return sendConversion(getConversionLabel(key), getConversionValue(valueKey), transactionId);
}

// ============================================================
// PRIMÄRE LEAD-TRACKING EVENTS
// Jedes dieser Events löst eine primäre Conversion aus.
// Labels und Werte (€) kommen zur Laufzeit aus site_settings.tracking_config;
// send_to = {google_ads.conversion_id}/{label}
// ============================================================

/**
 * Küchenanfrage abgeschickt (Funnel A, B oder C mit Kontaktdaten)
 * Primäre Conversion: Ja (Label-Key KUECHEN_LEAD)
 */
export async function trackKitchenFunnelLead(
  funnel: "a" | "b" | "c",
  transactionId?: string,
): Promise<void> {
  const txId = transactionId || generateTransactionId(`funnel_${funnel}`);
  await sendConversionByKey("KUECHEN_LEAD", "KUECHEN_LEAD", txId);

  safeGtag("event", "generate_lead", {
    transaction_id: txId,
    event_category: "Lead",
    event_label: `funnel_${funnel}`,
    value: getConversionValue("KUECHEN_LEAD"),
    currency: "EUR",
    lead_source: `funnel_${funnel}`,
  });

  safeGtag("event", "form_submit", {
    form_id: `funnel_${funnel}`,
    form_name: `Küchen-Funnel ${funnel.toUpperCase()}`,
    form_destination: `/funnel/${funnel}`,
  });

  sendBingConversion("KUECHEN_LEAD", "KUECHEN_LEAD", txId);
}

/**
 * Kontaktformular gesendet: /kontakt Formular abgesendet
 * Primäre Conversion: Ja (Label-Key KONTAKTFORMULAR_GESENDET)
 */
export async function trackKontaktformularGesendet(transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('kontakt');
  const value = getConversionValue('KONTAKTFORMULAR_GESENDET');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversionByKey('KONTAKTFORMULAR_GESENDET', 'KONTAKTFORMULAR_GESENDET', txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'kontaktformular_gesendet',
    value,
    currency: 'EUR',
    lead_source: 'kontaktformular',
  });

  // GA4: Zusätzliches form_submit Event für detaillierte Analyse
  safeGtag('event', 'form_submit', {
    form_id: 'kontaktformular',
    form_name: 'Kontaktformular',
    form_destination: '/kontakt',
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('KONTAKTFORMULAR_GESENDET', 'KONTAKTFORMULAR_GESENDET', txId);
}

// ============================================================
// AUTH-TRACKING EVENTS
// ============================================================

/**
 * Nutzer hat sich registriert.
 * NUR sign_up Event – KEINE Conversion!
 * Registrierungen sind kein Lead (Lead = abgeschickte Küchenanfrage).
 */
export function trackUserRegistered(method: string): void {
  const txId = generateTransactionId('signup');
  safeGtag('event', 'sign_up', {
    transaction_id: txId,
    event_category: 'Auth',
    event_label: method,
    method: method,
  });
}

/**
 * Nutzer hat sich eingeloggt
 */
export function trackUserLoggedIn(method: string): void {
  safeGtag('event', 'login', {
    event_category: 'Auth',
    event_label: method,
    method: method,
  });
}

// ============================================================
// CTA-KLICK-TRACKING (Telefon, WhatsApp, E-Mail)
// Wichtig für Lead-Gen: Jeder Kontaktkanal muss getrackt werden
// ============================================================

/**
 * Telefon-Klick: Nutzer klickt auf Telefonnummer
 */
export function trackPhoneClick(phoneNumber: string, pagePath: string): void {
  safeGtag('event', 'contact', {
    event_category: 'CTA',
    event_label: 'phone_click',
    contact_method: 'phone',
    phone_number: phoneNumber,
    page_path: pagePath,
    value: 1.0,
    currency: 'EUR',
  });

  // Einheitliches contact_click Event für GA4 Zielgruppe 'Kontakt-Leads'
  sendContactClickEvent('phone', pagePath);
}

/**
 * WhatsApp-Klick: Nutzer klickt auf WhatsApp-Button
 */
export function trackWhatsAppClick(pagePath: string): void {
  safeGtag('event', 'contact', {
    event_category: 'CTA',
    event_label: 'whatsapp_click',
    contact_method: 'whatsapp',
    page_path: pagePath,
    value: 1.0,
    currency: 'EUR',
  });

  // Einheitliches contact_click Event für GA4 Zielgruppe 'Kontakt-Leads'
  sendContactClickEvent('whatsapp', pagePath);
}

/**
 * E-Mail-Klick: Nutzer klickt auf E-Mail-Link
 */
export function trackEmailClick(pagePath: string): void {
  safeGtag('event', 'contact', {
    event_category: 'CTA',
    event_label: 'email_click',
    contact_method: 'email',
    page_path: pagePath,
    value: 1.0,
    currency: 'EUR',
  });

  // Einheitliches contact_click Event für GA4 Zielgruppe 'Kontakt-Leads'
  sendContactClickEvent('email', pagePath);
}

/**
 * CTA-Button-Klick: Nutzer klickt auf einen Call-to-Action Button
 * (z.B. "Angebote vergleichen", "Kostenlos anfragen")
 */
export function trackCTAClick(ctaName: string, pagePath: string, destination?: string): void {
  safeGtag('event', 'cta_click', {
    event_category: 'CTA',
    event_label: ctaName,
    page_path: pagePath,
    link_url: destination || '',
  });
}

// ============================================================
// CONTACT CLICK EVENTS (für GA4 Zielgruppen)
// Jeder Kontakt-Klick sendet zusätzlich ein 'contact_click' Event
// das von der GA4 Zielgruppe 'Kontakt-Leads' verwendet wird
// ============================================================

/**
 * Wrapper: Sendet ein einheitliches contact_click Event für GA4 Zielgruppen
 * Wird intern von trackPhoneClick, trackWhatsAppClick, trackEmailClick aufgerufen
 */
function sendContactClickEvent(method: string, pagePath: string): void {
  safeGtag('event', 'contact_click', {
    event_category: 'Contact',
    contact_method: method,
    page_path: pagePath,
  });

  // Microsoft Ads (Bing) — Custom Event für Smart-Bidding-Signal
  sendBingCustomEvent('contact_click', {
    contact_method: method,
    page_path: pagePath,
  });
}

// ============================================================
// USER PROPERTIES (für GA4 Segmentierung)
// ============================================================

/**
 * Setzt GA4 User Properties für bessere Segmentierung
 * Sollte einmal pro Session aufgerufen werden
 */
export function setUserProperties(properties: {
  traffic_type?: 'organic' | 'paid' | 'direct' | 'referral' | 'social';
  user_type?: 'visitor' | 'lead' | 'customer';
  preferred_contact?: 'phone' | 'whatsapp' | 'email' | 'form';
}): void {
  safeGtag('set', 'user_properties', properties);
}

/**
 * Erkennt den Traffic-Typ basierend auf UTM-Parametern und Referrer
 * und setzt die entsprechenden User Properties
 */
export function detectAndSetTrafficType(): void {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const referrer = document.referrer;

  let trafficType: 'organic' | 'paid' | 'direct' | 'referral' | 'social' = 'direct';

  if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmSource === 'google_ads') {
    trafficType = 'paid';
  } else if (utmSource) {
    trafficType = 'referral';
  } else if (referrer) {
    const referrerHost = new URL(referrer).hostname;
    if (referrerHost.includes('google') || referrerHost.includes('bing') || referrerHost.includes('yahoo')) {
      trafficType = 'organic';
    } else if (referrerHost.includes('facebook') || referrerHost.includes('instagram') || referrerHost.includes('twitter') || referrerHost.includes('linkedin')) {
      trafficType = 'social';
    } else {
      trafficType = 'referral';
    }
  }

  setUserProperties({ traffic_type: trafficType, user_type: 'visitor' });
}

// ============================================================
// ENHANCED CONVERSIONS
// Sendet gehashte Nutzerdaten an Google für bessere Attribution
// Besonders wichtig für Safari/ITP wo Cookies schnell verfallen
// Docs: https://support.google.com/google-ads/answer/13258081
// ============================================================

/**
 * Telefonnummer im E.164-Format (+4917…), wie Google es für Enhanced
 * Conversions verlangt. Nationale Nummern (0…) gelten als deutsch.
 */
export function toE164(raw: string, defaultCountryCode = '49'): string | null {
  const cleaned = raw.replace(/[^\d+]/g, '');
  let candidate: string;
  if (cleaned.startsWith('+')) candidate = cleaned;
  else if (cleaned.startsWith('00')) candidate = `+${cleaned.slice(2)}`;
  else if (cleaned.startsWith('0')) candidate = `+${defaultCountryCode}${cleaned.slice(1)}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

/**
 * Normalisiert ein Land in den von Google Ads erwarteten 2-Letter ISO-3166-1
 * Code (z. B. "DE", "AT", "CH"). Akzeptiert auch deutsche Namen ("Deutschland")
 * und gibt sonst undefined zurück.
 */
function normalizeCountryCode(country?: string): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const map: Record<string, string> = {
    deutschland: 'DE',
    germany: 'DE',
    österreich: 'AT',
    oesterreich: 'AT',
    austria: 'AT',
    schweiz: 'CH',
    switzerland: 'CH',
    niederlande: 'NL',
    netherlands: 'NL',
    belgien: 'BE',
    belgium: 'BE',
    frankreich: 'FR',
    france: 'FR',
    luxemburg: 'LU',
    luxembourg: 'LU',
    italien: 'IT',
    italy: 'IT',
    spanien: 'ES',
    spain: 'ES',
    polen: 'PL',
    poland: 'PL',
  };
  return map[trimmed.toLowerCase()];
}

/**
 * Setzt Enhanced Conversion Daten für Google Ads
 * Muss VOR dem Conversion-Event aufgerufen werden
 *
 * Die Daten werden automatisch gehasht und an Google gesendet.
 * Google nutzt diese Daten um Conversions auch ohne Third-Party-Cookies
 * korrekt zuzuordnen (besonders wichtig für Safari/ITP).
 *
 * Wichtig (Google Ads Spec):
 *  - email + phone_number → Top-Level
 *  - first_name + last_name → MÜSSEN innerhalb von `address` liegen und
 *    benötigen ZUSÄTZLICH `postal_code` + `country`, sonst rejected Google
 *    die Adress-Daten und löst Diagnose
 *    "Pflichtfelder in Adressen fehlen" aus.
 *  - Ohne PLZ + Land werden first_name/last_name daher bewusst NICHT gesendet
 *    (besser kein Adress-Feld als ein unvollständiges).
 *
 * @param userData - Nutzerdaten (mindestens E-Mail empfohlen)
 */
export async function setEnhancedConversionData(userData: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  country?: string;
}): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    const enhancedData: Record<string, unknown> = {};

    if (userData.email) {
      enhancedData.email = userData.email.trim().toLowerCase();
    }
    const phoneE164 = userData.phone ? toE164(userData.phone) : null;
    if (phoneE164) {
      enhancedData.phone_number = phoneE164;
    }

    // Adress-Block nur senden wenn ALLE Pflichtfelder vorhanden sind.
    // Google Ads rejected sonst die Daten mit Fehler
    // "Pflichtfelder in Adressen fehlen (Vorname, Nachname,
    // Postleitzahl und/oder Land)".
    const firstName = userData.firstName?.trim();
    const lastName = userData.lastName?.trim();
    const postalCode = userData.postalCode?.trim();
    const country = normalizeCountryCode(userData.country);

    if (firstName && lastName && postalCode && country) {
      enhancedData.address = {
        first_name: firstName,
        last_name: lastName,
        postal_code: postalCode,
        country,
      };
    }

    // Nur senden wenn mindestens ein Feld vorhanden ist
    if (Object.keys(enhancedData).length === 0) return;

    // gtag('set', 'user_data', ...) – empfohlene Methode (auto-Hashing in gtag.js)
    safeGtag('set', 'user_data', enhancedData);

    if (process.env.NODE_ENV === 'development') {
      logger.log('[GadsTracking] Enhanced Conversion Data gesetzt:', Object.keys(enhancedData));
    }

    // Microsoft Ads (Bing) — parallel, niemals blocking. UET erwartet
    // gehashte Werte explizit; setBingEnhancedConversionData kümmert sich um
    // SHA-256 + Push in die UET-Queue.
    setBingEnhancedConversionData({
      email: userData.email,
      phone: userData.phone,
    }).catch((err) => {
      // Bing-Fehler dürfen den Google-Pfad NIE beeinträchtigen
      logger.warn('[GadsTracking] Bing Enhanced Conversion (non-blocking):', err);
    });
  } catch (error) {
    logger.warn('[GadsTracking] Enhanced Conversion Data Fehler:', error);
  }
}

/**
 * Convenience: Setzt Enhanced Conversion Daten aus Formular-Feldern
 * Kann direkt vor einem Conversion-Event aufgerufen werden
 */
export async function setEnhancedConversionFromForm(formData: {
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  email?: string;
  name?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  country?: string;
}): Promise<void> {
  const email = formData.customerEmail || formData.email;
  const phone = formData.customerPhone || formData.phone;
  let firstName = formData.firstName;
  let lastName = formData.lastName;

  // Falls nur ein Name-Feld vorhanden ist, aufteilen
  if (!firstName && !lastName) {
    const fullName = formData.customerName || formData.name || '';
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  // KüchenWert vermittelt nur in Deutschland: fünfstellige PLZ → Land DE,
  // sonst verwirft Google den Adressblock der Enhanced Conversions.
  const country = formData.country ?? (/^\d{5}$/.test(formData.postalCode?.trim() ?? '') ? 'DE' : undefined);

  await setEnhancedConversionData({
    email,
    phone,
    firstName,
    lastName,
    postalCode: formData.postalCode,
    country,
  });
}
