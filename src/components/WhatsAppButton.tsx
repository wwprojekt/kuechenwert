/**
 * Floating WhatsApp Button Component
 * Provides quick customer support access via WhatsApp
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSettings } from '@/contexts/SettingsContext';
import { trackWhatsAppClick } from '@/lib/gadsConversionService';
import { trackMetaWhatsAppClick } from '@/lib/metaPixelService';

export const WhatsAppButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { settings } = useSettings();
  const location = useLocation();

  // Hide on admin, dashboard and the sales wizard. The wizard already shows a
  // "Kontaktieren Sie uns" link directly above its sticky bottom nav, and the
  // floating bubble would visually collide with the back/next buttons on
  // mobile (both fixed, both z-50, both in the lower-left corner).
  const hiddenRoutes = ['/admin', '/dashboard', '/verkaufen/wizard'];
  const shouldHide = hiddenRoutes.some(route => location.pathname.startsWith(route));

  if (shouldHide) {
    return null;
  }

  // Auktions-Detailseiten haben auf Mobile eine sticky Bid-Bar am unteren
  // Rand. Damit der WhatsApp-Button die Bar nicht überlappt, schieben wir
  // ihn dort höher (nur auf Mobile, ab sm: zurück zur Standard-Position).
  //
  // z-index: bewusst z-40 (CookieBanner ist z-50). Solange das Cookie-Banner
  // sichtbar ist, soll die Datenschutz-Entscheidung nicht durch die FAB
  // verdeckt werden. Sobald der Banner verschwunden ist, sitzt der FAB
  // wieder oben über allem normalen Content.
  //
  // safe-area-inset-bottom verhindert Kollision mit dem iOS Home-Indicator
  // (Notch-Geräte ab iPhone X) und Android-Gesture-Bar.
  const isAuctionPage = location.pathname.startsWith('/auktion/');
  const positionClasses = isAuctionPage
    ? 'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 sm:bottom-8 sm:left-8 z-40'
    : 'fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-4 sm:bottom-8 sm:left-8 z-40';

  // Don't render if no phone number configured
  if (!settings?.whatsapp_number && !settings?.support_phone) {
    return null;
  }

  // Extract phone number and site name from settings
  const phoneNumber = (settings?.whatsapp_number || settings?.support_phone)?.replace(/\D/g, '') || '';
  const siteName = settings?.site_name || 'CaravanWert';
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=Hallo! Ich habe eine Frage zu ${siteName}.`;

  const handleWhatsAppClick = () => {
    trackWhatsAppClick(location.pathname);
    trackMetaWhatsAppClick();
    window.open(whatsappUrl, '_blank');
    setIsExpanded(false);
  };

  return (
    <div className={positionClasses}>
      {isExpanded && (
        <Card className="mb-4 p-4 w-80 max-w-[calc(100vw-4rem)] sm:max-w-80 shadow-lg animate-fade-in">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm">Benötigen Sie Hilfe?</h3>
              <p className="text-xs text-muted-foreground">
                Schreiben Sie uns direkt über WhatsApp
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="h-10 w-10 shrink-0 -mr-2 -mt-2"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              • Fragen zum Verkaufsprozess
            </div>
            <div className="text-xs text-muted-foreground">
              • Technischer Support
            </div>
            <div className="text-xs text-muted-foreground">
              • Allgemeine Anfragen
            </div>
          </div>
          
          <Button
            onClick={handleWhatsAppClick}
            className="w-full mt-4 bg-[#25D366] hover:bg-[#20BA5A] text-white"
            size="sm"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat starten
          </Button>
        </Card>
      )}
      
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-12 w-12 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        size="icon"
        aria-label="WhatsApp Support"
      >
        {isExpanded ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
};

/**
 * WhatsApp Link Generator Hook
 */
export const useWhatsAppLink = (customMessage?: string) => {
  const { settings } = useSettings();
  const phoneNumber = (settings?.whatsapp_number || settings?.support_phone)?.replace(/\D/g, '') || '';
  const siteName = settings?.site_name || 'CaravanWert';
  
  const generateLink = (message: string = `Hallo! Ich habe eine Frage zu ${siteName}.`) => {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  };

  return {
    phoneNumber: settings?.support_phone || '',
    whatsappLink: generateLink(customMessage),
    openWhatsApp: (message?: string) => {
      window.open(generateLink(message), '_blank');
    },
  };
};

export default WhatsAppButton;
