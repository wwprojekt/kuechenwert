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

// TypeScript-Deklaration für gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Google Ads Tag ID für das CaravanWert-Konto
const GOOGLE_ADS_ID = 'AW-18033517246';

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

// Google Analytics 4 Measurement ID für das CaravanWert-Konto
const GA4_MEASUREMENT_ID = 'G-H4BCV8DS0B';

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
        console.log('[GadsTracking] Event gesendet via window.gtag:', args);
      }
      return;
    }

    // Fallback: Direkt auf dataLayer pushen
    if (window.dataLayer) {
      window.dataLayer.push(args);
      if (process.env.NODE_ENV === 'development') {
        console.log('[GadsTracking] Event gesendet via dataLayer.push:', args);
      }
      return;
    }

    console.warn('[GadsTracking] Weder window.gtag noch dataLayer verfügbar. Event verworfen:', args);
  } catch (error) {
    console.warn('[GadsTracking] Fehler beim Senden des Events:', error);
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
    const eventParams: Record<string, unknown> = {
      send_to: `${GOOGLE_ADS_ID}/${label}`,
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

// ============================================================
// CONVERSION-LABELS
// Alle Labels aus Google Ads Konto 522-100-4970
// Format: send_to = AW-18033517246/{LABEL}
// ============================================================

export const CONVERSION_LABELS = {
  // *** PRIMÄRE CONVERSIONS (für Kampagnen-Optimierung / Gebotsoptimierung) ***
  
  // Bestehende Conversion: "Bewertung abgeschlossen" – Wizard komplett durchlaufen
  BEWERTUNG_ABGESCHLOSSEN: 'GAI_CI-zrI0cEL7FhpdD',
  
  // Landing Page Lead: Kontaktdaten auf einer der 6 Google Ads Landing Pages erfasst
  LANDING_PAGE_LEAD: 'ZiKsCMmOkY4cEL7FhpdD',
  
  // Kontaktformular: /kontakt Formular abgesendet
  KONTAKTFORMULAR_GESENDET: '5RLHCN2SkY4cEL7FhpdD',
  
  // Wertermittlung: /wertermittlung Formular mit Kontaktdaten abgesendet
  WERTERMITTLUNG_LEAD: 'AHaxCPWNkY4cEL7FhpdD',
  
  // Wertrechner: /wertrechner Lead-Capture mit Kontaktdaten abgesendet
  WERTRECHNER_LEAD: 'JBEqCPiNkY4cEL7FhpdD',
  
  // Wizard Abgeschlossen: Schritt 5 (Kontaktdaten) im VerkaufenWizard abgesendet
  WIZARD_ABGESCHLOSSEN: 'JO7oCPuNkY4cEL7FhpdD',
  
  // Terminbuchung: Termin über AppointmentBookingModal gebucht
  TERMINBUCHUNG: '3_bOCP6NkY4cEL7FhpdD',
  
  // *** SEKUNDÄRE CONVERSIONS (für Beobachtung, nicht für Gebotsoptimierung) ***
  
  // Wizard Gestartet: Schritt 1 im VerkaufenWizard geladen
  WIZARD_GESTARTET: '-m3-CIGOkY4cEL7FhpdD',
  
  // Wizard Fahrzeugdaten: Schritt 2 im VerkaufenWizard erreicht (Fahrzeugdaten eingegeben)
  WIZARD_FAHRZEUGDATEN: '5BvzCISOkY4cEL7FhpdD',
} as const;

// ============================================================
// CUSTOM EVENTS (ohne Conversion-Label, nur für Remarketing/Analytics)
// ============================================================

/**
 * Seite aufgerufen - wird automatisch durch gtag config getrackt
 * Zusätzlich senden wir spezifische Seitenaufrufe für wichtige Seiten
 */
export function trackPageView(pagePath: string, pageTitle: string): void {
  safeGtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    send_to: GOOGLE_ADS_ID,
  });
}

// ============================================================
// PRIMÄRE LEAD-TRACKING EVENTS
// Jedes dieser Events löst eine primäre Conversion aus
// ============================================================

/**
 * Landing Page Lead: Kontaktdaten auf einer Google Ads Landing Page erfasst
 * Wird ausgelöst in: LandingLeadForm (alle 6 Landing Pages)
 * Primäre Conversion: Ja (für Gebotsoptimierung)
 */
export async function trackLandingPageLead(landingPage: string, vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('landing_page');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversion(CONVERSION_LABELS.LANDING_PAGE_LEAD, 10.0, txId);

  // GA4 + Google Ads: generate_lead Event (GA4 empfohlenes Event)
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: `landing_page_lead_${landingPage}`,
    value: 10.0,
    currency: 'EUR',
    lead_source: 'landing_page',
    landing_page: landingPage,
    vehicle_info: vehicleInfo || '',
  });
}

/**
 * Kontaktformular gesendet: /kontakt Formular abgesendet
 * Wird ausgelöst in: Kontakt.tsx
 * Primäre Conversion: Ja
 */
export async function trackKontaktformularGesendet(transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('kontakt');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversion(CONVERSION_LABELS.KONTAKTFORMULAR_GESENDET, 10.0, txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'kontaktformular_gesendet',
    value: 10.0,
    currency: 'EUR',
    lead_source: 'kontaktformular',
  });

  // GA4: Zusätzliches form_submit Event für detaillierte Analyse
  safeGtag('event', 'form_submit', {
    form_id: 'kontaktformular',
    form_name: 'Kontaktformular',
    form_destination: '/kontakt',
  });
}

/**
 * Wertermittlung Lead: /wertermittlung Formular mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertermittlung.tsx
 * Primäre Conversion: Ja
 */
export async function trackWertermittlungLead(vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wertermittlung');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversion(CONVERSION_LABELS.WERTERMITTLUNG_LEAD, 10.0, txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'wertermittlung_lead',
    value: 10.0,
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
}

/**
 * Wertrechner Lead: /wertrechner Lead-Capture mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertrechner.tsx
 * Primäre Conversion: Ja
 */
export async function trackWertrechnerLead(vehicleInfo?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wertrechner');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversion(CONVERSION_LABELS.WERTRECHNER_LEAD, 10.0, txId);

  // GA4 + Google Ads: generate_lead Event
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'wertrechner_lead',
    value: 10.0,
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
}

/**
 * Terminbuchung: Termin über AppointmentBookingModal gebucht
 * Wird ausgelöst in: AppointmentBookingModal.tsx
 * Primäre Conversion: Ja
 */
export async function trackTerminbuchung(station?: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('terminbuchung');
  // Google Ads Conversion (mit beacon transport für Navigation-Schutz)
  await sendConversion(CONVERSION_LABELS.TERMINBUCHUNG, 10.0, txId);

  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Lead',
    event_label: 'terminbuchung',
    value: 10.0,
    currency: 'EUR',
    lead_source: 'terminbuchung',
    station: station || '',
  });
}

// ============================================================
// WIZARD-TRACKING EVENTS
// ============================================================

/**
 * Wizard gestartet (Schritt 1 geladen)
 * Sekundäre Conversion: Für Beobachtung
 */
export function trackWizardStarted(source: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.WIZARD_GESTARTET}`,
    value: 1.0,
    currency: 'EUR',
  });

  safeGtag('event', 'begin_checkout', {
    event_category: 'Wizard',
    event_label: 'wizard_started',
    wizard_source: source,
  });

  // GA4 Zielgruppe 'Wertermittlung gestartet' verwendet dieses Event
  safeGtag('event', 'wizard_start', {
    event_category: 'Wizard',
    wizard_source: source,
  });
}

/**
 * Wizard Schritt gewechselt
 * Schritt 2 = Sekundäre Conversion (Fahrzeugdaten eingegeben)
 */
export function trackWizardStep(stepNumber: number, stepName: string): void {
  // Sekundäre Conversion: Wizard Fahrzeugdaten (Schritt 2 erreicht)
  if (stepNumber === 2) {
    safeGtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.WIZARD_FAHRZEUGDATEN}`,
      value: 1.0,
      currency: 'EUR',
    });
  }

  // Custom Event für jeden Schritt
  safeGtag('event', 'wizard_step', {
    event_category: 'Wizard',
    event_label: stepName,
    step_number: stepNumber,
    value: stepNumber,
  });
}

/**
 * Wizard vollständig abgeschlossen (Schritt 5: Kontaktdaten abgesendet)
 * PRIMÄRE CONVERSION: Wizard Abgeschlossen + Bewertung abgeschlossen
 */
export async function trackWizardCompleted(vehicleInfo: string, transactionId?: string): Promise<void> {
  const txId = transactionId || generateTransactionId('wizard');
  // Google Ads: Primäre Conversion – Wizard Abgeschlossen (mit beacon transport)
  await sendConversion(CONVERSION_LABELS.WIZARD_ABGESCHLOSSEN, 10.0, txId);

  // Google Ads: Bestehende Conversion – Bewertung abgeschlossen (mit beacon transport)
  // Eigene Transaction ID damit diese Conversion separat dedupliziert wird
  await sendConversion(CONVERSION_LABELS.BEWERTUNG_ABGESCHLOSSEN, 50.0, `${txId}_bewertung`);

  // GA4 Zielgruppe 'Wizard-Abbrecher' verwendet wizard_complete als Ausschluss
  safeGtag('event', 'wizard_complete', {
    event_category: 'Wizard',
    vehicle_info: vehicleInfo,
    value: 50.0,
    currency: 'EUR',
  });

  // GA4 + Google Ads: generate_lead Event (höchster Wert)
  safeGtag('event', 'generate_lead', {
    transaction_id: txId,
    event_category: 'Wizard',
    event_label: 'wizard_completed',
    vehicle_info: vehicleInfo,
    value: 50.0,
    currency: 'EUR',
    lead_source: 'wizard',
  });

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
 * Lead: Kontaktdaten erfasst (generisch)
 * @deprecated Verwende stattdessen die spezifischen Track-Funktionen
 * (trackLandingPageLead, trackKontaktformularGesendet, etc.)
 */
export function trackLeadContactData(source: string, vehicleInfo?: string): void {
  // Generisches Lead-Event für Abwärtskompatibilität
  // Löst die Landing Page Lead Conversion aus (als Fallback)
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.LANDING_PAGE_LEAD}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
    event_category: 'Lead',
    event_label: source,
    value: 10.0,
    currency: 'EUR',
    lead_source: source,
    vehicle_info: vehicleInfo || '',
  });
}

/**
 * Beratung angefragt (Button "Beratung vereinbaren")
 */
export function trackBeratungRequested(pagePath: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.TERMINBUCHUNG}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'schedule_consultation', {
    event_category: 'Lead',
    event_label: 'beratung_vereinbaren',
    page_path: pagePath,
  });
}

// ============================================================
// AUTH-TRACKING EVENTS
// ============================================================

/**
 * Nutzer hat sich registriert
 * Sendet ebenfalls die "Bewertung abgeschlossen" Conversion,
 * da die Registrierung Teil des Wizard-Abschlusses ist
 */
export function trackUserRegistered(method: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.BEWERTUNG_ABGESCHLOSSEN}`,
    value: 30.0,
    currency: 'EUR',
  });

  safeGtag('event', 'sign_up', {
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

/**
 * Auktion wurde erstellt
 */
export function trackAuctionCreated(vehicleInfo: string): void {
  safeGtag('event', 'auction_created', {
    event_category: 'Auction',
    event_label: vehicleInfo,
    value: 75.0,
    currency: 'EUR',
  });
}

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
    value: 5.0,
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
    value: 5.0,
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
    value: 5.0,
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

/**
 * Kontaktformular gesendet (Legacy)
 * @deprecated Verwende stattdessen trackKontaktformularGesendet()
 */
export function trackContactFormSubmitted(): void {
  trackKontaktformularGesendet();
}

// ============================================================
// UTILITY: Conversion-Labels anzeigen
// ============================================================

/**
 * Gibt die aktuellen Conversion-Labels zurück.
 */
export function getConversionLabels(): typeof CONVERSION_LABELS {
  return CONVERSION_LABELS;
}

// ============================================================
// ENHANCED CONVERSIONS
// Sendet gehashte Nutzerdaten an Google für bessere Attribution
// Besonders wichtig für Safari/ITP wo Cookies schnell verfallen
// Docs: https://support.google.com/google-ads/answer/13258081
// ============================================================

/**
 * SHA-256 Hash einer Zeichenkette (für Enhanced Conversions)
 * Google erwartet gehashte Daten im Klartext-SHA256-Format
 */
async function sha256(value: string): Promise<string> {
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
 * Setzt Enhanced Conversion Daten für Google Ads
 * Muss VOR dem Conversion-Event aufgerufen werden
 * 
 * Die Daten werden automatisch gehasht und an Google gesendet.
 * Google nutzt diese Daten um Conversions auch ohne Third-Party-Cookies
 * korrekt zuzuordnen (besonders wichtig für Safari/ITP).
 * 
 * @param userData - Nutzerdaten (mindestens E-Mail empfohlen)
 */
export async function setEnhancedConversionData(userData: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    const enhancedData: Record<string, string> = {};

    if (userData.email) {
      enhancedData.email = userData.email.trim().toLowerCase();
    }
    if (userData.phone) {
      // Normalisiere Telefonnummer: Entferne Leerzeichen, Bindestriche, Klammern
      const normalizedPhone = userData.phone.replace(/[\s\-()]/g, '');
      enhancedData.phone_number = normalizedPhone;
    }
    if (userData.firstName) {
      enhancedData.first_name = userData.firstName.trim();
    }
    if (userData.lastName) {
      enhancedData.last_name = userData.lastName.trim();
    }

    // Nur senden wenn mindestens ein Feld vorhanden ist
    if (Object.keys(enhancedData).length === 0) return;

    // Methode 1: gtag('set', 'user_data', ...) – empfohlene Methode
    safeGtag('set', 'user_data', enhancedData);

    if (process.env.NODE_ENV === 'development') {
      console.log('[GadsTracking] Enhanced Conversion Data gesetzt:', Object.keys(enhancedData));
    }
  } catch (error) {
    console.warn('[GadsTracking] Enhanced Conversion Data Fehler:', error);
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

  await setEnhancedConversionData({ email, phone, firstName, lastName });
}
