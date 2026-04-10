import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Eye, Edit, Plus, ImagePlus, AlertTriangle, ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function MyListings() {
  const { user } = useAuth();
  const { primaryRole } = useUserRole();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'bid_desc' | 'bid_asc'>('newest');

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

  const getSaleChannelBadge = (motorhome: any) => {
    const channel = motorhome.sale_channel;
    const hasInstantBuy = motorhome.instant_price && Number(motorhome.instant_price) > 0;
    switch (channel) {
      case "auction":
        return hasInstantBuy
          ? <Badge className="bg-purple-500">Auktion + Sofortkauf</Badge>
          : <Badge className="bg-purple-500">Auktion</Badge>;
      case "instant_price":
        return <Badge className="bg-purple-500">Auktion + Sofortkauf</Badge>;
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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Meine Inserate</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Wohnmobil-Inserate
          </p>
        </div>
        <Link to={primaryRole === "dealer" ? "/dashboard/listings/new" : "/verkaufen/wizard"}>
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
            <Link to={primaryRole === "dealer" ? "/dashboard/listings/new" : "/verkaufen/wizard"}>
              <Button className="gradient-hero hover:gradient-hero-hover">
                <Plus className="w-4 h-4 mr-2" />
                Erstes Inserat erstellen
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
        <div className="flex justify-end">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[200px]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sortieren" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste zuerst</SelectItem>
              <SelectItem value="oldest">Älteste zuerst</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="bid_desc">Höchstes Gebot</SelectItem>
              <SelectItem value="bid_asc">Niedrigstes Gebot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...motorhomes].sort((a, b) => {
            switch (sortBy) {
              case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              case 'name': return `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`);
              case 'bid_desc': {
                const aAuction = Array.isArray(a.auction) ? a.auction[0] : a.auction;
                const bAuction = Array.isArray(b.auction) ? b.auction[0] : b.auction;
                return Number(bAuction?.current_bid || 0) - Number(aAuction?.current_bid || 0);
              }
              case 'bid_asc': {
                const aAuction = Array.isArray(a.auction) ? a.auction[0] : a.auction;
                const bAuction = Array.isArray(b.auction) ? b.auction[0] : b.auction;
                return Number(aAuction?.current_bid || 0) - Number(bAuction?.current_bid || 0);
              }
              default: return 0;
            }
          }).map((motorhome) => {
            const firstPhoto = motorhome.photos
              ?.sort((a, b) => a.display_order - b.display_order)[0]?.url;
            const auction = Array.isArray(motorhome.auction) ? motorhome.auction[0] : motorhome.auction;

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
                    {getSaleChannelBadge(motorhome)}
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
                  {motorhome.instant_price && Number(motorhome.instant_price) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Sofortpreis:</span>
                      <span className="font-semibold text-lg">
                        €{Number(motorhome.instant_price).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Photo missing warning */}
                  {(!motorhome.photos || motorhome.photos.length === 0) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Fotos fehlen! Ohne Fotos kann Ihr Inserat nicht vermittelt werden.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className={`flex-1 gap-2 ${(!motorhome.photos || motorhome.photos.length === 0) ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                      variant={(!motorhome.photos || motorhome.photos.length === 0) ? 'default' : 'outline'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/dashboard/listings/${motorhome.id}/edit?tab=photos`);
                      }}
                    >
                      <ImagePlus className="w-4 h-4" />
                      Fotos
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
                    <Button variant="ghost" className="px-3">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
