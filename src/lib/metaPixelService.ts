/**
 * Meta Pixel (Facebook Pixel) Tracking Service
 * 
 * Zentraler Service fuer alle Meta Pixel Events auf kuechenwert24.de.
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
 * - InitiateCheckout: Erste Antwort in einem Funnel (A, B, C)
 * - Lead: Küchenanfrage mit Kontaktdaten abgeschickt (Funnel A, B, C)
 * - CompleteRegistration: Nutzer- oder Studio-Registrierung abgeschlossen
 * - Contact: Kontaktformular abgesendet
 * - SubmitApplication: Studio-Bewerbung eingereicht
 * 
 * Custom Events:
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
    console.error('[MetaPixel] Fehler beim Senden des Events:', error);
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
    console.error('[MetaPixel] Fehler bei Consent-Grant:', error);
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
    console.error('[MetaPixel] Fehler bei Consent-Revoke:', error);
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
    console.error('[MetaPixel] Fehler bei Consent-Listener-Init:', error);
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
 * - Abgeschickter Küchenanfrage in Funnel A, B und C
 */
export function trackMetaLead(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  safeFbq('track', 'Lead', {
    content_name: params?.content_name || 'Küchen-Lead',
    content_category: params?.content_category || 'Küche',
    value: params?.value || 0,
    currency: params?.currency || 'EUR',
  });
}

/**
 * InitiateCheckout - Küchenanfrage begonnen (erste Antwort in Funnel A, B oder C).
 */
export function trackMetaInitiateCheckout(params: { content_name: string; content_category: string }): void {
  safeFbq('track', 'InitiateCheckout', {
    content_name: params.content_name,
    content_category: params.content_category,
    currency: 'EUR',
  });
}

/**
 * CompleteRegistration - Registrierung abgeschlossen.
 * Wird ausgeloest bei:
 * - Studio-Registrierung
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
 * SubmitApplication - Bewerbung eingereicht.
 * Wird ausgeloest bei:
 * - Studio-Bewerbung (Registrierung als Küchenstudio)
 */
export function trackMetaSubmitApplication(params?: {
  content_name?: string;
}): void {
  safeFbq('track', 'SubmitApplication', {
    content_name: params?.content_name || 'Studio-Bewerbung',
  });
}

// ============================================================
// CUSTOM EVENTS (KüchenWert-spezifisch)
// ============================================================

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
