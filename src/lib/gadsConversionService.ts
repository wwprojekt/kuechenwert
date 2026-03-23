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

// Hilfsfunktion: gtag sicher aufrufen
function safeGtag(...args: unknown[]): void {
  try {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag(...args);
    }
  } catch (error) {
    console.warn('[GadsTracking] Fehler beim Senden des Events:', error);
  }
}

// ============================================================
// CONVERSION-LABELS
// Alle Labels aus Google Ads Konto 522-100-4970
// Format: send_to = AW-18033517246/{LABEL}
// ============================================================

export const CONVERSION_LABELS = {
  // *** PRIMÄRE CONVERSIONS (für Kampagnen-Optimierung / Gebotsoptimierung) ***
  
  // Bestehende Conversion: "Bewertung abgeschlossen" – Wizard komplett durchlaufen
  BEWERTUNG_ABGESCHLOSSEN: 'GAI_CI-zrI0cEL7FhpgD',
  
  // Landing Page Lead: Kontaktdaten auf einer der 6 Google Ads Landing Pages erfasst
  LANDING_PAGE_LEAD: 'IfQvCO-NkY4cEL7FhpdD',
  
  // Kontaktformular: /kontakt Formular abgesendet
  KONTAKTFORMULAR_GESENDET: 'pXp5CPKNkY4cEL7FhpdD',
  
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
export function trackLandingPageLead(landingPage: string, vehicleInfo?: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.LANDING_PAGE_LEAD}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
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
export function trackKontaktformularGesendet(): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.KONTAKTFORMULAR_GESENDET}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
    event_category: 'Lead',
    event_label: 'kontaktformular_gesendet',
    value: 10.0,
    currency: 'EUR',
    lead_source: 'kontaktformular',
  });
}

/**
 * Wertermittlung Lead: /wertermittlung Formular mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertermittlung.tsx
 * Primäre Conversion: Ja
 */
export function trackWertermittlungLead(vehicleInfo?: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.WERTERMITTLUNG_LEAD}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
    event_category: 'Lead',
    event_label: 'wertermittlung_lead',
    value: 10.0,
    currency: 'EUR',
    lead_source: 'wertermittlung',
    vehicle_info: vehicleInfo || '',
  });
}

/**
 * Wertrechner Lead: /wertrechner Lead-Capture mit Kontaktdaten abgesendet
 * Wird ausgelöst in: Wertrechner.tsx
 * Primäre Conversion: Ja
 */
export function trackWertrechnerLead(vehicleInfo?: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.WERTRECHNER_LEAD}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
    event_category: 'Lead',
    event_label: 'wertrechner_lead',
    value: 10.0,
    currency: 'EUR',
    lead_source: 'wertrechner',
    vehicle_info: vehicleInfo || '',
  });
}

/**
 * Terminbuchung: Termin über AppointmentBookingModal gebucht
 * Wird ausgelöst in: AppointmentBookingModal.tsx
 * Primäre Conversion: Ja
 */
export function trackTerminbuchung(station?: string): void {
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.TERMINBUCHUNG}`,
    value: 10.0,
    currency: 'EUR',
  });

  safeGtag('event', 'generate_lead', {
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
export function trackWizardCompleted(vehicleInfo: string): void {
  // Primäre Conversion: Wizard Abgeschlossen
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.WIZARD_ABGESCHLOSSEN}`,
    value: 10.0,
    currency: 'EUR',
  });

  // Bestehende Conversion: Bewertung abgeschlossen
  safeGtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABELS.BEWERTUNG_ABGESCHLOSSEN}`,
    value: 50.0,
    currency: 'EUR',
  });

  safeGtag('event', 'purchase', {
    event_category: 'Wizard',
    event_label: 'wizard_completed',
    vehicle_info: vehicleInfo,
    value: 10.0,
    currency: 'EUR',
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
