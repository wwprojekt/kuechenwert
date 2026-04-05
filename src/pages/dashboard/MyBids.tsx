import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gavel, Eye, TrendingUp, Zap, Trophy, AlertCircle, Clock, CheckCircle, XCircle, ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type FilterType = "all" | "active" | "won" | "lost";

export default function MyBids() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<'ending_soon' | 'bid_desc' | 'bid_asc' | 'my_bid_desc' | 'newest'>('ending_soon');

  const { data: bids, isLoading } = useQuery({
    queryKey: ["myBids", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("bids")
        .select(`
          *,
          auction:auctions (
            id,
            status,
            current_bid,
            end_time,
            motorhome:motorhomes (
              manufacturer,
              model,
              year,
              photos:motorhome_photos (
                url,
                display_order
              )
            )
          )
        `)
        .eq("bidder_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const groupedBids = bids?.reduce((acc, bid) => {
    const auctionId = bid.auction?.id;
    if (!auctionId) return acc;

    if (!acc[auctionId]) {
      acc[auctionId] = {
        auction: bid.auction,
        bids: [],
        highestBid: 0,
        isWinning: false,
      };
    }

    acc[auctionId].bids.push(bid);
    if (Number(bid.amount) > acc[auctionId].highestBid) {
      acc[auctionId].highestBid = Number(bid.amount);
    }

    const currentBid = Number(bid.auction?.current_bid || 0);
    acc[auctionId].isWinning = acc[auctionId].highestBid >= currentBid;

    return acc;
  }, {} as Record<string, any>);

  // Filter grouped bids
  const filteredBids = groupedBids ? Object.values(groupedBids).filter((group: any) => {
    if (filter === "all") return true;
    if (filter === "active") return group.auction.status === "active";
    if (filter === "won") return group.auction.status === "completed" && group.isWinning;
    if (filter === "lost") return group.auction.status === "completed" && !group.isWinning;
    return true;
  }) : [];

  const sortedBids = useMemo(() => {
    const sorted = [...filteredBids];
    switch (sortBy) {
      case 'ending_soon': return sorted.sort((a: any, b: any) => new Date(a.auction.end_time).getTime() - new Date(b.auction.end_time).getTime());
      case 'bid_desc': return sorted.sort((a: any, b: any) => Number(b.auction.current_bid) - Number(a.auction.current_bid));
      case 'bid_asc': return sorted.sort((a: any, b: any) => Number(a.auction.current_bid) - Number(b.auction.current_bid));
      case 'my_bid_desc': return sorted.sort((a: any, b: any) => b.highestBid - a.highestBid);
      case 'newest': return sorted.sort((a: any, b: any) => new Date(b.bids[0]?.created_at || 0).getTime() - new Date(a.bids[0]?.created_at || 0).getTime());
      default: return sorted;
    }
  }, [filteredBids, sortBy]);

  // Count for tabs
  const counts = {
    all: Object.keys(groupedBids || {}).length,
    active: Object.values(groupedBids || {}).filter((g: any) => g.auction.status === "active").length,
    won: Object.values(groupedBids || {}).filter((g: any) => g.auction.status === "completed" && g.isWinning).length,
    lost: Object.values(groupedBids || {}).filter((g: any) => g.auction.status === "completed" && !g.isWinning).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">Meine Gebote</h1>
          <p className="text-muted-foreground">
            Übersicht über alle Ihre Gebote
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full md:w-auto">
            <TabsList className="grid grid-cols-4 w-full md:w-auto">
              <TabsTrigger value="all" className="text-xs md:text-sm">
                Alle ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs md:text-sm">
                Aktiv ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="won" className="text-xs md:text-sm">
                Gewonnen ({counts.won})
              </TabsTrigger>
              <TabsTrigger value="lost" className="text-xs md:text-sm">
                Verloren ({counts.lost})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sortieren" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ending_soon">Endet bald</SelectItem>
              <SelectItem value="bid_desc">Höchstes Gebot</SelectItem>
              <SelectItem value="bid_asc">Niedrigstes Gebot</SelectItem>
              <SelectItem value="my_bid_desc">Mein höchstes Gebot</SelectItem>
              <SelectItem value="newest">Neuestes Gebot</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">Lädt...</div>
        </Card>
      ) : !groupedBids || Object.keys(groupedBids).length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Gavel className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Keine Gebote vorhanden</h3>
            <p className="text-muted-foreground mb-6">
              Stöbern Sie durch aktive Auktionen und geben Sie Ihr erstes Gebot ab
            </p>
            <Link to="/kaufen">
              <Button className="gradient-hero hover:gradient-hero-hover">
                <Eye className="w-4 h-4 mr-2" />
                Auktionen ansehen
              </Button>
            </Link>
          </div>
        </Card>
      ) : filteredBids.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Gavel className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Keine Gebote in dieser Kategorie</h3>
            <p className="text-muted-foreground mb-4">
              {filter === "active" && "Sie haben keine aktiven Gebote"}
              {filter === "won" && "Sie haben noch keine Auktionen gewonnen"}
              {filter === "lost" && "Sie haben keine verlorenen Auktionen"}
            </p>
            <Button variant="outline" onClick={() => setFilter("all")}>
              Alle Gebote anzeigen
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedBids.map((group: any) => {
            const motorhome = group.auction?.motorhome;
            const safePhotos = Array.isArray(motorhome?.photos) ? motorhome.photos : motorhome?.photos ? [motorhome.photos] : [];
            const firstPhoto = [...safePhotos].sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
            const bidCount = group.bids.length;
            const isActive = group.auction.status === "active";
            const timeLeft = new Date(group.auction.end_time).getTime() - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

            return (
              <Card key={group.auction.id} className="overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group bg-card">
                {/* Image */}
                <div className="relative h-48 bg-muted">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={`${motorhome?.manufacturer} ${motorhome?.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gavel className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {/* Time remaining badge for active auctions */}
                    {isActive && (
                      <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                        <Clock className="w-3 h-3 mr-1" />
                        {hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d` : hoursLeft > 0 ? `${hoursLeft}h` : "Endet bald"}
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    {/* Status badges */}
                    {isActive && group.isWinning && (
                      <Badge className="bg-green-500 text-white">
                        <Trophy className="w-3 h-3 mr-1" />
                        Führend
                      </Badge>
                    )}
                    {isActive && !group.isWinning && (
                      <Badge variant="destructive" className="bg-orange-500">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Überboten
                      </Badge>
                    )}
                    {!isActive && group.isWinning && (
                      <Badge className="bg-green-600 text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Gewonnen
                      </Badge>
                    )}
                    {!isActive && !group.isWinning && (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Verloren
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg line-clamp-1">
                      {motorhome?.manufacturer} {motorhome?.model}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Baujahr {motorhome?.year}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Aktuelles Gebot:</span>
                      <span className="font-semibold">
                        €{Number(group.auction.current_bid).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Ihr höchstes Gebot:</span>
                      <span className="font-semibold text-primary">
                        €{group.highestBid.toLocaleString()}
                      </span>
                    </div>
                    {group.bids.some((b: any) => b.is_autobid && b.max_autobid_amount != null) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Autobid Max:
                        </span>
                        <span className="font-semibold text-primary">
                          €{Math.max(...group.bids.filter((b: any) => b.is_autobid && b.max_autobid_amount != null).map((b: any) => Number(b.max_autobid_amount))).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Ihre Gebote:</span>
                      <Badge variant="outline">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {bidCount}
                      </Badge>
                    </div>
                    {group.auction.end_time && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Endet:</span>
                        <span className="text-sm">
                          {format(new Date(group.auction.end_time), "dd.MM.yyyy HH:mm", {
                            locale: de,
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Link to={`/auktion/${group.auction.id}`}>
                    <Button className="w-full gradient-hero hover:gradient-hero-hover">
                      <Eye className="w-4 h-4 mr-2" />
                      Zur Auktion
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
