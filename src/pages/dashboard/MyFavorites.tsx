import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Car, Calendar, Gauge, Trash2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { CountryFlag } from "@/components/CountryFlag";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface FavoriteVehicle {
  id: string;
  vehicle_id: string;
  created_at: string;
  vehicle: {
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
    }> | {
      id: string;
      status: string;
      current_bid: number | null;
      end_time: string;
    } | null;
  };
}

export default function MyFavorites() {
  const { user } = useAuth();
  const { removeFavorite } = useFavorites();
  const [favorites, setFavorites] = useState<FavoriteVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!user) return;

    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    try {
      const { data, error } = await supabase
        .from("user_favorites")
        .select(`
          id,
          vehicle_id,
          created_at,
          vehicle:vehicles (
            id,
            manufacturer,
            model,
            year,
            mileage,
            status,
            country,
            listing_number,
            photos:vehicle_photos (url, display_order),
            auctions (id, status, current_bid, end_time)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites((data as unknown as FavoriteVehicle[]) || []);
      setLoadError(false);
    } catch (error) {
      console.error("Error loading favorites:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(loadFavorites, { enabled: !!user, pollingInterval: 60_000 });

  const handleRemove = async (e: React.MouseEvent, vehicleId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await removeFavorite(vehicleId);
    setFavorites(prev => prev.filter(f => f.vehicle_id !== vehicleId));
  };

  const getAuctionLink = (favorite: FavoriteVehicle): string => {
    const auctionsData = favorite.vehicle.auctions;
    const auctionsArray = Array.isArray(auctionsData) ? auctionsData : auctionsData ? [auctionsData] : [];
    const activeAuction = auctionsArray.find(
      a => a.status === 'active' || a.status === 'scheduled'
    );
    if (activeAuction) {
      return `/auktion/${activeAuction.id}`;
    }
    return `/kaufen`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Meine Favoriten</h1>
        <p className="text-sm text-muted-foreground">
          Ihre gespeicherten Fahrzeuge
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : loadError ? (
        <Card className="p-8">
          <div className="text-center">
            <Heart className="w-12 h-12 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">Laden fehlgeschlagen</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Favoriten konnten nicht geladen werden. Bitte versuchen Sie es erneut.
            </p>
            <Button size="sm" variant="outline" onClick={loadFavorites}>Erneut versuchen</Button>
          </div>
        </Card>
      ) : favorites.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">Keine Favoriten</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sie haben noch keine Fahrzeuge zu Ihren Favoriten hinzugefügt.
            </p>
            <Button size="sm" asChild>
              <Link to="/kaufen">Fahrzeuge durchsuchen</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {favorites.map((favorite) => {
            const vehicle = favorite.vehicle;
            const photosData = vehicle.photos;
            const photosArray = Array.isArray(photosData) ? photosData : photosData ? [photosData] : [];
            const firstPhoto = [...photosArray].sort((a, b) => a.display_order - b.display_order)[0];
            const mAuctionsData = vehicle.auctions;
            const mAuctionsArray = Array.isArray(mAuctionsData) ? mAuctionsData : mAuctionsData ? [mAuctionsData] : [];
            const activeAuction = mAuctionsArray.find(a => a.status === 'active');

            return (
              <Link
                key={favorite.id}
                to={getAuctionLink(favorite)}
                className="block group"
              >
                <Card className="overflow-hidden border hover:border-primary/40 transition-all duration-200 hover:shadow-md cursor-pointer h-full bg-card">
                  <div className="flex flex-row h-full">
                    {/* Thumbnail */}
                    <div className="relative w-28 sm:w-32 flex-shrink-0">
                      {firstPhoto ? (
                        <img
                          src={firstPhoto.url}
                          alt={`${vehicle.manufacturer} ${vehicle.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Car className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      {vehicle.status === 'sold' && (
                        <Badge className="absolute top-1.5 left-1.5 bg-green-500 text-[10px] px-1.5 py-0.5">
                          Verkauft
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                            {vehicle.manufacturer} {vehicle.model}
                          </h3>
                          {vehicle.country && (
                            <CountryFlag countryCode={vehicle.country} size="sm" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {vehicle.year}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Gauge className="w-3 h-3" />
                            {vehicle.mileage?.toLocaleString('de-DE')} km
                          </span>
                          {vehicle.listing_number && (
                            <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                              #{vehicle.listing_number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Auction info + actions */}
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
                        <div className="text-xs">
                          {activeAuction ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Aktive Auktion</Badge>
                              {activeAuction.current_bid && (
                                <span className="font-semibold text-primary">
                                  {activeAuction.current_bid.toLocaleString('de-DE')} €
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              Hinzugefügt {format(new Date(favorite.created_at), "dd.MM.yy", { locale: de })}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleRemove(e, favorite.vehicle_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
