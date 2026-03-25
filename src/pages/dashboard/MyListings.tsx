import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Eye, Edit, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function MyListings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: motorhomes, isLoading } = useQuery({
    queryKey: ["myListings", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          *,
          photos:motorhome_photos (
            url,
            display_order
          ),
          auction:auctions (
            id,
            status,
            current_bid,
            starting_bid,
            end_time
          )
        `)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getSaleChannelBadge = (channel: string) => {
    switch (channel) {
      case "auction":
        return <Badge className="bg-purple-500">Auktion</Badge>;
      case "instant_price":
        return <Badge className="bg-blue-500">Sofortpreis</Badge>;
      case "station":
        return <Badge className="bg-orange-500">Station</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Meine Inserate</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Wohnmobil-Inserate
          </p>
        </div>
        <Link to="/verkaufen/wizard">
          <Button size="lg" className="gradient-hero hover:gradient-hero-hover w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Neues Inserat
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">Lädt...</div>
        </Card>
      ) : !motorhomes || motorhomes.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Keine Inserate vorhanden</h3>
            <p className="text-muted-foreground mb-6">
              Erstellen Sie Ihr erstes Inserat und starten Sie den Verkauf
            </p>
            <Link to="/verkaufen/wizard">
              <Button className="gradient-hero hover:gradient-hero-hover">
                <Plus className="w-4 h-4 mr-2" />
                Erstes Inserat erstellen
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {motorhomes.map((motorhome) => {
            const firstPhoto = motorhome.photos
              ?.sort((a, b) => a.display_order - b.display_order)[0]?.url;
            const auction = motorhome.auction?.[0];

            return (
              <Link key={motorhome.id} to={`/dashboard/listings/${motorhome.id}`} className="no-underline">
              <Card className="overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group bg-card cursor-pointer">
                {/* Image */}
                <div className="relative h-48 bg-muted">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={`${motorhome.manufacturer} ${motorhome.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {getSaleChannelBadge(motorhome.sale_channel)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg line-clamp-1">
                      {motorhome.manufacturer} {motorhome.model}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {motorhome.year} • {motorhome.mileage.toLocaleString()} km • {motorhome.body_type}
                    </p>
                  </div>

                  {/* Auction Info */}
                  {auction && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge
                          variant={auction.status === "active" ? "default" : "secondary"}
                        >
                          {auction.status === "active" ? "Aktiv" : auction.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Aktuelles Gebot:</span>
                        <span className="font-semibold">
                          €{Number(auction.current_bid || auction.starting_bid).toLocaleString()}
                        </span>
                      </div>
                      {auction.end_time && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Endet:</span>
                          <span className="text-sm">
                            {format(new Date(auction.end_time), "dd.MM.yyyy HH:mm", {
                              locale: de,
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price Info */}
                  {motorhome.sale_channel === "instant_price" && motorhome.instant_price && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Sofortpreis:</span>
                      <span className="font-semibold text-lg">
                        €{Number(motorhome.instant_price).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1">
                      <Eye className="w-4 h-4 mr-2" />
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/dashboard/listings/${motorhome.id}/edit`);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Bearbeiten
                    </Button>
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
