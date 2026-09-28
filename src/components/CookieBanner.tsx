import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Cookie, Settings, Shield, BarChart3, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

/**
 * DSGVO-Compliant Cookie Consent Types
 */
export interface CookieConsent {
  essential: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  consentId: string;
  consentVersion: string;
  timestamp: number;
}

const CONSENT_VERSION = '1.0';
const CONSENT_STORAGE_KEY = 'cookie-consent';

/**
 * Generate unique consent ID
 */
const generateConsentId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Get stored consent from localStorage
 */
export const getStoredConsent = (): CookieConsent | null => {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      const consent = JSON.parse(stored) as CookieConsent;
      // Validate consent version
      if (consent.consentVersion === CONSENT_VERSION) {
        return consent;
      }
    }
  } catch (e) {
    logger.error('Failed to parse stored consent:', e);
  }
  return null;
};

/**
 * Check if analytics consent is given
 */
export const hasAnalyticsConsent = (): boolean => {
  const consent = getStoredConsent();
  return consent?.analytics === true;
};

/**
 * Check if marketing consent is given
 */
export const hasMarketingConsent = (): boolean => {
  const consent = getStoredConsent();
  return consent?.marketing === true;
};

/**
 * Get consent ID
 */
export const getConsentId = (): string | null => {
  const consent = getStoredConsent();
  return consent?.consentId || null;
};

/**
 * GDPR-Compliant Cookie Consent Banner
 * 
 * Features:
 * - Granular consent options (Essential, Functional, Analytics, Marketing)
 * - Non-blocking bottom banner
 * - Bot detection to skip for crawlers
 * - Cross-domain cookie support
 * - DSGVO compliant - no tracking before consent
 */
const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
    consentId: '',
    consentVersion: CONSENT_VERSION,
    timestamp: 0,
  });

  useEffect(() => {
    // Bot detection - don't show banner to crawlers
    const isBot = /bot|crawler|spider|googlebot|adsbot|bingbot|slurp|duckduckbot/i.test(
      navigator.userAgent
    );

    if (isBot) {
      logger.log('Bot detected, skipping cookie banner');
      return;
    }

    // Check if user has already consented
    const storedConsent = getStoredConsent();
    if (storedConsent) {
      // WICHTIG: Gespeicherten Consent erneut an Google Consent Mode senden!
      // consent('default') in index.html setzt alles auf 'denied'.
      // Wir müssen den gespeicherten Consent als 'update' senden,
      // damit wiederkehrende Nutzer korrekt getrackt werden.
      if (typeof window !== 'undefined' && (window as any).gtag) {
        // WICHTIG: Bei Marketing-Consent ads_data_redaction auf false setzen,
        // damit Google Ads Click-IDs (gclid, _gcl_aw) korrekt weitergegeben werden.
        // Ohne dies werden Click-IDs auch bei granted consent blockiert!
        if (storedConsent.marketing) {
          (window as any).gtag('set', 'ads_data_redaction', false);
        }
        (window as any).gtag('consent', 'update', {
          analytics_storage: storedConsent.analytics ? 'granted' : 'denied',
          ad_storage: storedConsent.marketing ? 'granted' : 'denied',
          ad_user_data: storedConsent.marketing ? 'granted' : 'denied',
          ad_personalization: storedConsent.marketing ? 'granted' : 'denied',
          functionality_storage: storedConsent.functional ? 'granted' : 'denied',
          personalization_storage: storedConsent.functional ? 'granted' : 'denied',
        });
        logger.log('Restored consent from localStorage:', storedConsent);
      }
      // Banner nicht anzeigen - Nutzer hat bereits zugestimmt
      return;
    }

    // Neuer Nutzer: Banner anzeigen
    // Initialize with new consent ID
    setConsent(prev => ({
      ...prev,
      consentId: generateConsentId(),
    }));
    // Delay showing banner slightly for better UX
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const saveConsent = useCallback((newConsent: CookieConsent) => {
    const finalConsent = {
      ...newConsent,
      timestamp: Date.now(),
    };

    // Store in localStorage
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(finalConsent));

    // Set cross-domain cookie (for multi-subdomain setups)
    const domain = window.location.hostname.includes('localhost') 
      ? '' 
      : `.${window.location.hostname.split('.').slice(-2).join('.')}`;
    
    const cookieOptions = `path=/; max-age=31536000; SameSite=Lax${domain ? `; domain=${domain}` : ''}${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    document.cookie = `consent_id=${finalConsent.consentId}; ${cookieOptions}`;
    document.cookie = `consent_analytics=${finalConsent.analytics}; ${cookieOptions}`;
    document.cookie = `consent_marketing=${finalConsent.marketing}; ${cookieOptions}`;

    // Update Google Consent Mode v2 basierend auf tatsächlicher Nutzerwahl
    if (typeof window !== 'undefined' && (window as any).gtag) {
      // WICHTIG: Bei Marketing-Consent ads_data_redaction auf false setzen,
      // damit Google Ads Click-IDs (gclid, _gcl_aw) korrekt weitergegeben werden.
      // Bei denied consent bleibt ads_data_redaction=true (Datenschutz).
      (window as any).gtag('set', 'ads_data_redaction', !newConsent.marketing);
      (window as any).gtag('consent', 'update', {
        analytics_storage: newConsent.analytics ? 'granted' : 'denied',
        ad_storage: newConsent.marketing ? 'granted' : 'denied',
        ad_user_data: newConsent.marketing ? 'granted' : 'denied',
        ad_personalization: newConsent.marketing ? 'granted' : 'denied',
        functionality_storage: newConsent.functional ? 'granted' : 'denied',
        personalization_storage: newConsent.functional ? 'granted' : 'denied',
      });
    }

    // Dispatch event for analytics service to react
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: finalConsent }));

    // DSGVO: Einwilligung serverseitig in cookie_consent Tabelle speichern.
    // Fire-and-forget – darf die UX nicht blockieren.
    //
    // WICHTIG: Plain INSERT statt UPSERT. Der UPSERT-Pfad (ON CONFLICT DO UPDATE)
    // prüft auch im Insert-Fall die UPDATE-RLS-Policy, welche für anonyme Nutzer
    // nicht erfüllt ist (→ 42501). Da der consent_id pro Browser stabil ist, ist
    // ein Duplicate-Key-Error (23505) der erwartete Fall für Folge-Änderungen
    // und wird hier still verworfen. Für echte Consent-Änderungen wäre ein
    // neuer consent_id nötig (Audit-Trail), siehe TODO unten.
    supabase.from('cookie_consent').insert({
      consent_id: finalConsent.consentId,
      user_id: null, // Wird ggf. später mit auth.uid() verknüpft
      essential: finalConsent.essential,
      functional: finalConsent.functional,
      analytics: finalConsent.analytics,
      marketing: finalConsent.marketing,
      user_agent: navigator.userAgent.substring(0, 500),
      consent_version: CONSENT_VERSION,
    }).then(({ error }) => {
      // 23505 = unique_violation: consent_id existiert bereits → erwartet
      if (error && error.code !== '23505') {
        logger.error('Failed to save consent to DB:', error);
      }
    });

    logger.log('Cookie consent saved:', finalConsent);
  }, []);

  const handleAcceptAll = () => {
    const newConsent: CookieConsent = {
      ...consent,
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setConsent(newConsent);
    saveConsent(newConsent);
    closeBanner();
  };

  const handleAcceptSelected = () => {
    saveConsent(consent);
    closeBanner();
  };

  const handleDeclineAll = () => {
    const newConsent: CookieConsent = {
      ...consent,
      essential: true, // Always on
      functional: false,
      analytics: false,
      marketing: false,
    };
    setConsent(newConsent);
    saveConsent(newConsent);
    closeBanner();
  };

  const closeBanner = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowBanner(false);
      setIsClosing(false);
    }, 300);
  };

  const toggleCategory = (category: 'functional' | 'analytics' | 'marketing') => {
    setConsent(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-banner-title"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300",
        isClosing ? "translate-y-full" : "translate-y-0"
      )}
    >
      <div className="bg-card dark:bg-gray-900 border-t border-border shadow-2xl">
        {/* pb-[env(safe-area-inset-bottom)] verhindert Überlappung mit iOS
            Home-Indicator / Android Gesture-Bar. max-h + overflow-y-auto
            sorgt dafür, dass der Banner mit ausgeklappten "Details" nicht
            mehr den halben Viewport blockiert. */}
        <div className="container mx-auto px-4 py-3 sm:py-6 pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom)))] sm:pb-[max(1.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] max-h-[85dvh] overflow-y-auto overscroll-contain">
          {/* Main Banner Content */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="hidden p-2 rounded-lg bg-primary/10 sm:block">
                  <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="cookie-banner-title" className="font-semibold text-foreground text-base sm:text-lg">
                    Datenschutz & Cookies
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
                    Notwendige Cookies sind immer aktiv. Statistik (Google Analytics) und Marketing (Google Ads, Meta)
                    nutzen wir nur mit Ihrer Einwilligung – jederzeit widerrufbar über „Cookie-Einstellungen“ im Footer.
                    Mehr in der{' '}
                    <a
                      href="/datenschutz"
                      className="link-inline"
                    >
                      Datenschutzerklärung
                    </a>.
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Details Button */}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
              aria-controls="cookie-banner-details"
              className="flex min-h-9 items-center gap-2 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors w-fit"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              Cookie-Einstellungen anpassen
              {showDetails ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            </button>

            {/* Detailed Options */}
            {showDetails && (
              <div id="cookie-banner-details" className="grid gap-3 p-4 bg-muted/50 rounded-lg border">
                {/* Essential Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-success mt-0.5" aria-hidden="true" />
                    <div>
                      <p id="cookie-banner-essential-label" className="font-medium text-sm">Notwendig</p>
                      <p id="cookie-banner-essential-desc" className="text-xs text-muted-foreground">
                        Erforderlich für die Grundfunktionen der Website. Kann nicht deaktiviert werden.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="opacity-50"
                    aria-labelledby="cookie-banner-essential-label"
                    aria-describedby="cookie-banner-essential-desc"
                  />
                </div>

                {/* Functional Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-primary mt-0.5" aria-hidden="true" />
                    <div>
                      <p id="cookie-banner-functional-label" className="font-medium text-sm">Funktional</p>
                      <p id="cookie-banner-functional-desc" className="text-xs text-muted-foreground">
                        Ermöglicht erweiterte Funktionen und Personalisierung (z.B. gespeicherte Präferenzen).
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.functional} 
                    onCheckedChange={() => toggleCategory('functional')}
                    aria-labelledby="cookie-banner-functional-label"
                    aria-describedby="cookie-banner-functional-desc"
                  />
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" aria-hidden="true" />
                    <div>
                      <p id="cookie-banner-analytics-label" className="font-medium text-sm">Statistik & Analyse</p>
                      <p id="cookie-banner-analytics-desc" className="text-xs text-muted-foreground">
                        Hilft uns zu verstehen, wie Besucher die Website nutzen (Google Analytics und eigene Statistik, pseudonymisiert).
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.analytics} 
                    onCheckedChange={() => toggleCategory('analytics')}
                    aria-labelledby="cookie-banner-analytics-label"
                    aria-describedby="cookie-banner-analytics-desc"
                  />
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Megaphone className="w-5 h-5 text-warning mt-0.5" aria-hidden="true" />
                    <div>
                      <p id="cookie-banner-marketing-label" className="font-medium text-sm">Marketing</p>
                      <p id="cookie-banner-marketing-desc" className="text-xs text-muted-foreground">
                        Misst den Erfolg unserer Anzeigen und ermöglicht Werbung auf anderen Websites (Google Ads, Meta).
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.marketing} 
                    onCheckedChange={() => toggleCategory('marketing')}
                    aria-labelledby="cookie-banner-marketing-label"
                    aria-describedby="cookie-banner-marketing-desc"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {/* Ablehnen und Akzeptieren gleich groß und gleich leicht erreichbar. */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
              {showDetails && (
                <Button
                  variant="outline"
                  onClick={handleAcceptSelected}
                  className="col-span-2 sm:col-span-1"
                >
                  Auswahl speichern
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleDeclineAll}
                className="h-11 sm:min-w-40"
              >
                Nur notwendige
              </Button>
              <Button
                onClick={handleAcceptAll}
                className="h-11 sm:min-w-40"
              >
                Alle akzeptieren
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
