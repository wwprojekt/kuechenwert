import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Gauge, Users, Bed, ArrowRight, Clock, Zap, Truck, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { CommissionDisplay } from "@/components/CommissionDisplay";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CountryFlag } from "@/components/CountryFlag";
import { StablePriceBadge } from "@/components/StablePriceBadge";
import { useUserRole } from "@/hooks/useUserRole";
import { useNow } from "@/hooks/useNow";
import { getResponsiveImageProps } from "@/lib/imageTransform";

/**
 * Sizes-Hinweis für die Karten-Hero-Images. Spiegelt das Grid in Kaufen.tsx
 * (1 col mobile, 2 cols sm, 3 cols lg, 4 cols xl) plus Filter-Sidebar wider.
 * Browser nutzt das, um aus dem srcset die kleinste passende Version zu laden.
 */
const CARD_IMAGE_SIZES = "(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 45vw, 92vw";

interface MotorhomeCardProps {
  // Core vehicle info
  id: string;
  title: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  image: string;
  listingNumber?: string | null;
  
  // Optional details
  beds?: number;
  passengers?: number;
  location?: string;
  bodyType?: string;
  country?: string | null;
  
  // Auction-specific
  isAuction?: boolean;
  currentBid?: number;
  startingBid?: number;
  instantPrice?: number | null;
  saleChannel?: string | null;
  endTime?: string;
  bidCount?: number;
  status?: string;
  // Marketing-Phase: Stable-Price-Badge ("Preis stabil seit X Tagen")
  lastPriceReductionAt?: string | null;
  marketingPhaseStartedAt?: string | null;
  auctionCreatedAt?: string | null;
  
  // Static listing
  price?: number;
  badge?: string;
  
  // Seller type
  accountType?: string | null;
  
  // Link
  linkTo: string;
}

// Urgency levels for color-coded countdown
type UrgencyLevel = 'relaxed' | 'normal' | 'attention' | 'warning' | 'urgent' | 'critical' | 'hotbid' | 'ended';

function getUrgencyLevel(distanceMs: number): UrgencyLevel {
  if (distanceMs <= 0) return 'ended';
  if (distanceMs < 5 * 60 * 1000) return 'hotbid';           // < 5 min
  if (distanceMs < 15 * 60 * 1000) return 'critical';         // 5-15 min
  if (distanceMs < 60 * 60 * 1000) return 'urgent';           // 15 min - 1h
  if (distanceMs < 6 * 60 * 60 * 1000) return 'warning';      // 1-6h
  if (distanceMs < 12 * 60 * 60 * 1000) return 'attention';   // 6-12h
  if (distanceMs < 24 * 60 * 60 * 1000) return 'normal';      // 12-24h
  return 'relaxed';                                             // > 24h
}

// Modern color scheme for each urgency level
// Uses inline styles for precise color control with backdrop-blur glass effect
function getTimerStyles(level: UrgencyLevel): { bg: string; text: string; glow: string; dot: string } {
  switch (level) {
    case 'relaxed':
      return {
        bg: 'rgba(16, 185, 129, 0.85)',    // Emerald 500
        text: '#ffffff',
        glow: 'none',
        dot: 'rgb(16, 185, 129)',
      };
    case 'normal':
      return {
        bg: 'rgba(34, 197, 94, 0.85)',      // Green 500
        text: '#ffffff',
        glow: 'none',
        dot: 'rgb(34, 197, 94)',
      };
    case 'attention':
      return {
        bg: 'rgba(245, 158, 11, 0.85)',     // Amber 500
        text: '#ffffff',
        glow: 'none',
        dot: 'rgb(245, 158, 11)',
      };
    case 'warning':
      return {
        bg: 'rgba(249, 115, 22, 0.85)',     // Orange 500
        text: '#ffffff',
        glow: 'none',
        dot: 'rgb(249, 115, 22)',
      };
    case 'urgent':
      return {
        bg: 'rgba(239, 68, 68, 0.85)',      // Red 500
        text: '#ffffff',
        glow: '0 0 8px rgba(239, 68, 68, 0.3)',
        dot: 'rgb(239, 68, 68)',
      };
    case 'critical':
      return {
        bg: 'rgba(220, 38, 38, 0.9)',       // Red 600
        text: '#ffffff',
        glow: '0 0 12px rgba(220, 38, 38, 0.4)',
        dot: 'rgb(220, 38, 38)',
      };
    case 'hotbid':
      return {
        bg: 'rgba(185, 28, 28, 0.95)',      // Red 700
        text: '#ffffff',
        glow: '0 0 16px rgba(185, 28, 28, 0.5)',
        dot: 'rgb(185, 28, 28)',
      };
    case 'ended':
      return {
        bg: 'rgba(107, 114, 128, 0.8)',     // Gray 500
        text: '#ffffff',
        glow: 'none',
        dot: 'rgb(107, 114, 128)',
      };
  }
}

const MotorhomeCard = ({
  id,
  title,
  manufacturer,
  model,
  year,
  mileage,
  image,
  listingNumber,
  beds,
  passengers,
  location,
  bodyType,
  country,
  isAuction = false,
  currentBid,
  startingBid,
  instantPrice,
  saleChannel,
  endTime,
  bidCount = 0,
  status,
  price,
  badge,
  accountType,
  lastPriceReductionAt,
  marketingPhaseStartedAt,
  auctionCreatedAt,
  linkTo
}: MotorhomeCardProps) => {
  const { isDealer, isAdmin } = useUserRole();
  const canSeePrices = isDealer || isAdmin;

  // Globaler 1-Hz-Tick statt eigenem setInterval pro Karte. Bei 12 sichtbaren Karten
  // läuft so EIN Timer in der App statt zwölf — siehe src/hooks/useNow.ts.
  // useNow ist günstig wenn die Karte gar kein Auktions-Countdown braucht (kein Tick),
  // deshalb hier conditional via tickEnabled steuern.
  const tickEnabled = isAuction && !!endTime;
  const now = useNow();

  // Abgeleitete Timer-Werte komplett aus `now` + `endTime` berechnen.
  // Vorher: 5 setState pro Sekunde + extra useEffect. Jetzt: ein useMemo,
  // der nur dann neu rechnet, wenn sich `now` (1×/sec) oder `endTime` ändert.
  const timer = useMemo(() => {
    if (!tickEnabled) {
      return {
        timeRemaining: '',
        urgency: 'relaxed' as UrgencyLevel,
        isEndingSoon: false,
        isHotbid: false,
      };
    }
    const end = new Date(endTime as string).getTime();
    const distance = end - now;

    if (distance <= 0) {
      return { timeRemaining: 'Beendet', urgency: 'ended' as UrgencyLevel, isEndingSoon: false, isHotbid: false };
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((distance % (1000 * 60)) / 1000);

    let timeRemaining: string;
    if (days > 0) timeRemaining = `${days}T ${hours}h`;
    else if (hours > 0) timeRemaining = `${hours}h ${minutes}m`;
    else if (minutes > 0) timeRemaining = `${minutes}m ${secs}s`;
    else timeRemaining = `${secs}s`;

    return {
      timeRemaining,
      urgency: getUrgencyLevel(distance),
      isEndingSoon: distance < 60 * 60 * 1000,
      isHotbid: distance < 5 * 60 * 1000,
    };
  }, [now, endTime, tickEnabled]);

  const { timeRemaining, urgency, isEndingSoon, isHotbid } = timer;

  const displayPrice = isAuction 
    ? (currentBid || startingBid || 0)
    : (price || 0);

  const isSold = status === 'sold';
  const isEnded = timeRemaining === 'Beendet';
  const hasInstantSale = instantPrice && Number(instantPrice) > 0;

  const timerStyles = useMemo(() => getTimerStyles(urgency), [urgency]);

  // Responsive Image-URL via Supabase Image Transformation. Ersetzt das vorherige
  // 300 KB Original-JPEG durch eine ~30 KB transformierte Version, plus srcset für
  // höhere Pixel-Dichten. Bei Nicht-Supabase-URLs unverändertes Verhalten.
  const responsiveImage = useMemo(
    () => getResponsiveImageProps(image, { sizes: CARD_IMAGE_SIZES, defaultWidth: 480, quality: 70 }),
    [image]
  );

  // Determine if we should show the blink animation (last 5 minutes)
  const shouldBlink = urgency === 'hotbid';
  // Softer pulse for critical (5-15 min)
  const shouldPulse = urgency === 'critical';

  return (
    <Card className={`group overflow-hidden border-2 bg-card hover:border-primary transition-all duration-300 hover-lift flex flex-col h-full ${isEnded && !isSold ? 'opacity-70' : ''} ${isHotbid && !isEnded ? 'border-destructive/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : ''}`}>
      <Link to={linkTo}>
        <div className="relative overflow-hidden">
          {/* Badges */}
          <div className="absolute top-3 left-3 z-10 flex gap-2 flex-wrap">
            {badge && !isAuction && (
              <Badge className="bg-primary text-primary-foreground font-bold shadow-lg">
                {badge}
              </Badge>
            )}
            {isSold && (
              <Badge className="bg-green-500 text-white font-semibold">
                Verkauft
              </Badge>
            )}
            {hasInstantSale && !isSold && saleChannel === 'instant_price' && (
              <Badge className="bg-yellow-500 text-white flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Festpreis
              </Badge>
            )}
            {hasInstantSale && !isSold && saleChannel !== 'instant_price' && (
              <Badge className="bg-primary text-primary-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Sofortkauf
              </Badge>
            )}
            {isEndingSoon && !isSold && (
              <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                Endet bald!
              </Badge>
            )}
            {accountType === 'dealer' ? (
              <Badge variant="outline" className="bg-blue-50/90 text-blue-700 border-blue-200 text-[10px]">
                Händler
              </Badge>
            ) : accountType === 'private' ? (
              <Badge variant="outline" className="bg-white/90 text-gray-600 border-gray-300 text-[10px]">
                Privat
              </Badge>
            ) : null}
          </div>

          {/* Favorite Button */}
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton motorhomeId={id} />
          </div>

          {/* Color-coded Timer for auctions */}
          {isAuction && endTime && (
            <div className="absolute bottom-3 right-3 z-10">
              <div
                className={`
                  inline-flex items-center gap-1.5 
                  px-2.5 py-1 rounded-full
                  text-[11px] font-semibold tracking-wide
                  backdrop-blur-md
                  transition-all duration-500
                  ${shouldBlink ? 'animate-timer-blink' : ''}
                  ${shouldPulse ? 'animate-timer-pulse' : ''}
                `}
                style={{
                  backgroundColor: timerStyles.bg,
                  color: timerStyles.text,
                  boxShadow: timerStyles.glow,
                }}
              >
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span>{timeRemaining}</span>
              </div>
            </div>
          )}

          {/* Image */}
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            {image ? (
              <img
                src={responsiveImage.src}
                srcSet={responsiveImage.srcSet || undefined}
                sizes={responsiveImage.srcSet ? responsiveImage.sizes : undefined}
                alt={`${manufacturer} ${model}`}
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Kein Bild
              </div>
            )}
          </div>

          {/* Subtle urgency indicator bar at bottom of image */}
          {isAuction && endTime && !isEnded && !isSold && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-[3px] transition-all duration-700 ${shouldBlink ? 'animate-timer-blink' : ''} ${shouldPulse ? 'animate-timer-pulse' : ''}`}
              style={{
                backgroundColor: timerStyles.dot,
                opacity: urgency === 'relaxed' ? 0.4 : urgency === 'normal' ? 0.5 : 0.7,
              }}
            />
          )}
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="mb-3 h-[72px] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-primary">
                {manufacturer} {model}
              </div>
              <div className="flex items-center gap-1.5">
                {country && (
                  <CountryFlag countryCode={country} size="sm" />
                )}
                {listingNumber && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    #{listingNumber}
                  </span>
                )}
              </div>
            </div>
            <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-2">
              {title}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{year}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span>{mileage.toLocaleString("de-DE")} km</span>
            </div>
            {bodyType && (
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>{bodyType}</span>
              </div>
            )}
            {passengers && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{passengers} Sitze</span>
              </div>
            )}
            {beds && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-3.5 w-3.5 text-primary" />
                <span>{beds} Betten</span>
              </div>
            )}
          </div>

          {location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>{location}</span>
            </div>
          )}

          <div className="pt-4 border-t border-border/50 mt-auto">
            {isAuction && !canSeePrices ? (
              /* Non-dealer: Show lock message instead of prices */
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 py-2">
                  <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{saleChannel === 'instant_price' ? 'Preis nur für Händler sichtbar' : 'Gebote nur für Händler sichtbar'}</span>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 group" 
                  size="sm"
                  variant={isEnded && !isSold ? 'outline' : 'default'}
                  disabled={isSold}
                >
                  {isSold ? 'Verkauft' : isEnded ? 'Details ansehen' : 'Details ansehen'}
                  {!isSold && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-smooth" />}
                </Button>
              </>
            ) : (
              /* Dealer/Admin or non-auction: Show prices normally */
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {saleChannel === 'instant_price' ? (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {isSold ? 'Verkaufspreis' : 'Festpreis'}
                        </div>
                        <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                          {instantPrice?.toLocaleString("de-DE")} €
                        </div>
                        {!isSold && (
                          <div className="mt-1">
                            <StablePriceBadge
                              variant="compact"
                              lastPriceReductionAt={lastPriceReductionAt}
                              marketingPhaseStartedAt={marketingPhaseStartedAt}
                              fallbackAnchor={auctionCreatedAt}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {isSold ? 'Verkaufspreis' : isAuction ? 'Aktuelles Gebot' : 'Ankaufspreis'}
                        </div>
                        <div className="text-xl font-bold text-primary">
                          {displayPrice.toLocaleString("de-DE")} €
                        </div>
                        {isAuction && !isSold && (
                          <div className="mt-1">
                            <StablePriceBadge
                              variant="compact"
                              lastPriceReductionAt={lastPriceReductionAt}
                              marketingPhaseStartedAt={marketingPhaseStartedAt}
                              fallbackAnchor={auctionCreatedAt}
                            />
                          </div>
                        )}
                        {hasInstantSale && !isSold && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Sofort: {instantPrice?.toLocaleString("de-DE")} €
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {isAuction && saleChannel !== 'instant_price' && (
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{bidCount} Gebote</div>
                      {startingBid && (
                        <div className="mt-1">Start: {startingBid.toLocaleString("de-DE")} €</div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Commission Display for Auctions - only for dealers */}
                {isAuction && !isSold && canSeePrices && saleChannel !== 'instant_price' && (
                  <div className="mb-3">
                    <CommissionDisplay 
                      bidAmount={displayPrice} 
                      variant="compact"
                    />
                  </div>
                )}
                
                <Button 
                  className={`w-full group ${saleChannel === 'instant_price' && !isSold && !isEnded ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-primary hover:bg-primary/90'}`}
                  size="sm"
                  variant={isEnded && !isSold ? 'outline' : 'default'}
                  disabled={isSold}
                >
                  {isSold ? 'Verkauft' : isEnded ? 'Ergebnis ansehen' : saleChannel === 'instant_price' ? 'Jetzt kaufen' : isAuction ? 'Ansehen & Bieten' : 'Details ansehen'}
                  {!isSold && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-smooth" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default MotorhomeCard;
