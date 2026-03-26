import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerPending } from "@/hooks/useDealerPending";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Search,
  Eye,
  Lock,
  Euro,
  MapPin,
  Calendar,
  Truck,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const DealerInstantBuy = () => {
  const { user } = useAuth();
  const { isPendingDealer, isRejectedDealer } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch instant-buy motorhomes (sale_channel = 'instant_price', status = 'available')
  const { data: instantBuyMothorhomes, isLoading } = useQuery({
    queryKey: ["dealerInstantBuy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          id,
          manufacturer,
          model,
          year,
          body_type,
          listing_number,
          instant_price,
          mileage,
          location_city,
          location_state,
          sale_channel,
          status,
          photos:motorhome_photos(url, display_order)
        `)
        .eq("sale_channel", "instant_price")
        .eq("status", "available")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching instant buy motorhomes:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
  });

  // Filter by search query
  const filteredMothorhomes = useMemo(() => {
    if (!instantBuyMothorhomes) return [];
    if (!searchQuery.trim()) return instantBuyMothorhomes;

    const q = searchQuery.toLowerCase();
    return instantBuyMothorhomes.filter((mh: any) => {
      const manufacturer = (mh.manufacturer || "").toLowerCase();
      const model = (mh.model || "").toLowerCase();
      const listingNumber = (mh.listing_number || "").toLowerCase();
      return manufacturer.includes(q) || model.includes(q) || listingNumber.includes(q);
    });
  }, [instantBuyMothorhomes, searchQuery]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Sofortkauf-Angebote
          </h1>
          <p className="text-muted-foreground">
            {instantBuyMothorhomes?.length || 0} Fahrzeuge zum Sofortkauf verfügbar
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          <Euro className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Festpreis &ndash; kein Bieten nötig</span>
        </div>
      </div>

      {/* Search Bar */}
      {instantBuyMothorhomes && instantBuyMothorhomes.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hersteller, Modell oder Inserat-Nr. suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Motorhome Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : filteredMothorhomes && filteredMothorhomes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMothorhomes.map((mh: any) => {
            const photos = Array.isArray(mh.photos) ? mh.photos : mh.photos ? [mh.photos] : [];
            const mainPhoto = photos.find((p: any) => p.display_order === 0)?.url || photos[0]?.url;

            return (
              <div key={mh.id} className={`${isLocked ? 'pointer-events-none' : ''}`}>
                <Link to={isLocked ? '#' : `/kaufen`} onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
                  <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer h-full ring-2 ring-green-200 hover:ring-green-400">
                    {/* Photo */}
                    <div className="relative h-40 bg-muted">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={`${mh.manufacturer} ${mh.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Truck className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Sofortkauf Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <Badge className="bg-green-600 text-white shadow-lg text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Sofortkauf
                        </Badge>
                      </div>

                      {/* Body Type Badge */}
                      {mh.body_type && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="shadow-lg text-xs">
                            {mh.body_type}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h3 className="font-semibold text-sm line-clamp-1">
                          {mh.manufacturer} {mh.model}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {mh.year && <><Calendar className="inline h-3 w-3 mr-1" />{mh.year}</>}
                          {mh.listing_number && <> &bull; #{mh.listing_number}</>}
                        </p>
                      </div>

                      {/* Location */}
                      {(mh.location_city || mh.location_state) && (
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[mh.location_city, mh.location_state].filter(Boolean).join(", ")}
                        </p>
                      )}

                      {/* Price */}
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Sofortkauf-Preis</p>
                          {mh.instant_price ? (
                            <p className="text-lg font-bold text-green-600">
                              €{mh.instant_price.toLocaleString('de-DE')}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-muted-foreground">
                              Preis auf Anfrage
                            </p>
                          )}
                        </div>
                        {mh.mileage && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{Number(mh.mileage).toLocaleString('de-DE')} km</p>
                          </div>
                        )}
                      </div>

                      <Button className="w-full mt-3 bg-green-600 hover:bg-green-700" size="sm" disabled={isLocked}>
                        {isLocked ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Gesperrt
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Details ansehen
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">Keine Sofortkauf-Angebote</h3>
            <p className="text-muted-foreground mb-4">
              Derzeit sind keine Fahrzeuge zum Sofortkauf verfügbar
            </p>
            <Link to={isLocked ? '#' : '/kaufen'} onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
              <Button disabled={isLocked}>
                {isLocked ? <Lock className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {isLocked ? 'Gesperrt' : 'Marktplatz besuchen'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DealerInstantBuy;
