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
        <div className="container mx-auto px-4 py-5 sm:py-6 pb-[max(1.25rem,calc(1.25rem+env(safe-area-inset-bottom)))] sm:pb-[max(1.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] max-h-[85dvh] overflow-y-auto overscroll-contain">
          {/* Main Banner Content */}
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    Datenschutz & Cookies
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Sie können selbst entscheiden, welche Cookies Sie zulassen möchten.
                    Mehr Informationen finden Sie in unserer{' '}
                    <a
                      href="/datenschutz"
                      className="text-primary hover:underline font-medium"
                    >
                      Datenschutzerklärung
                    </a>.
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Details Button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-fit"
            >
              <Settings className="w-4 h-4" />
              Cookie-Einstellungen anpassen
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Detailed Options */}
            {showDetails && (
              <div className="grid gap-3 p-4 bg-muted/50 rounded-lg border">
                {/* Essential Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Notwendig</p>
                      <p className="text-xs text-muted-foreground">
                        Erforderlich für die Grundfunktionen der Website. Kann nicht deaktiviert werden.
                      </p>
                    </div>
                  </div>
                  <Switch checked={true} disabled className="opacity-50" />
                </div>

                {/* Functional Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Funktional</p>
                      <p className="text-xs text-muted-foreground">
                        Ermöglicht erweiterte Funktionen und Personalisierung (z.B. gespeicherte Präferenzen).
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.functional} 
                    onCheckedChange={() => toggleCategory('functional')}
                  />
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Statistik & Analyse</p>
                      <p className="text-xs text-muted-foreground">
                        Hilft uns zu verstehen, wie Besucher die Website nutzen. Alle Daten sind anonymisiert.
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.analytics} 
                    onCheckedChange={() => toggleCategory('analytics')}
                  />
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg">
                  <div className="flex items-start gap-3">
                    <Megaphone className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Marketing</p>
                      <p className="text-xs text-muted-foreground">
                        Wird für personalisierte Werbung und Remarketing verwendet.
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={consent.marketing} 
                    onCheckedChange={() => toggleCategory('marketing')}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={handleDeclineAll}
                className="text-muted-foreground"
              >
                Nur Notwendige
              </Button>
              {showDetails && (
                <Button
                  variant="outline"
                  onClick={handleAcceptSelected}
                >
                  Auswahl speichern
                </Button>
              )}
              <Button
                onClick={handleAcceptAll}
                className="gradient-hero hover:shadow-glow"
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
