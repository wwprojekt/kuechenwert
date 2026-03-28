/**
 * Meta Pixel (Facebook Pixel) Tracking Service
 * 
 * Zentraler Service fuer alle Meta Pixel Events auf CaravanWert.de.
 * DSGVO-konform: Pixel wird erst aktiviert wenn Marketing-Consent erteilt wird.
 * 
 * Meta Pixel ID: 1846623132710484
 * 
 * Architektur:
 * - index.html: Laedt fbevents.js und initialisiert Pixel mit fbq('consent','revoke')
 * - Dieser Service: Steuert Consent-Grant/Revoke und sendet Events
 * - CookieBanner.tsx: Dispatcht 'consent-updated' Event bei Consent-Aenderung
 * 
 * Standard-Events (Meta-definiert):
 * - PageView: Automatisch bei Consent-Grant + Route-Wechsel
 * - Lead: Kontaktdaten erfasst (Wizard, Kontaktformular, Wertrechner, etc.)
 * - CompleteRegistration: Haendler-Registrierung abgeschlossen
 * - Contact: Kontaktformular abgesendet
 * - Schedule: Termin gebucht
 * - ViewContent: Auktionsdetail / Fahrzeugseite angesehen
 * - Search: Fahrzeugsuche durchgefuehrt
 * - InitiateCheckout: Wizard gestartet (Verkaufsprozess begonnen)
 * - SubmitApplication: Haendler-Bewerbung eingereicht
 * 
 * Custom Events:
 * - WizardStep: Wizard-Fortschritt (Schritt 1-5)
 * - WertrechnerCompleted: Wertrechner-Bewertung abgeschlossen
 * - NewsletterSignup: Newsletter-Anmeldung
 * - PhoneClick: Telefonnummer angeklickt
 * - WhatsAppClick: WhatsApp-Button angeklickt
 */

import { logger } from '@/lib/logger';
import { hasMarketingConsent } from '@/components/CookieBanner';

// TypeScript-Deklaration fuer fbq
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

// ============================================================
// CONSENT MANAGEMENT
// ============================================================

let consentGranted = false;

/**
 * Prueft ob fbq verfuegbar ist und Consent erteilt wurde.
 * Gibt true zurueck wenn Events gesendet werden duerfen.
 */
function canTrack(): boolean {
  return consentGranted && typeof window !== 'undefined' && typeof window.fbq === 'function';
}

/**
 * Sicherer fbq-Aufruf mit Consent-Pruefung und Error-Handling.
 */
function safeFbq(...args: unknown[]): void {
  try {
    if (!canTrack()) return;
    window.fbq!(...args);
    if (process.env.NODE_ENV === 'development') {
      logger.log('[MetaPixel] Event gesendet:', args);
    }
  } catch (error) {
    console.warn('[MetaPixel] Fehler beim Senden des Events:', error);
  }
}

/**
 * Aktiviert das Meta Pixel (nach Marketing-Consent).
 * Sendet fbq('consent','grant') und trackt den initialen PageView.
 */
export function grantMetaPixelConsent(): void {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    
    window.fbq('consent', 'grant');
    consentGranted = true;
    
    // Initialen PageView senden
    window.fbq('track', 'PageView');
    
    logger.log('[MetaPixel] Consent erteilt, Pixel aktiviert');
  } catch (error) {
    console.warn('[MetaPixel] Fehler bei Consent-Grant:', error);
  }
}

/**
 * Deaktiviert das Meta Pixel (nach Consent-Widerruf).
 * Sendet fbq('consent','revoke') - keine weiteren Events werden gesendet.
 */
export function revokeMetaPixelConsent(): void {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    
    window.fbq('consent', 'revoke');
    consentGranted = false;
    
    logger.log('[MetaPixel] Consent widerrufen, Pixel deaktiviert');
  } catch (error) {
    console.warn('[MetaPixel] Fehler bei Consent-Revoke:', error);
  }
}

/**
 * Initialisiert den Consent-Listener.
 * Wird einmalig beim App-Start aufgerufen.
 * 
 * Hoert auf:
 * 1. Gespeicherten Consent aus localStorage (wiederkehrende Nutzer)
 * 2. 'consent-updated' Custom Event (neue Consent-Entscheidung)
 */
export function initMetaPixelConsentListener(): void {
  try {
    if (typeof window === 'undefined') return;

    // 1. Gespeicherten Consent pruefen (wiederkehrende Nutzer)
    if (hasMarketingConsent()) {
      grantMetaPixelConsent();
    }

    // 2. Auf Consent-Aenderungen hoeren
    window.addEventListener('consent-updated', ((event: CustomEvent) => {
      const consent = event.detail;
      if (consent?.marketing === true) {
        grantMetaPixelConsent();
      } else {
        revokeMetaPixelConsent();
      }
    }) as EventListener);

    logger.log('[MetaPixel] Consent-Listener initialisiert');
  } catch (error) {
    console.warn('[MetaPixel] Fehler bei Consent-Listener-Init:', error);
  }
}

// ============================================================
// STANDARD EVENTS (Meta-definierte Events)
// ============================================================

/**
 * PageView - Seitenaufruf tracken.
 * Wird automatisch bei Route-Wechsel aufgerufen (wenn Consent erteilt).
 */
export function trackMetaPageView(): void {
  safeFbq('track', 'PageView');
}

/**
 * Lead - Kontaktdaten erfasst.
 * Wird ausgeloest bei:
 * - Wizard Schritt 5 (Kontaktdaten eingegeben)
 * - Wertrechner Lead-Capture
 * - Wertermittlung Formular
 * - Landing Page Lead-Formulare
 * - Quick Auction Form (Homepage)
 */
export function trackMetaLead(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'Lead', {
    content_name: params?.content_name || 'Fahrzeug-Lead',
    content_category: params?.content_category || 'Wohnmobil',
    value: params?.value || 0,
    currency: params?.currency || 'EUR',
  });
}

/**
 * CompleteRegistration - Registrierung abgeschlossen.
 * Wird ausgeloest bei:
 * - Haendler-Registrierung
 * - Nutzer-Registrierung
 */
export function trackMetaCompleteRegistration(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'CompleteRegistration', {
    content_name: params?.content_name || 'Nutzer-Registrierung',
    value: params?.value || 0,
    currency: params?.currency || 'EUR',
  });
}

/**
 * Contact - Kontaktaufnahme.
 * Wird ausgeloest bei:
 * - Kontaktformular abgesendet
 */
export function trackMetaContact(): void {
  safeFbq('track', 'Contact');
}

/**
 * Schedule - Termin gebucht.
 * Wird ausgeloest bei:
 * - Ankaufstation-Termin gebucht
 */
export function trackMetaSchedule(params?: {
  content_name?: string;
}): void {
  safeFbq('track', 'Schedule', {
    content_name: params?.content_name || 'Ankaufstation-Termin',
  });
}

/**
 * ViewContent - Inhalt angesehen.
 * Wird ausgeloest bei:
 * - Auktionsdetail-Seite geoeffnet
 * - Fahrzeugseite angesehen
 */
export function trackMetaViewContent(params?: {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'ViewContent', {
    content_name: params?.content_name || '',
    content_category: params?.content_category || 'Wohnmobil',
    content_ids: params?.content_ids || [],
    content_type: params?.content_type || 'vehicle',
    value: params?.value || 0,
    currency: params?.currency || 'EUR',
  });
}

/**
 * Search - Suche durchgefuehrt.
 * Wird ausgeloest bei:
 * - Fahrzeugsuche / Filter auf /kaufen
 */
export function trackMetaSearch(params?: {
  search_string?: string;
  content_category?: string;
}): void {
  safeFbq('track', 'Search', {
    search_string: params?.search_string || '',
    content_category: params?.content_category || 'Wohnmobil',
  });
}

/**
 * InitiateCheckout - Verkaufsprozess gestartet.
 * Wird ausgeloest bei:
 * - Wizard gestartet (Schritt 1 geladen)
 */
export function trackMetaInitiateCheckout(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  num_items?: number;
}): void {
  safeFbq('track', 'InitiateCheckout', {
    content_name: params?.content_name || 'Verkaufs-Wizard',
    content_category: params?.content_category || 'Wohnmobil',
    value: params?.value || 0,
    currency: params?.currency || 'EUR',
    num_items: params?.num_items || 1,
  });
}

/**
 * SubmitApplication - Bewerbung eingereicht.
 * Wird ausgeloest bei:
 * - Haendler-Bewerbung / Dealer Onboarding
 */
export function trackMetaSubmitApplication(params?: {
  content_name?: string;
}): void {
  safeFbq('track', 'SubmitApplication', {
    content_name: params?.content_name || 'Haendler-Bewerbung',
  });
}

// ============================================================
// CUSTOM EVENTS (CaravanWert-spezifisch)
// ============================================================

/**
 * Custom Event: Wizard-Schritt erreicht.
 * Trackt den Fortschritt im Verkaufs-Wizard.
 */
export function trackMetaWizardStep(step: number, stepName?: string): void {
  safeFbq('trackCustom', 'WizardStep', {
    step_number: step,
    step_name: stepName || `Schritt ${step}`,
  });
}

/**
 * Custom Event: Wertrechner abgeschlossen.
 * Wird ausgeloest wenn die KI-Bewertung angezeigt wird.
 */
export function trackMetaWertrechnerCompleted(params?: {
  vehicle_type?: string;
  manufacturer?: string;
  estimated_value?: number;
}): void {
  safeFbq('trackCustom', 'WertrechnerCompleted', {
    vehicle_type: params?.vehicle_type || '',
    manufacturer: params?.manufacturer || '',
    estimated_value: params?.estimated_value || 0,
    currency: 'EUR',
  });
}

/**
 * Custom Event: Newsletter-Anmeldung.
 */
export function trackMetaNewsletterSignup(): void {
  safeFbq('trackCustom', 'NewsletterSignup');
}

/**
 * Custom Event: Telefonnummer angeklickt.
 */
export function trackMetaPhoneClick(): void {
  safeFbq('trackCustom', 'PhoneClick');
}

/**
 * Custom Event: WhatsApp-Button angeklickt.
 */
export function trackMetaWhatsAppClick(): void {
  safeFbq('trackCustom', 'WhatsAppClick');
}

/**
 * Custom Event: CTA-Button angeklickt.
 */
export function trackMetaCTAClick(ctaName: string, pagePath?: string): void {
  safeFbq('trackCustom', 'CTAClick', {
    cta_name: ctaName,
    page_path: pagePath || (typeof window !== 'undefined' ? window.location.pathname : ''),
  });
}
