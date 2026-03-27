import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
// Select imports removed - status filter not needed for dealers
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { Gavel, Search, Clock, TrendingUp, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { anonymizePostalCode, getPlzCoordinates } from "@/lib/plzCoordinates";
import { calculateDistance, formatDistance } from "@/lib/geolocation";

interface Auction {
  id: string;
  status: string;
  current_bid: number;
  starting_bid: number;
  reserve_price: number;
  end_time: string;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    mileage: number;
    postal_code: string | null;
    city: string | null;
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
  const [dealerPostalCode, setDealerPostalCode] = useState<string | null>(null);

  // Fetch dealer's postal code for distance calculation
  useEffect(() => {
    const fetchDealerPlz = async () => {
      if (!user) return;
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
  }, [user]);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
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
            motorhome_photos(url, display_order)
          ),
          bids(bidder_id, amount)
        `)
        .eq('status', 'active') // Only show active auctions to dealers
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Supabase error fetching auctions:', error);
        throw error;
      }
      logger.log(`Fetched ${data?.length || 0} active auctions`);
      setAuctions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      logger.error('Error fetching auctions:', error);
      toast.error(`Fehler beim Laden der Auktionen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Aktive Auktionen</h1>
          <p className="text-muted-foreground">
            Entdecken Sie verfügbare Wohnmobile und geben Sie Ihr Gebot ab
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {filteredAuctions.length} Auktionen
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen Sie nach Hersteller oder Modell..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Status filter removed - dealers only see active auctions */}
          </div>
        </CardContent>
      </Card>

      {/* Auctions Grid */}
      {filteredAuctions.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAuctions.map((auction) => {
            const safePhotos = Array.isArray(auction.motorhome.motorhome_photos) ? auction.motorhome.motorhome_photos : auction.motorhome.motorhome_photos ? [auction.motorhome.motorhome_photos] : [];
            const firstPhoto = safePhotos.sort((a, b) => a.display_order - b.display_order)[0]?.url;
            const userBid = getUserHighestBid(auction);
            const leading = isLeading(auction);

            const isExpired = new Date(auction.end_time).getTime() < Date.now();

            return (
              <Card key={auction.id} className={`overflow-hidden hover-lift ${isExpired ? 'opacity-70' : ''}`}>
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={`${auction.motorhome.manufacturer} ${auction.motorhome.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Kein Bild
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <Badge variant={isExpired ? 'secondary' : auction.status === 'active' ? 'default' : 'secondary'}>
                      {isExpired ? 'Beendet' : auction.status === 'active' ? 'Aktiv' : 'Entwurf'}
                    </Badge>
                    {!isExpired && leading && (
                      <Badge className="bg-green-600 hover:bg-green-700">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Führend
                      </Badge>
                    )}
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {auction.motorhome.manufacturer} {auction.motorhome.model}
                  </CardTitle>
                  <CardDescription>
                    {auction.motorhome.year} • {auction.motorhome.mileage.toLocaleString('de-DE')} km
                  </CardDescription>
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
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Aktuelles Gebot:</span>
                      <span className="font-semibold">
                        €{(auction.current_bid || auction.starting_bid).toLocaleString('de-DE')}
                      </span>
                    </div>
                    {userBid && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ihr Gebot:</span>
                        <span className={`font-semibold ${leading ? 'text-green-600' : 'text-amber-600'}`}>
                          €{userBid.toLocaleString('de-DE')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{isExpired ? 'Beendet' : getTimeRemaining(auction.end_time)}</span>
                    </div>
                  </div>
                  {isExpired ? (
                    <Button variant="outline" className="w-full" disabled>
                      Auktion beendet
                    </Button>
                  ) : (
                    <Button variant={userBid ? "outline" : "default"} className="w-full" asChild>
                      <Link to={`/auktion/${auction.id}`}>
                        <Gavel className="h-4 w-4 mr-2" />
                        {userBid ? 'Gebot erhöhen' : 'Jetzt bieten'}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealerAuctions;
