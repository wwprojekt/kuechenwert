import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Cookie, Shield, Settings, BarChart3, Megaphone, ExternalLink } from 'lucide-react';
import { 
  getStoredConsent, 
  type CookieConsent 
} from './CookieBanner';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

const CONSENT_VERSION = '1.0';
const CONSENT_STORAGE_KEY = 'cookie-consent';

interface CookieSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cookie Settings Modal
 * 
 * Allows users to manage their cookie preferences after initial consent.
 * DSGVO compliant - users can change their preferences at any time.
 */
export function CookieSettingsModal({ open, onOpenChange }: CookieSettingsModalProps) {
  const [consent, setConsent] = useState<CookieConsent>({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
    consentId: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    consentVersion: CONSENT_VERSION,
    timestamp: 0,
  });

  // Load current consent when modal opens
  useEffect(() => {
    if (open) {
      const storedConsent = getStoredConsent();
      if (storedConsent) {
        setConsent(storedConsent);
      }
    }
  }, [open]);

  const saveConsent = (newConsent: CookieConsent) => {
    const finalConsent = {
      ...newConsent,
      timestamp: Date.now(),
    };

    // Store in localStorage
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(finalConsent));

    // Set cross-domain cookie
    const domain = window.location.hostname.includes('localhost') 
      ? '' 
      : `.${window.location.hostname.split('.').slice(-2).join('.')}`;
    
    const cookieOptions = `path=/; max-age=31536000; SameSite=Lax${domain ? `; domain=${domain}` : ''}${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    document.cookie = `consent_id=${finalConsent.consentId}; ${cookieOptions}`;
    document.cookie = `consent_analytics=${finalConsent.analytics}; ${cookieOptions}`;
    document.cookie = `consent_marketing=${finalConsent.marketing}; ${cookieOptions}`;

    // Update Google Analytics consent
    if (typeof window !== 'undefined' && (window as any).gtag) {
      // WICHTIG: Bei Marketing-Consent ads_data_redaction auf false setzen,
      // damit Google Ads Click-IDs (gclid, _gcl_aw) korrekt weitergegeben werden.
      (window as any).gtag('set', 'ads_data_redaction', !finalConsent.marketing);
      (window as any).gtag('consent', 'update', {
        analytics_storage: finalConsent.analytics ? 'granted' : 'denied',
        ad_storage: finalConsent.marketing ? 'granted' : 'denied',
        ad_user_data: finalConsent.marketing ? 'granted' : 'denied',
        ad_personalization: finalConsent.marketing ? 'granted' : 'denied',
        functionality_storage: finalConsent.functional ? 'granted' : 'denied',
        personalization_storage: finalConsent.functional ? 'granted' : 'denied',
      });
    }

    // Dispatch event for analytics service
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: finalConsent }));

    // DSGVO: Einwilligung serverseitig in cookie_consent Tabelle speichern.
    // Plain INSERT (kein UPSERT), da der ON CONFLICT DO UPDATE-Pfad die
    // UPDATE-RLS-Policy für anon prüft und mit 42501 scheitert. Siehe
    // CookieBanner.tsx für Details. Duplicate-Key (23505) wird still ignoriert.
    supabase.from('cookie_consent').insert({
      consent_id: finalConsent.consentId,
      user_id: null,
      essential: finalConsent.essential,
      functional: finalConsent.functional,
      analytics: finalConsent.analytics,
      marketing: finalConsent.marketing,
      user_agent: navigator.userAgent.substring(0, 500),
      consent_version: CONSENT_VERSION,
    }).then(({ error }) => {
      if (error && error.code !== '23505') {
        logger.error('Failed to save consent to DB:', error);
      }
    });

    logger.log('Cookie consent updated:', finalConsent);
  };

  const handleSave = () => {
    saveConsent(consent);
    onOpenChange(false);
  };

  const handleAcceptAll = () => {
    const newConsent: CookieConsent = {
      ...consent,
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    saveConsent(newConsent);
    onOpenChange(false);
  };

  const handleRejectAll = () => {
    const newConsent: CookieConsent = {
      ...consent,
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    };
    saveConsent(newConsent);
    onOpenChange(false);
  };

  const toggleCategory = (category: 'functional' | 'analytics' | 'marketing') => {
    setConsent(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const categories = [
    {
      id: 'essential' as const,
      name: 'Notwendige Cookies',
      icon: Shield,
      iconColor: 'text-green-600',
      description: 'Diese Cookies sind für die Grundfunktionen der Website erforderlich und können nicht deaktiviert werden.',
      examples: 'Session-Cookies, Sicherheits-Cookies, Cookie-Einstellungen',
      enabled: true,
      locked: true,
    },
    {
      id: 'functional' as const,
      name: 'Funktionale Cookies',
      icon: Settings,
      iconColor: 'text-blue-600',
      description: 'Ermöglichen erweiterte Funktionen und Personalisierung, wie gespeicherte Einstellungen und Präferenzen.',
      examples: 'Spracheinstellungen, Theme-Präferenzen, Merklisten',
      enabled: consent.functional,
      locked: false,
    },
    {
      id: 'analytics' as const,
      name: 'Statistik & Analyse',
      icon: BarChart3,
      iconColor: 'text-purple-600',
      description: 'Helfen uns zu verstehen, wie Besucher die Website nutzen. Alle Daten werden anonymisiert erhoben.',
      examples: 'Seitenaufrufe, Verweildauer, Gerätetyp, anonyme Besucherstatistiken',
      enabled: consent.analytics,
      locked: false,
    },
    {
      id: 'marketing' as const,
      name: 'Marketing Cookies',
      icon: Megaphone,
      iconColor: 'text-orange-600',
      description: 'Werden für personalisierte Werbung und Remarketing über Drittanbieter verwendet.',
      examples: 'Google Ads, Meta Pixel, Conversion-Tracking',
      enabled: consent.marketing,
      locked: false,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-primary" />
            Cookie-Einstellungen
          </DialogTitle>
          <DialogDescription>
            Hier können Sie Ihre Cookie-Präferenzen verwalten. Diese Einstellungen können Sie jederzeit ändern.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {categories.map((category, index) => (
            <div key={category.id}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg bg-muted ${category.iconColor}`}>
                    <category.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{category.name}</h4>
                      {category.locked && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          Erforderlich
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      <span className="font-medium">Beispiele:</span> {category.examples}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={category.enabled}
                  disabled={category.locked}
                  onCheckedChange={() => {
                    if (!category.locked && category.id !== 'essential') {
                      toggleCategory(category.id as 'functional' | 'analytics' | 'marketing');
                    }
                  }}
                  className={category.locked ? 'opacity-50' : ''}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p>
            Weitere Informationen zur Verarbeitung Ihrer Daten finden Sie in unserer{' '}
            <a href="/datenschutz" className="text-primary hover:underline inline-flex items-center gap-1">
              Datenschutzerklärung
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          {consent.timestamp > 0 && (
            <p className="mt-2">
              Letzte Aktualisierung: {new Date(consent.timestamp).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleRejectAll} className="sm:mr-auto">
            Alle ablehnen
          </Button>
          <Button variant="outline" onClick={handleSave}>
            Auswahl speichern
          </Button>
          <Button onClick={handleAcceptAll} className="gradient-hero">
            Alle akzeptieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CookieSettingsModal;
