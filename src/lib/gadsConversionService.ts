/**
 * Google Ads Conversion Tracking Service
 * 
 * Zentraler Service für alle Google Ads Conversion-Events.
 * Trackt Wizard-Schritte, Lead-Erfassungen, Registrierungen und Auktionen.
 * 
 * DEAKTIVIERT: Altes Google Ads Konto (AW-17744584461) wurde entfernt.
 * Neues separates CaravanWert-Konto wird erstellt.
 * Sobald das neue Konto bereit ist, hier die neue AW-ID eintragen.
 * 
 * Google Tag ID: NEUES_KONTO_HIER_EINTRAGEN
 */

// TypeScript-Deklaration für gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Hilfsfunktion: gtag sicher aufrufen
// DEAKTIVIERT bis neues Google Ads Konto eingerichtet ist
function safeGtag(..._args: unknown[]): void {
  // No-Op: Google Ads Tracking ist deaktiviert
  // Sobald das neue Konto erstellt ist, diese Funktion wieder aktivieren:
  // try {
  //   if (typeof window !== 'undefined' && window.gtag) {
  //     window.gtag(..._args);
  //   }
  // } catch (error) {
  //   console.warn('[GadsTracking] Fehler beim Senden des Events:', error);
  // }
  return;
}

// ============================================================
// CONVERSION-LABELS
// Diese Labels werden in Google Ads unter Conversions erstellt
// und hier als Konstanten hinterlegt.
// Format: AW-XXXXXXX/YYYYYYY
// ============================================================

export const CONVERSION_LABELS = {
  // *** PRIMÄRE CONVERSION (für Kampagnen-Optimierung) ***
  // Registrierung nach Schritt 10 im Wizard = Hauptziel der Kampagne
  USER_REGISTERED: '',  // DEAKTIVIERT - Altes Label: 'PrcJCNunko0cEI2-o41C' (altes Konto)
  
  // Sekundäre Conversions (für Beobachtung, nicht für Optimierung)
  LEAD_CONTACT_DATA: '',       // Lead: Kontaktdaten erfasst (Modal/Formular)
  WIZARD_STARTED: '',          // Wizard gestartet (Schritt 1)
  WIZARD_STEP_3: '',           // Wizard Schritt 3 erreicht (50% Fortschritt)
  WIZARD_STEP_6: '',           // Wizard Schritt 6 erreicht (Fotos)
  WIZARD_COMPLETED: '',        // Wizard vollständig abgeschlossen (nach Auth)
  AUCTION_CREATED: '',         // Auktion wurde erstellt
  BERATUNG_REQUESTED: '',      // Beratung angefragt
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
    send_to: 'AW-17744584461',
  });
}

// ============================================================
// LEAD-TRACKING EVENTS
// ============================================================

/**
 * Lead: Kontaktdaten erfasst (Name, E-Mail, Telefon)
 * Dies ist die WICHTIGSTE Conversion für die Kampagne.
 * Wird ausgelöst wenn:
 * - Nutzer das Kontaktdaten-Modal ausfüllt
 * - Nutzer das QuickAuctionForm Schritt 2 ausfüllt
 * - Nutzer das LandingLeadForm ausfüllt
 */
export function trackLeadContactData(source: string, vehicleInfo?: string): void {
  // Google Ads Conversion Event
  safeGtag('event', 'conversion', {
    send_to: `AW-17744584461${CONVERSION_LABELS.LEAD_CONTACT_DATA ? '/' + CONVERSION_LABELS.LEAD_CONTACT_DATA : ''}`,
    value: 25.0,
    currency: 'EUR',
  });

  // Custom Event für detailliertes Tracking
  safeGtag('event', 'generate_lead', {
    event_category: 'Lead',
    event_label: source,
    value: 25.0,
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
    send_to: `AW-17744584461${CONVERSION_LABELS.BERATUNG_REQUESTED ? '/' + CONVERSION_LABELS.BERATUNG_REQUESTED : ''}`,
    value: 15.0,
    currency: 'EUR',
  });

  safeGtag('event', 'schedule_consultation', {
    event_category: 'Lead',
    event_label: 'beratung_vereinbaren',
    page_path: pagePath,
  });
}

// ============================================================
// WIZARD-TRACKING EVENTS
// ============================================================

/**
 * Wizard gestartet (Schritt 1 geladen)
 */
export function trackWizardStarted(source: string): void {
  safeGtag('event', 'conversion', {
    send_to: `AW-17744584461${CONVERSION_LABELS.WIZARD_STARTED ? '/' + CONVERSION_LABELS.WIZARD_STARTED : ''}`,
    value: 5.0,
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
 */
export function trackWizardStep(stepNumber: number, stepName: string): void {
  // Spezielle Conversion-Events für wichtige Meilensteine
  if (stepNumber === 3 && CONVERSION_LABELS.WIZARD_STEP_3) {
    safeGtag('event', 'conversion', {
      send_to: `AW-17744584461/${CONVERSION_LABELS.WIZARD_STEP_3}`,
      value: 10.0,
      currency: 'EUR',
    });
  }

  if (stepNumber === 6 && CONVERSION_LABELS.WIZARD_STEP_6) {
    safeGtag('event', 'conversion', {
      send_to: `AW-17744584461/${CONVERSION_LABELS.WIZARD_STEP_6}`,
      value: 15.0,
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
 * Wizard vollständig abgeschlossen
 */
export function trackWizardCompleted(vehicleInfo: string): void {
  safeGtag('event', 'conversion', {
    send_to: `AW-17744584461${CONVERSION_LABELS.WIZARD_COMPLETED ? '/' + CONVERSION_LABELS.WIZARD_COMPLETED : ''}`,
    value: 50.0,
    currency: 'EUR',
  });

  safeGtag('event', 'purchase', {
    event_category: 'Wizard',
    event_label: 'wizard_completed',
    vehicle_info: vehicleInfo,
    value: 50.0,
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
// AUTH-TRACKING EVENTS
// ============================================================

/**
 * Nutzer hat sich registriert
 */
export function trackUserRegistered(method: string): void {
  safeGtag('event', 'conversion', {
    send_to: `AW-17744584461${CONVERSION_LABELS.USER_REGISTERED ? '/' + CONVERSION_LABELS.USER_REGISTERED : ''}`,
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
  safeGtag('event', 'conversion', {
    send_to: `AW-17744584461${CONVERSION_LABELS.AUCTION_CREATED ? '/' + CONVERSION_LABELS.AUCTION_CREATED : ''}`,
    value: 75.0,
    currency: 'EUR',
  });

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
 * Kontaktformular gesendet
 */
export function trackContactFormSubmitted(): void {
  safeGtag('event', 'contact_form_submit', {
    event_category: 'Contact',
    event_label: 'kontaktformular',
  });
}

// ============================================================
// UTILITY: Conversion-Labels aktualisieren
// Wird aufgerufen sobald die Labels in Google Ads erstellt wurden
// ============================================================

/**
 * Aktualisiert die Conversion-Labels nachdem sie in Google Ads erstellt wurden.
 * Die Labels werden als Konstanten oben im File gespeichert.
 * 
 * Beispiel: Nach Erstellung in Google Ads:
 * LEAD_CONTACT_DATA: 'AbCdEfGhIjKlMn'
 */
export function getConversionLabels(): typeof CONVERSION_LABELS {
  return CONVERSION_LABELS;
}
