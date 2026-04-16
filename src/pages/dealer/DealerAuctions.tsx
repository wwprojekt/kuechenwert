import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveData } from "@/hooks/useLiveData";
import { Gavel, Search, Clock, TrendingUp, MapPin, Navigation, ArrowUpDown, Zap, Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { anonymizePostalCode, getPlzCoordinates } from "@/lib/plzCoordinates";
import { calculateDistance, formatDistance } from "@/lib/geolocation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

interface Auction {
  id: string;
  status: string;
  current_bid: number;
  starting_bid: number;
  reserve_price: number;
  buy_now_price: number | null;
  end_time: string;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    mileage: number;
    postal_code: string | null;
    city: string | null;
    sale_channel: string | null;
    instant_price: number | null;
    motorhome_photos: Array<{ url: string; display_order: number }>;
  };
  bids: Array<{
    bidder_id: string;
    amount: number;
  }>;
}

const DealerAuctions = () => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'ending_soon' | 'price_asc' | 'price_desc' | 'newest' | 'bids'>('ending_soon');
  const [dealerPostalCode, setDealerPostalCode] = useState<string | null>(null);

  // Fetch dealer's postal code for distance calculation
  useEffect(() => {
    const fetchDealerPlz = async () => {
      if (!user) return;
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_zip, address_zip")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setDealerPostalCode(profile.company_zip || profile.address_zip || null);
      }
    };
    fetchDealerPlz();
  }, [user?.id]);

  const fetchAuctions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          motorhome:motorhomes(
            id,
            manufacturer,
            model,
            year,
            mileage,
            postal_code,
            city,
            seller_id,
            sale_channel,
            instant_price,
            motorhome_photos(url, display_order)
          ),
          bids(bidder_id, amount)
        `)
        .eq('status', 'active')
        .gt('end_time', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Supabase error fetching auctions:', error);
        throw error;
      }
      // Filter out dealer's own listings – they can't bid on their own vehicles
      const filtered = (data || []).filter(
        (a: any) => !a.motorhome?.seller_id || a.motorhome.seller_id !== user?.id
      );
      logger.log(`Fetched ${data?.length || 0} active auctions, showing ${filtered.length} (excluding own)`);
      setAuctions(filtered);
    } catch (error: any) {
      logger.error('Error fetching auctions:', error);
      toast.error(`Fehler beim Laden der Auktionen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(fetchAuctions, { pollingInterval: 30_000 });

  const getUserHighestBid = (auction: Auction) => {
    const safeBids = Array.isArray(auction.bids) ? auction.bids : auction.bids ? [auction.bids] : [];
    const userBids = safeBids.filter(bid => bid.bidder_id === user?.id);
    if (userBids.length === 0) return null;
    return Math.max(...userBids.map(bid => Number(bid.amount)));
  };

  const isLeading = (auction: Auction) => {
    const userBid = getUserHighestBid(auction);
    return userBid && userBid === Number(auction.current_bid);
  };

  const getTimeRemaining = (endTime: string) => {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const diff = end - now;

    if (diff <= 0) return 'Beendet';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const filteredAuctions = auctions.filter(auction => {
    if (!auction.motorhome || typeof auction.motorhome !== 'object' || Array.isArray(auction.motorhome)) return false;
    const matchesSearch = `${auction.motorhome.manufacturer || ''} ${auction.motorhome.model || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const sortedAuctions = useMemo(() => {
    const sorted = [...filteredAuctions];
    switch (sortBy) {
      case 'ending_soon':
        return sorted.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
      case 'price_asc': {
        const getP = (x: Auction) => x.motorhome?.sale_channel === 'instant_price'
          ? Number(x.motorhome?.instant_price || 0) : (x.current_bid || x.starting_bid);
        return sorted.sort((a, b) => getP(a) - getP(b));
      }
      case 'price_desc': {
        const getP = (x: Auction) => x.motorhome?.sale_channel === 'instant_price'
          ? Number(x.motorhome?.instant_price || 0) : (x.current_bid || x.starting_bid);
        return sorted.sort((a, b) => getP(b) - getP(a));
      }
      case 'newest':
        return sorted.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
      case 'bids':
        return sorted.sort((a, b) => (Array.isArray(b.bids) ? b.bids.length : 0) - (Array.isArray(a.bids) ? a.bids.length : 0));
      default:
        return sorted;
    }
  }, [filteredAuctions, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Aktive Auktionen</h1>
          <p className="text-sm text-muted-foreground">
            Entdecken Sie verfügbare Wohnmobile und geben Sie Ihr Gebot ab
          </p>
        </div>
        <Badge variant="secondary" className="text-sm sm:text-lg px-3 sm:px-4 py-1 sm:py-2 self-start sm:self-auto">
          {filteredAuctions.length} Auktionen
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen Sie nach Hersteller oder Modell..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sortieren" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ending_soon">Endet bald</SelectItem>
                <SelectItem value="price_desc">Höchster Preis</SelectItem>
                <SelectItem value="price_asc">Niedrigster Preis</SelectItem>
                <SelectItem value="bids">Meiste Gebote</SelectItem>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Auctions Grid */}
      {filteredAuctions.length === 0 ? (
        <Card className="p-8 sm:p-12">
          <div className="text-center">
            <Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">
              {searchTerm
                ? 'Keine Auktionen gefunden'
                : 'Keine aktiven Auktionen'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? 'Versuchen Sie einen anderen Suchbegriff'
                : 'Schauen Sie später wieder vorbei'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedAuctions.map((auction) => {
            const safePhotos = Array.isArray(auction.motorhome.motorhome_photos) ? auction.motorhome.motorhome_photos : auction.motorhome.motorhome_photos ? [auction.motorhome.motorhome_photos] : [];
            const firstPhoto = safePhotos.sort((a, b) => a.display_order - b.display_order)[0]?.url;
            const userBid = getUserHighestBid(auction);
            const leading = isLeading(auction);
            const isExpired = new Date(auction.end_time).getTime() < Date.now();
            const hasBuyNow = (auction.motorhome?.instant_price && Number(auction.motorhome.instant_price) > 0) || (auction.buy_now_price && auction.buy_now_price > 0);
            const isInstantOnly = auction.motorhome?.sale_channel === 'instant_price';
            const bidCount = Array.isArray(auction.bids) ? auction.bids.length : 0;

            return (
              <Link key={auction.id} to={`/auktion/${auction.id}`} className="block group">
                <Card className={`overflow-hidden hover:shadow-lg transition-all h-full ${
                  isExpired ? 'opacity-70' : ''
                } ${leading ? 'ring-2 ring-green-500' : userBid ? 'ring-2 ring-orange-300' : ''}`}>
                  {/* Photo */}
                  <div className="relative h-40 sm:h-44 bg-muted overflow-hidden">
                    {firstPhoto ? (
                      <img
                        src={firstPhoto}
                        alt={`${auction.motorhome.manufacturer} ${auction.motorhome.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Gavel className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Status Badge + Sofortkauf Badge – links oben */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                      {isExpired ? (
                        <Badge variant="secondary" className="shadow-lg text-xs">Beendet</Badge>
                      ) : leading ? (
                        <Badge className="bg-green-500 text-white shadow-lg text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          Führend
                        </Badge>
                      ) : userBid ? (
                        <Badge className="bg-orange-500 text-white shadow-lg text-xs">
                          Überboten
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shadow-lg text-xs">Aktiv</Badge>
                      )}
                      {isInstantOnly && !isExpired && (
                        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Festpreis
                        </Badge>
                      )}
                      {hasBuyNow && !isInstantOnly && !isExpired && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Sofortkauf
                        </Badge>
                      )}
                    </div>

                    {/* Favorite Heart – rechts oben */}
                    <div className="absolute top-2 right-2">
                      <FavoriteButton motorhomeId={auction.motorhome.id} />
                    </div>

                    {/* Time Left */}
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {isExpired ? 'Beendet' : getTimeRemaining(auction.end_time)}
                      </Badge>
                    </div>

                    {/* Bid Count — hide for Festpreis */}
                    {!isInstantOnly && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
                          {bidCount} {bidCount === 1 ? 'Gebot' : 'Gebote'}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="p-3 sm:p-4">
                    <div className="mb-2">
                      <h3 className="font-semibold text-sm line-clamp-1">
                        {auction.motorhome.manufacturer} {auction.motorhome.model}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {auction.motorhome.year} • {auction.motorhome.mileage.toLocaleString('de-DE')} km
                      </p>
                    </div>

                    {/* Location & Distance */}
                    {auction.motorhome.postal_code && (() => {
                      const vehicleCoords = getPlzCoordinates(auction.motorhome.postal_code);
                      const dCoords = dealerPostalCode ? getPlzCoordinates(dealerPostalCode) : null;
                      const dist = vehicleCoords && dCoords
                        ? calculateDistance(
                            { latitude: vehicleCoords.lat, longitude: vehicleCoords.lng },
                            { latitude: dCoords.lat, longitude: dCoords.lng }
                          )
                        : null;
                      return (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>{anonymizePostalCode(auction.motorhome.postal_code)}</span>
                          {dist !== null && (
                            <span className="flex items-center gap-0.5 ml-auto text-primary">
                              <Navigation className="w-3 h-3" />
                              ca. {formatDistance(dist)}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Pricing */}
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{isInstantOnly ? 'Festpreis' : 'Aktuelles Gebot'}</p>
                        <p className={`text-lg font-bold ${isInstantOnly ? 'text-yellow-600' : 'text-primary'}`}>
                          €{(isInstantOnly ? (auction.motorhome?.instant_price || 0) : (auction.current_bid || auction.starting_bid)).toLocaleString('de-DE')}
                        </p>
                      </div>
                      {hasBuyNow && !isInstantOnly && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Sofort</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            €{(auction.motorhome?.instant_price || auction.buy_now_price || 0).toLocaleString('de-DE')}
                          </p>
                        </div>
                      )}
                      {!hasBuyNow && userBid && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Ihr Gebot</p>
                          <p className={`text-sm font-semibold ${leading ? 'text-green-600' : 'text-amber-600'}`}>
                            €{userBid.toLocaleString('de-DE')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full" 
                      size="sm" 
                      variant={isExpired || userBid ? "outline" : "default"} 
                      disabled={isExpired}
                      tabIndex={-1}
                    >
                      {isExpired ? (
                        <>Auktion beendet</>
                      ) : userBid ? (
                        <>
                          <Gavel className="h-4 w-4 mr-2" />
                          Gebot erhöhen
                        </>
                      ) : (
                        <>
                          {isInstantOnly ? <Zap className="h-4 w-4 mr-2" /> : <Gavel className="h-4 w-4 mr-2" />}
                          {isInstantOnly ? 'Jetzt kaufen' : 'Jetzt bieten'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealerAuctions;
