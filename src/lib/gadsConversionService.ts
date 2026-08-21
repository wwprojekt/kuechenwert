/**
 * Google Ads Conversion Tracking Service
 * 
 * Zentraler Service für alle Google Ads Conversion-Events.
 * Trackt Wizard-Schritte, Lead-Erfassungen, Formulare, Terminbuchungen und Auktionen.
 * 
 * Google Ads Konto: Caravanwert (522-100-4970)
 * Google Tag ID: AW-18033517246
 * 
 * Conversion-Strategie:
 * - PRIMÄRE Conversions: Jede Lead-Erfassung mit Kontaktdaten (für Gebotsoptimierung)
 * - SEKUNDÄRE Conversions: Zwischenschritte im Wizard (für Beobachtung)
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
 * @param leadType - Der Lead-Typ (z.B. 'wertrechner', 'kontakt')
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
 * sofortiger Navigation (z.B. zum Wizard oder zur Danke-Seite) ankommt.
 */
function sendConversion(label: string, value: number, transactionId?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    // Timeout-Fallback: Nach 1s trotzdem weiter navigieren
    const timeout = setTimeout(resolve, 1000);
    if (!isGoogleAdsEnabled()) {
      clearTimeout(timeout);
      resolve();
      return;
    }
    const eventParams: Record<string, unknown> = {
      send_to: `${getGoogleAdsId()}/${label}`,
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
// CONVERSION-LABELS (FALLBACK / SNAPSHOT)
// Diese Konstanten sind nur noch ein Fallback. Zur Laufzeit liest der
// Service die aktuellen Labels via getConversionLabel(...) aus
// site_settings.tracking_config (im Admin-Backend editierbar).
// Format: send_to = {google_ads.conversion_id}/{label}
// ============================================================

export const CONVERSION_LABELS = {
  // *** PRIMÄRE CONVERSIONS (für Kampagnen-Optimierung / Gebotsoptimierung) ***
  // WICHTIG: Nur feuern wenn ECHTE Kontaktdaten (Email/Telefon) erfasst wurden!
  
  // LEGACY – wird NICHT mehr gefeuert (erzeugte doppelte Conversion mit WIZARD_ABGESCHLOSSEN)
  // In Google Ads auf SEKUNDÄR setzen oder deaktivieren!
  BEWERTUNG_ABGESCHLOSSEN: 'GAI_CI-zrI0cEL7FhpdD',
  
  // Kontaktformular: /kontakt Formular abgesendet
  KONTAKTFORMULAR_GESENDET: 'pXp5CPKNkY4cEL7FhpdD',
  
  // Wertermittlung: /wertermittlung Formular mit Kontaktdaten abgesendet
  WERTERMITTLUNG_LEAD: 'AHaxCPWNkY4cEL7FhpdD',
  
  // Wertrechner: /wertrechner Lead-Capture mit Kontaktdaten abgesendet
  WERTRECHNER_LEAD: 'JBEqCPiNkY4cEL7FhpdD',
  
  // Wizard Abgeschlossen: Kontaktdaten im VerkaufenWizard abgesendet
  WIZARD_ABGESCHLOSSEN: 'JO7oCPuNkY4cEL7FhpdD',
  
  // Terminbuchung: Termin über AppointmentBookingModal gebucht
  TERMINBUCHUNG: '3_bOCP6NkY4cEL7FhpdD',
  
  // *** SEKUNDÄRE CONVERSIONS (für Beobachtung, nicht für Gebotsoptimierung) ***
  
  // Landing Page Funnel-Einstieg: Nutzer wählt Fahrzeugdaten auf Landing Page
  // KEIN Lead! Nur Micro-Conversion als Funnel-Einstieg
  LANDING_PAGE_LEAD: 'IfQvCO-NkY4cEL7FhpdD',
  
  // Wizard Gestartet: Schritt 1 im VerkaufenWizard geladen
  WIZARD_GESTARTET: '-m3-CIGOkY4cEL7FhpdD',
  
  // Wizard Fahrzeugdaten: Schritt 2 im VerkaufenWizard erreicht (Fahrzeugdaten eingegeben)
  WIZARD_FAHRZEUGDATEN: '5BvzCISOkY4cEL7FhpdD',
} as const;

// ============================================================
// CONVERSION-WERTE (€) – Differenziert nach Lead-Qualität
//
// Basiert auf echten Datenbank-Auswertungen:
//   - Wizard: 169 abgeschlossen → 69 zu Auktionen konvertiert (41%)
//   - Wertrechner: 360 Leads → 7 konvertiert (2%)
//
// Höhere Werte → Google Smart Bidding bietet aggressiver für diese Leads.
// Niedrigere Werte → Google spart Budget bei niedrigwertigen Leads.
// ============================================================
export const CONVERSION_VALUES = {
  // Primäre Conversions
  WIZARD_ABGESCHLOSSEN: 9.0,      // Höchster Wert: 41% konvertieren zu Auktionen
  TERMINBUCHUNG: 9.0,             // Gleichwertig: Termin = hohes Kaufinteresse
  KONTAKTFORMULAR_GESENDET: 1.0,  // Sekundär: allgemeines Kontaktformular
  WERTERMITTLUNG_LEAD: 2.5,       // Wertermittlung Lead
  WERTRECHNER_LEAD: 2.5,          // Wertrechner Lead

  // Sekundäre Conversions (Micro-Conversions, nur Beobachtung)
  LANDING_PAGE_LEAD: 1.0,
  WIZARD_GESTARTET: 1.0,
  WIZARD_FAHRZEUGDATEN: 1.0,
} as const;

// ============================================================
// CUSTOM EVENTS (ohne Conversion-Label, nur für Remarketing/Analytics)
// ============================================================

// trackPageView entfernt – page_view wird automatisch durch gtag config gesendet.
// Spezifisches Google Ads page_view war redundant und nirgends aufgerufen.

// ============================================================
// PRIMÄRE LEAD-TRACKING EVENTS
// Jedes dieser Events löst eine primäre Conversion aus
// ============================================================

/**
 * Landing Page Funnel-Einstieg: Nutzer wählt Fahrzeugdaten auf einer Landing Page.
 * SEKUNDÄRE Conversion (nur Beobachtung) – es werden KEINE Kontaktdaten erfasst.
 * Der echte Lead wird erst im Wertrechner als WERTRECHNER_LEAD getrackt.
 * Wird ausgelöst in: LandingLeadForm (alle 6 Landing Pages)
 */
export async function trackLandingPageLead(landingPage: string, vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('landing_funnel');
  // Sekundäre Conversion: Funnel-Einstieg (value: 1€, nicht 5€)
  if (isGoogleAdsEnabled()) {
    safeGtag('event', 'conversion', {
      send_to: `${getGoogleAdsId()}/${getConversionLabel('LANDING_PAGE_LEAD')}`,
      value: getConversionValue('LANDING_PAGE_LEAD'),
      currency: 'EUR',
      transaction_id: txId,
    });
  }

  // GA4: Custom Event (NICHT generate_lead – kein Lead ohne Kontaktdaten!)
  safeGtag('event', 'landing_funnel_start', {
    transaction_id: txId,
    event_category: 'Funnel',
    event_label: `landing_funnel_${landingPage}`,
    value: 1.0,
    currency: 'EUR',
    landing_page: landingPage,
    vehicle_info: vehicleInfo || '',
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('LANDING_PAGE_LEAD', 'LANDING_PAGE_LEAD', txId);
}

/**
 * Kontaktformular gesendet: /kontakt Formular abgesendet
 * Wird ausgelöst in: Kontakt.tsx
 * Primäre Conversion: Ja
 */
export async function trackKitchenFunnelLead(
  funnel: "a" | "b" | "c",
  transactionId?: string,
): Promise<void> {
  const txId = transactionId || generateTransactionId(`funnel_${funnel}`);
  await sendConversionByKey("WIZARD_ABGESCHLOSSEN", "WIZARD_ABGESCHLOSSEN", txId);

  safeGtag("event", "generate_lead", {
    transaction_id: txId,
    event_category: "Lead",
    event_label: `funnel_${funnel}`,
    value: getConversionValue("WIZARD_ABGESCHLOSSEN"),
    currency: "EUR",
    lead_source: `funnel_${funnel}`,
  });

  safeGtag("event", "form_submit", {
    form_id: `funnel_${funnel}`,
    form_name: `Küchen-Funnel ${funnel.toUpperCase()}`,
    form_destination: `/funnel/${funnel}`,
  });

  sendBingConversion("WIZARD_ABGESCHLOSSEN", "WIZARD_ABGESCHLOSSEN", txId);
}

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

/**
 * Wertermittlung Lead: /wertermittlung Formular mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertermittlung.tsx
 * Primäre Conversion: Ja
 */
export async function trackWertermittlungLead(vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wertermittlung');
  const value = getConversionValue('WERTERMITTLUNG_LEAD');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversionByKey('WERTERMITTLUNG_LEAD', 'WERTERMITTLUNG_LEAD', txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'wertermittlung_lead',
    value,
    currency: 'EUR',
    lead_source: 'wertermittlung',
    vehicle_info: vehicleInfo || '',
  });

  // GA4: form_submit Event
  safeGtag('event', 'form_submit', {
    form_id: 'wertermittlung',
    form_name: 'Wertermittlung',
    form_destination: '/wertermittlung',
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('WERTERMITTLUNG_LEAD', 'WERTERMITTLUNG_LEAD', txId);
}

/**
 * Wertrechner Lead: /wertrechner Lead-Capture mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertrechner.tsx
 * Primäre Conversion: Ja
 */
export async function trackWertrechnerLead(vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wertrechner');
  const value = getConversionValue('WERTRECHNER_LEAD');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversionByKey('WERTRECHNER_LEAD', 'WERTRECHNER_LEAD', txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'wertrechner_lead',
    value,
    currency: 'EUR',
    lead_source: 'wertrechner',
    vehicle_info: vehicleInfo || '',
  });

  // GA4: form_submit Event
  safeGtag('event', 'form_submit', {
    form_id: 'wertrechner',
    form_name: 'Wertrechner',
    form_destination: '/wertrechner',
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('WERTRECHNER_LEAD', 'WERTRECHNER_LEAD', txId);
}

/**
 * Terminbuchung: Termin über AppointmentBookingModal gebucht
 * Wird ausgelöst in: AppointmentBookingModal.tsx
 * Primäre Conversion: Ja
 */
export async function trackTerminbuchung(station?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('terminbuchung');
  const value = getConversionValue('TERMINBUCHUNG');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversionByKey('TERMINBUCHUNG', 'TERMINBUCHUNG', txId);

  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'terminbuchung',
    value,
    currency: 'EUR',
    lead_source: 'terminbuchung',
    station: station || '',
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('TERMINBUCHUNG', 'TERMINBUCHUNG', txId);
}

// ============================================================
// WIZARD-TRACKING EVENTS
// ============================================================

/**
 * Wizard gestartet (Schritt 1 geladen)
 * Sekundäre Conversion: Für Beobachtung
 */
export function trackWizardStarted(source: string): void {
  const txId = generateTransactionId('wizard_start');
  if (isGoogleAdsEnabled()) {
    safeGtag('event', 'conversion', {
      send_to: `${getGoogleAdsId()}/${getConversionLabel('WIZARD_GESTARTET')}`,
      value: getConversionValue('WIZARD_GESTARTET'),
      currency: 'EUR',
      transaction_id: txId,
    });
  }

  safeGtag('event', 'begin_checkout', {
    transaction_id: txId,
    event_category: 'Wizard',
    event_label: 'wizard_started',
    wizard_source: source,
  });

  // GA4 Zielgruppe 'Wertermittlung gestartet' verwendet dieses Event
  safeGtag('event', 'wizard_start', {
    transaction_id: txId,
    event_category: 'Wizard',
    wizard_source: source,
  });

  // Microsoft Ads (Bing) — parallel, niemals blocking
  sendBingConversion('WIZARD_GESTARTET', 'WIZARD_GESTARTET', txId);
}

/**
 * Wizard Schritt gewechselt
 * Schritt 2 = Sekundäre Conversion (Fahrzeugdaten eingegeben)
 */
export function trackWizardStep(stepNumber: number, stepName: string): void {
  const txId = generateTransactionId(`wizard_step${stepNumber}`);
  // Sekundäre Conversion: Wizard Fahrzeugdaten (Schritt 2 erreicht)
  if (stepNumber === 2 && isGoogleAdsEnabled()) {
    safeGtag('event', 'conversion', {
      send_to: `${getGoogleAdsId()}/${getConversionLabel('WIZARD_FAHRZEUGDATEN')}`,
      value: getConversionValue('WIZARD_FAHRZEUGDATEN'),
      currency: 'EUR',
      transaction_id: txId,
    });
  }

  // Custom Event für jeden Schritt
  safeGtag('event', 'wizard_step', {
    transaction_id: txId,
    event_category: 'Wizard',
    event_label: stepName,
    step_number: stepNumber,
    value: stepNumber,
  });

  // Microsoft Ads (Bing) — Schritt 2 als Mikro-Conversion (Fahrzeugdaten)
  if (stepNumber === 2) {
    sendBingConversion('WIZARD_FAHRZEUGDATEN', 'WIZARD_FAHRZEUGDATEN', txId);
  }
}

/**
 * Wizard vollständig abgeschlossen (Schritt 5: Kontaktdaten abgesendet)
 * PRIMÄRE CONVERSION: Nur WIZARD_ABGESCHLOSSEN (eine Conversion pro Lead)
 *
 * BEWERTUNG_ABGESCHLOSSEN wurde entfernt – es erzeugte eine doppelte Conversion.
 * Conversion-Werte sind jetzt nach Lead-Qualität differenziert (siehe CONVERSION_VALUES).
 */
export async function trackWizardCompleted(vehicleInfo: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wizard');
  const value = getConversionValue('WIZARD_ABGESCHLOSSEN');
  // Google Ads: Primäre Conversion – Wizard Abgeschlossen (mit beacon transport)
  await sendConversionByKey('WIZARD_ABGESCHLOSSEN', 'WIZARD_ABGESCHLOSSEN', txId);

  // GA4 Zielgruppe 'Wizard-Abbrecher' verwendet wizard_complete als Ausschluss
  safeGtag('event', 'wizard_complete', {
    event_category: 'Wizard',
    vehicle_info: vehicleInfo,
    value,
    currency: 'EUR',
  });

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Wizard',
    event_label: 'wizard_completed',
    vehicle_info: vehicleInfo,
    value,
    currency: 'EUR',
    lead_source: 'wizard',
  });

  // Microsoft Ads (Bing) — primäre Conversion, parallel und niemals blocking
  sendBingConversion('WIZARD_ABGESCHLOSSEN', 'WIZARD_ABGESCHLOSSEN', txId);
}

/**
 * Wizard abgebrochen
 */
export function trackWizardAbandoned(stepNumber: number, stepName: string): void {
  safeGtag('event', 'wizard_abandoned', {
    event_category: 'Wizard',
    event_label: `abbruch_schritt_${stepNumber}`,
    step_number: stepNumber,
    step_name: stepName,
  });
}

// ============================================================
// LEGACY FUNKTIONEN (Abwärtskompatibilität)
// ============================================================

/**
 * Ankaufstation-Anfrage: Fahrzeuganfrage über /ankaufstationen gesendet.
 * NICHT als TERMINBUCHUNG tracken – das ist eine Fahrzeuganfrage, kein Termin.
 * Custom Event für GA4 Analyse.
 */
export function trackBeratungRequested(pagePath: string): void {
  const txId = generateTransactionId('ankaufstation');
  // Custom Event (KEINE Conversion – separate Ankauf-Analyse in GA4)
  safeGtag('event', 'purchase_inquiry', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'ankaufstation_anfrage',
    page_path: pagePath,
    value: 1.0,
    currency: 'EUR',
  });
}

// ============================================================
// AUTH-TRACKING EVENTS
// ============================================================

/**
 * Nutzer hat sich registriert.
 * NUR sign_up Event – KEINE Conversion!
 * Registrierungen sind kein Lead (erst Wizard-Abschluss = Lead).
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
// AUKTIONS-TRACKING EVENTS
// ============================================================

// trackAuctionCreated entfernt – war dead code (nirgends aufgerufen).

// ============================================================
// CTA-KLICK-TRACKING (Telefon, WhatsApp, E-Mail)
// Wichtig für Lead-Gen: Jeder Kontaktkanal muss getrackt werden
// ============================================================

/**
 * Telefon-Klick: Nutzer klickt auf Telefonnummer
 * Wird als GA4 Event + Google Ads Conversion getrackt
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
 * (z.B. "Jetzt bewerten", "Kostenlos anfragen")
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
// REMARKETING EVENTS
// ============================================================

/**
 * Fahrzeug angesehen (für Remarketing)
 */
export function trackVehicleViewed(vehicleId: string, vehicleInfo: string): void {
  safeGtag('event', 'view_item', {
    event_category: 'Vehicle',
    event_label: vehicleInfo,
    items: [{
      id: vehicleId,
      name: vehicleInfo,
      category: 'Wohnmobil',
    }],
  });
}

// trackContactFormSubmitted entfernt – war deprecated dead code.
// trackLeadContactData entfernt – war deprecated dead code.

// ============================================================
// UTILITY: Conversion-Labels anzeigen
// ============================================================

/**
 * Gibt die aktuellen Conversion-Labels zurück.
 * Liest jetzt aus der dynamischen Tracking-Config (Admin-Backend), mit Fallback
 * auf die statischen CONVERSION_LABELS.
 */
export function getConversionLabels(): typeof CONVERSION_LABELS {
  return {
    BEWERTUNG_ABGESCHLOSSEN: getConversionLabel('BEWERTUNG_ABGESCHLOSSEN'),
    KONTAKTFORMULAR_GESENDET: getConversionLabel('KONTAKTFORMULAR_GESENDET'),
    WERTERMITTLUNG_LEAD: getConversionLabel('WERTERMITTLUNG_LEAD'),
    WERTRECHNER_LEAD: getConversionLabel('WERTRECHNER_LEAD'),
    WIZARD_ABGESCHLOSSEN: getConversionLabel('WIZARD_ABGESCHLOSSEN'),
    TERMINBUCHUNG: getConversionLabel('TERMINBUCHUNG'),
    LANDING_PAGE_LEAD: getConversionLabel('LANDING_PAGE_LEAD'),
    WIZARD_GESTARTET: getConversionLabel('WIZARD_GESTARTET'),
    WIZARD_FAHRZEUGDATEN: getConversionLabel('WIZARD_FAHRZEUGDATEN'),
  } as typeof CONVERSION_LABELS;
}

// ============================================================
// ENHANCED CONVERSIONS
// Sendet gehashte Nutzerdaten an Google für bessere Attribution
// Besonders wichtig für Safari/ITP wo Cookies schnell verfallen
// Docs: https://support.google.com/google-ads/answer/13258081
// ============================================================

/**
 * SHA-256 Hash einer Zeichenkette (für Enhanced Conversions)
 * Google erwartet gehashte Daten im Klartext-SHA256-Format.
 * Aktuell ungenutzt — gtag.js handhabt das Hashing automatisch — aber
 * absichtlich behalten als Fallback, falls wir Enhanced Conversions
 * irgendwann wieder ohne gtag.js senden müssen.
 */
async function _sha256(value: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
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
    if (userData.phone) {
      // gtag.js entfernt zwar selbst Formatierungs-Zeichen, sicherheitshalber
      // bereinigen wir Leerzeichen, Bindestriche, Klammern etc.
      enhancedData.phone_number = userData.phone.replace(/[\s\-()]/g, '');
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

  await setEnhancedConversionData({
    email,
    phone,
    firstName,
    lastName,
    postalCode: formData.postalCode,
    country: formData.country,
  });
}
