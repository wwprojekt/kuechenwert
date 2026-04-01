import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Gauge, Users, Bed, ArrowRight, Clock, Zap, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CommissionDisplay } from "@/components/CommissionDisplay";
import { FavoriteButton } from "@/components/FavoriteButton";
import { getCountryFlag } from "@/lib/geolocation";

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
  
  // Static listing
  price?: number;
  badge?: string;
  
  // Link
  linkTo: string;
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
  linkTo
}: MotorhomeCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [isHotbid, setIsHotbid] = useState(false);

  const displayPrice = isAuction 
    ? (currentBid || startingBid || 0)
    : (price || 0);

  const isSold = status === 'sold';
  const isEnded = timeRemaining === 'Beendet';
  const hasInstantSale = instantPrice && Number(instantPrice) > 0;

  useEffect(() => {
    if (!isAuction || !endTime) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeRemaining("Beendet");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      setIsEndingSoon(distance < 60 * 60 * 1000);
      setIsHotbid(distance < 5 * 60 * 1000);

      if (days > 0) {
        setTimeRemaining(`${days}T ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isAuction, endTime]);

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
            {hasInstantSale && !isSold && (
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
          </div>

          {/* Favorite Button */}
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton motorhomeId={id} />
          </div>

          {/* Timer for auctions */}
          {isAuction && endTime && (
            <div className="absolute bottom-3 right-3 z-10">
              <Badge 
                variant="secondary" 
                className={`glass flex items-center gap-1 ${isEndingSoon ? 'animate-pulse bg-destructive/90 text-destructive-foreground' : ''}`}
              >
                <Clock className="w-3 h-3" />
                {timeRemaining}
              </Badge>
            </div>
          )}

          {/* Image */}
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            {image ? (
              <img
                src={image}
                alt={`${manufacturer} ${model}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Kein Bild
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="mb-3 h-[72px] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-primary">
                {manufacturer} {model}
              </div>
              <div className="flex items-center gap-1.5">
                {country && (
                  <span className="text-sm" title={country}>
                    {getCountryFlag(country)}
                  </span>
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
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  {isSold ? 'Verkaufspreis' : isAuction ? 'Aktuelles Gebot' : 'Ankaufspreis'}
                </div>
                <div className="text-xl font-bold text-primary">
                  {displayPrice.toLocaleString("de-DE")} €
                </div>
                {hasInstantSale && !isSold && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Sofort: {instantPrice?.toLocaleString("de-DE")} €
                  </div>
                )}
              </div>
              {isAuction && (
                <div className="text-right text-xs text-muted-foreground">
                  <div>{bidCount} Gebote</div>
                  {startingBid && (
                    <div className="mt-1">Start: {startingBid.toLocaleString("de-DE")} €</div>
                  )}
                </div>
              )}
            </div>
            
            {/* Commission Display for Auctions */}
            {isAuction && !isSold && (
              <div className="mb-3">
                <CommissionDisplay 
                  bidAmount={displayPrice} 
                  variant="compact"
                />
              </div>
            )}
            
            <Button 
              className="w-full bg-primary hover:bg-primary/90 group" 
              size="sm"
              variant={isEnded && !isSold ? 'outline' : 'default'}
              disabled={isSold}
            >
              {isSold ? 'Verkauft' : isEnded ? 'Ergebnis ansehen' : isAuction ? 'Ansehen & Bieten' : 'Details ansehen'}
              {!isSold && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-smooth" />}
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default MotorhomeCard;
