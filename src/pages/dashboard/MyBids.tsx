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
import { format } from "date-fns";
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
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
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
  // FIX: Only status "sold" counts as "won". Status "ended" means the auction
  // ended WITHOUT a sale (reserve not met / no bids), so nobody won.
  // "kaufchance" is also included as "won" potential since the dealer was invited.
  const filteredBids = groupedBids ? Object.values(groupedBids).filter((group: any) => {
    if (filter === "all") return true;
    if (filter === "active") return group.auction.status === "active" || group.auction.status === "kaufchance";
    if (filter === "won") return group.auction.status === "sold" && group.isWinning;
    if (filter === "lost") return (group.auction.status === "sold" && !group.isWinning) || group.auction.status === "ended";
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

  // Count for tabs (consistent with filter logic above)
  const counts = {
    all: Object.keys(groupedBids || {}).length,
    active: Object.values(groupedBids || {}).filter((g: any) => g.auction.status === "active" || g.auction.status === "kaufchance").length,
    won: Object.values(groupedBids || {}).filter((g: any) => g.auction.status === "sold" && g.isWinning).length,
    lost: Object.values(groupedBids || {}).filter((g: any) => (g.auction.status === "sold" && !g.isWinning) || g.auction.status === "ended").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">Meine Gebote</h1>
          <p className="text-sm text-muted-foreground">
            Übersicht über alle Ihre Gebote
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full md:w-auto">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-auto h-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2 py-1.5">
                Alle ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs sm:text-sm px-2 py-1.5">
                Aktiv ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="won" className="text-xs sm:text-sm px-2 py-1.5">
                Gewonnen ({counts.won})
              </TabsTrigger>
              <TabsTrigger value="lost" className="text-xs sm:text-sm px-2 py-1.5">
                Verloren ({counts.lost})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
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
        <Card className="p-6">
          <div className="text-center text-muted-foreground text-sm">Lädt...</div>
        </Card>
      ) : !groupedBids || Object.keys(groupedBids).length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Keine Gebote vorhanden</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Stöbern Sie durch aktive Auktionen und geben Sie Ihr erstes Gebot ab
            </p>
            <Link to="/kaufen">
              <Button size="sm" className="gradient-hero hover:gradient-hero-hover">
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Auktionen ansehen
              </Button>
            </Link>
          </div>
        </Card>
      ) : filteredBids.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Keine Gebote in dieser Kategorie</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {filter === "active" && "Sie haben keine aktiven Gebote"}
              {filter === "won" && "Sie haben noch keine Auktionen gewonnen"}
              {filter === "lost" && "Sie haben keine verlorenen Auktionen"}
            </p>
            <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
              Alle Gebote anzeigen
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedBids.map((group: any) => {
            const motorhome = group.auction?.motorhome;
            const safePhotos = Array.isArray(motorhome?.photos) ? motorhome.photos : motorhome?.photos ? [motorhome.photos] : [];
            const firstPhoto = [...safePhotos].sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
            const bidCount = group.bids.length;
            const isActive = group.auction.status === "active";
            const timeLeft = new Date(group.auction.end_time).getTime() - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

            // Status badge config
            let statusBadge: { icon: React.ReactNode; label: string; className: string } | null = null;
            if (isActive && group.isWinning) {
              statusBadge = { icon: <Trophy className="w-3 h-3" />, label: "Führend", className: "bg-green-500 text-white" };
            } else if (isActive && !group.isWinning) {
              statusBadge = { icon: <AlertCircle className="w-3 h-3" />, label: "Überboten", className: "bg-orange-500 text-white" };
            } else if (!isActive && group.isWinning) {
              statusBadge = { icon: <CheckCircle className="w-3 h-3" />, label: "Gewonnen", className: "bg-green-600 text-white" };
            } else if (!isActive && !group.isWinning) {
              statusBadge = { icon: <XCircle className="w-3 h-3" />, label: "Verloren", className: "bg-gray-500 text-white" };
            }

            return (
              <Link
                key={group.auction.id}
                to={`/auktion/${group.auction.id}`}
                className="block group"
              >
                <Card className="overflow-hidden border hover:border-primary/40 transition-all duration-200 hover:shadow-md cursor-pointer h-full bg-card">
                  {/* Compact horizontal layout for each card */}
                  <div className="flex flex-row h-full">
                    {/* Thumbnail */}
                    <div className="relative w-28 sm:w-32 flex-shrink-0">
                      {firstPhoto ? (
                        <img
                          src={firstPhoto}
                          alt={`${motorhome?.manufacturer} ${motorhome?.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Gavel className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      {/* Status badge on image */}
                      {statusBadge && (
                        <div className="absolute top-1.5 right-1.5">
                          <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5 gap-0.5`}>
                            {statusBadge.icon}
                            {statusBadge.label}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                          {motorhome?.manufacturer} {motorhome?.model}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Baujahr {motorhome?.year}
                        </p>
                      </div>

                      {/* Bid info - compact grid */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Aktuell:</span>
                          <span className="font-semibold tabular-nums">
                            {Number(group.auction.current_bid).toLocaleString("de-DE")} €
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Ihr Gebot:</span>
                          <span className="font-semibold text-primary tabular-nums">
                            {group.highestBid.toLocaleString("de-DE")} €
                          </span>
                        </div>
                      </div>

                      {/* Footer row */}
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" />
                            {bidCount}
                          </span>
                          {group.bids.some((b: any) => b.is_autobid && b.max_autobid_amount != null) && (
                            <span className="flex items-center gap-0.5 text-primary">
                              <Zap className="w-3 h-3" />
                              Auto
                            </span>
                          )}
                        </div>
                        {group.auction.end_time && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {isActive
                              ? (hoursLeft > 24
                                  ? `${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`
                                  : hoursLeft > 0
                                  ? `${hoursLeft}h`
                                  : "Endet bald")
                              : format(new Date(group.auction.end_time), "dd.MM.yy", { locale: de })
                            }
                          </span>
                        )}
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
