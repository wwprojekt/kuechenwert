import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Cookie, Settings, Shield, BarChart3, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

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
    if (!storedConsent) {
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
    }
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

    // Update Google Analytics consent (if loaded)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: finalConsent.analytics ? 'granted' : 'denied',
        ad_storage: finalConsent.marketing ? 'granted' : 'denied',
        ad_user_data: finalConsent.marketing ? 'granted' : 'denied',
        ad_personalization: finalConsent.marketing ? 'granted' : 'denied',
        functionality_storage: finalConsent.functional ? 'granted' : 'denied',
        personalization_storage: finalConsent.functional ? 'granted' : 'denied',
      });
    }

    // Dispatch event for analytics service to react
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: finalConsent }));

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
      <div className="bg-white dark:bg-gray-900 border-t border-border shadow-2xl">
        <div className="container mx-auto px-4 py-5 sm:py-6">
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
                size="sm"
                onClick={handleDeclineAll}
                className="text-muted-foreground"
              >
                Nur Notwendige
              </Button>
              {showDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptSelected}
                >
                  Auswahl speichern
                </Button>
              )}
              <Button
                size="sm"
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
