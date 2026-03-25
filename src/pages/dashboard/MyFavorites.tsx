import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Car, Calendar, Gauge, MapPin, ExternalLink, Trash2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { getCountryFlag } from "@/lib/geolocation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface FavoriteVehicle {
  id: string;
  motorhome_id: string;
  created_at: string;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    mileage: number;
    status: string;
    country: string | null;
    listing_number: string | null;
    photos: Array<{
      url: string;
      display_order: number;
    }>;
    auctions: Array<{
      id: string;
      status: string;
      current_bid: number | null;
      end_time: string;
    }>;
  };
}

export default function MyFavorites() {
  const { user } = useAuth();
  const { removeFavorite } = useFavorites();
  const [favorites, setFavorites] = useState<FavoriteVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadFavorites = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_favorites")
          .select(`
            id,
            motorhome_id,
            created_at,
            motorhome:motorhomes (
              id,
              manufacturer,
              model,
              year,
              mileage,
              status,
              country,
              listing_number,
              photos:motorhome_photos (url, display_order),
              auctions (id, status, current_bid, end_time)
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setFavorites((data as unknown as FavoriteVehicle[]) || []);
      } catch (error) {
        console.error("Error loading favorites:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  const handleRemove = async (motorhomeId: string) => {
    await removeFavorite(motorhomeId);
    setFavorites(prev => prev.filter(f => f.motorhome_id !== motorhomeId));
  };

  const getAuctionLink = (favorite: FavoriteVehicle): string => {
    const safeAuctions = Array.isArray(favorite.motorhome.auctions) ? favorite.motorhome.auctions : favorite.motorhome.auctions ? [favorite.motorhome.auctions] : [];
    const activeAuction = safeAuctions.find(
      a => a.status === 'active' || a.status === 'scheduled'
    );
    if (activeAuction) {
      return `/auktion/${activeAuction.id}`;
    }
    return `/kaufen`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meine Favoriten</h1>
        <p className="text-muted-foreground">
          Ihre gespeicherten Fahrzeuge
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : favorites.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Keine Favoriten</h3>
            <p className="text-muted-foreground mb-4">
              Sie haben noch keine Fahrzeuge zu Ihren Favoriten hinzugefügt.
            </p>
            <Button asChild>
              <Link to="/kaufen">Fahrzeuge durchsuchen</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {favorites.map((favorite) => {
            const motorhome = favorite.motorhome;
            const safePhotos = Array.isArray(motorhome.photos) ? motorhome.photos : motorhome.photos ? [motorhome.photos] : [];
            const firstPhoto = [...safePhotos].sort((a, b) => a.display_order - b.display_order)[0];
            const safeAucts = Array.isArray(motorhome.auctions) ? motorhome.auctions : motorhome.auctions ? [motorhome.auctions] : [];
            const activeAuction = safeAucts.find(a => a.status === 'active');

            return (
              <Card key={favorite.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Image */}
                  <div className="relative w-full md:w-48 h-40 md:h-auto flex-shrink-0">
                    {firstPhoto ? (
                      <img
                        src={firstPhoto.url}
                        alt={`${motorhome.manufacturer} ${motorhome.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Car className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {motorhome.status === 'sold' && (
                      <Badge className="absolute top-2 left-2 bg-green-500">
                        Verkauft
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="flex-1 p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">
                            {motorhome.manufacturer} {motorhome.model}
                          </h3>
                          {motorhome.country && (
                            <span title={motorhome.country}>
                              {getCountryFlag(motorhome.country)}
                            </span>
                          )}
                          {motorhome.listing_number && (
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              #{motorhome.listing_number}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{motorhome.year}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Gauge className="w-4 h-4" />
                            <span>{motorhome.mileage?.toLocaleString('de-DE')} km</span>
                          </div>
                        </div>

                        {activeAuction && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Aktive Auktion</Badge>
                            {activeAuction.current_bid && (
                              <span className="font-semibold text-primary">
                                {activeAuction.current_bid.toLocaleString('de-DE')} €
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-2">
                          Hinzugefügt am {format(new Date(favorite.created_at), "dd.MM.yyyy", { locale: de })}
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2">
                        <Button asChild size="sm" className="flex-1 md:flex-none">
                          <Link to={getAuctionLink(favorite)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ansehen
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemove(favorite.motorhome_id)}
                          className="flex-1 md:flex-none text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Entfernen
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
