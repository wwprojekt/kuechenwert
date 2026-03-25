import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { 
  TrendingUp, 
  Gavel, 
  Euro, 
  Volume2, 
  VolumeX,
  Eye,
  ArrowUpRight,
  Sparkles,
  Trophy,
  Target,
  Clock,
  CheckCircle,
  Plus,
  Search,
  Filter,
  Award,
  Star,
  Zap,
  Crown,
  Lock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { useDealerPending } from "@/hooks/useDealerPending";
import PendingDealerBanner from "@/components/dashboard/PendingDealerBanner";
import PendingDealerDocumentUpload from "@/components/dashboard/PendingDealerDocumentUpload";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const DealerDashboard = () => {
  const { user } = useAuth();
  useSettings(); // Initialize settings context
  const { isPendingDealer, isRejectedDealer, hasDealerApplication, application, refetch: refetchApp } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;
  const audioNotifications = useAudioNotification({ enabled: true, volume: 0.8 });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "mybids" | "leading" | "outbid" | "nobid">("all");

  // Fetch dealer level
  const { data: dealerLevel } = useQuery({
    queryKey: ["dealerLevel", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("dealer_levels")
        .select("*")
        .eq("dealer_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error fetching dealer level:", error);
        return null;
      }
      return data;
    },
    enabled: !!user,
  });

  // Fetch dealer statistics
  const { data: stats } = useQuery({
    queryKey: ["dealerStats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [bidsRes, soldMotorhomesRes, commissionsRes] = await Promise.all([
        supabase
          .from("bids")
          .select("*, auctions(status, current_bid, end_time, motorhome:motorhomes(manufacturer, model, listing_number, body_type, year))")
          .eq("bidder_id", user.id),
        supabase
          .from("motorhomes")
          .select("id, manufacturer, model, sold_at, auctions(id, status, current_bid, starting_bid, end_time)")
          .eq("sold_to", user.id),
        supabase
          .from("commission_calculations")
          .select("*")
          .eq("dealer_id", user.id)
      ]);

      const activeBids = bidsRes.data?.filter(bid => bid.auctions?.status === "active") || [];
      const wonMothorhomes = soldMotorhomesRes.data || [];
      const totalSpent = wonMothorhomes.reduce((sum, mh: any) => {
        const auction = mh.auctions?.[0];
        return sum + Number(auction?.current_bid || 0);
      }, 0);
      const totalCommissions = commissionsRes.data?.reduce((sum, calc) => sum + Number(calc.commission_amount || 0), 0) || 0;

      return {
        totalBids: bidsRes.data?.length || 0,
        activeBids: activeBids.length,
        wonAuctions: wonMothorhomes.length,
        totalSpent,
        totalCommissions,
        recentBids: bidsRes.data?.slice(0, 5) || [],
        allBids: bidsRes.data || [],
        inventory: wonMothorhomes,
        leadingBids: activeBids.filter(bid => bid.amount === bid.auctions?.current_bid).length,
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch ALL active auctions for dealer to browse (includes user's bids if any)
  const { data: recentAuctions } = useQuery({
    queryKey: ["allActiveAuctions", user?.id],
    queryFn: async () => {
      // First get all active auctions with left join for resilience
      const { data: auctions, error: auctionsError } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes!left(
            id,
            manufacturer,
            model,
            year,
            body_type,
            listing_number,
            photos:motorhome_photos(url, display_order)
          )
        `)
        .eq("status", "active")
        .order("end_time", { ascending: true })
        .limit(20);

      if (auctionsError) {
        console.error("Error fetching active auctions:", auctionsError);
        throw auctionsError;
      }

      // Then get user's bids for these auctions
      if (auctions && auctions.length > 0 && user?.id) {
        const auctionIds = auctions.map(a => a.id);
        const { data: userBids } = await supabase
          .from("bids")
          .select("auction_id, amount")
          .eq("bidder_id", user.id)
          .in("auction_id", auctionIds)
          .order("amount", { ascending: false });

        // Merge bids into auctions
        return auctions.map(auction => ({
          ...auction,
          bids: userBids?.filter(b => b.auction_id === auction.id) || []
        }));
      }

      return auctions?.map(auction => ({ ...auction, bids: [] })) || [];
    },
    enabled: !!user,
  });

  // Recommendation logic: analyze past bids to find preferred manufacturers and price ranges
  const dealerPreferences = useMemo(() => {
    if (!stats?.allBids || stats.allBids.length === 0) return null;

    const manufacturerCount: Record<string, number> = {};
    const bodyTypeCount: Record<string, number> = {};
    const bidAmounts: number[] = [];

    for (const bid of stats.allBids) {
      const motorhome = (bid as any).auctions?.motorhome;
      if (motorhome?.manufacturer) {
        manufacturerCount[motorhome.manufacturer] = (manufacturerCount[motorhome.manufacturer] || 0) + 1;
      }
      if (motorhome?.body_type) {
        bodyTypeCount[motorhome.body_type] = (bodyTypeCount[motorhome.body_type] || 0) + 1;
      }
      bidAmounts.push(bid.amount);
    }

    // Top manufacturers (those with at least 1 bid)
    const topManufacturers = Object.entries(manufacturerCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Top body types
    const topBodyTypes = Object.entries(bodyTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Price range preference (average bid ± 50%)
    const avgBid = bidAmounts.reduce((a, b) => a + b, 0) / bidAmounts.length;
    const minPrice = avgBid * 0.5;
    const maxPrice = avgBid * 1.5;

    return { topManufacturers, topBodyTypes, minPrice, maxPrice };
  }, [stats?.allBids]);

  // Check if an auction matches dealer preferences
  const isRecommended = (auction: any): boolean => {
    if (!dealerPreferences) return false;
    const motorhome = auction.motorhome;
    if (!motorhome) return false;

    const matchesManufacturer = dealerPreferences.topManufacturers.includes(motorhome.manufacturer);
    const matchesBodyType = motorhome.body_type && dealerPreferences.topBodyTypes.includes(motorhome.body_type);
    const currentBid = auction.current_bid || auction.starting_bid || 0;
    const matchesPrice = currentBid >= dealerPreferences.minPrice && currentBid <= dealerPreferences.maxPrice;

    // Recommended if at least 2 of 3 criteria match, or manufacturer matches
    const matchCount = [matchesManufacturer, matchesBodyType, matchesPrice].filter(Boolean).length;
    return matchCount >= 2 || matchesManufacturer;
  };

  // Filter auctions by search query and status filter
  const filteredAuctions = useMemo(() => {
    if (!recentAuctions) return [];
    return recentAuctions.filter((auction: any) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const manufacturer = (auction.motorhome?.manufacturer || "").toLowerCase();
        const model = (auction.motorhome?.model || "").toLowerCase();
        const listingNumber = (auction.motorhome?.listing_number || "").toLowerCase();
        if (!manufacturer.includes(q) && !model.includes(q) && !listingNumber.includes(q)) {
          return false;
        }
      }
      // Status filter
      if (filterStatus !== "all") {
        const userBid = auction.bids?.[0];
        const hasBid = !!userBid;
        const isLeading = hasBid && userBid?.amount === auction.current_bid;
        switch (filterStatus) {
          case "mybids": return hasBid;
          case "leading": return isLeading;
          case "outbid": return hasBid && !isLeading;
          case "nobid": return !hasBid;
        }
      }
      return true;
    });
  }, [recentAuctions, searchQuery, filterStatus]);

  // Sort: recommended auctions first, then by end_time
  const sortedAuctions = useMemo(() => {
    if (!filteredAuctions || !dealerPreferences) return filteredAuctions;
    return [...filteredAuctions].sort((a, b) => {
      const aRec = isRecommended(a) ? 0 : 1;
      const bRec = isRecommended(b) ? 0 : 1;
      return aRec - bRec;
    });
  }, [filteredAuctions, dealerPreferences]);

  // Enhanced stat cards with gradients and animations
  const statCards = [
    {
      title: "Aktive Gebote",
      value: stats?.activeBids || 0,
      icon: Gavel,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      link: "/dashboard/auctions",
      description: "Laufende Auktionen",
      trend: stats?.activeBids && stats.activeBids > 0 ? "up" : "neutral"
    },
    {
      title: "Führende Gebote",
      value: stats?.leadingBids || 0,
      icon: Trophy,
      gradient: "from-amber-500 to-orange-500",
      bgGradient: "from-amber-500/10 to-orange-500/10",
      link: "/dashboard/auctions",
      description: "Höchstbietend",
      trend: stats?.leadingBids && stats.leadingBids > 0 ? "up" : "neutral"
    },
    {
      title: "Gewonnene Auktionen",
      value: stats?.wonAuctions || 0,
      icon: CheckCircle,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
      link: "/dashboard/inventory",
      description: "Erfolgreich",
      trend: "up"
    },
    {
      title: "Gesamtausgaben",
      value: stats?.totalSpent || 0,
      icon: Euro,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      link: "/dashboard/inventory",
      description: "Investiert",
      trend: "neutral",
      format: "currency"
    },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isLocked ? 'relative' : ''}`}>
      {/* Pending Dealer Banner */}
      {hasDealerApplication && application && (
        <>
          <PendingDealerBanner
            application={application}
            onRefresh={() => refetchApp()}
          />

          {/* Document Upload for pending/rejected dealers */}
          {(isPendingDealer || isRejectedDealer) && (
            <PendingDealerDocumentUpload
              dealerApplicationId={application.id}
            />
          )}
        </>
      )}

      {/* Compact Header with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            Verfügbare Auktionen
          </h1>
          <p className="text-muted-foreground">
            {recentAuctions?.length || 0} aktive Auktionen verfügbar
          </p>
        </div>
        
        {/* Quick Stats Row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
            <Trophy className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{stats?.leadingBids || 0} führend</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
            <Gavel className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{stats?.activeBids || 0} Gebote</span>
          </div>
          <Button
            variant={audioEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? "Audio an" : "Audio aus"}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Dealer Level Status Card */}
      {dealerLevel && (
        <Card className={`border-2 overflow-hidden ${
          dealerLevel.level === 'platin' ? 'border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50' :
          dealerLevel.level === 'gold' ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50' :
          dealerLevel.level === 'silber' ? 'border-slate-300 bg-gradient-to-r from-slate-50 to-gray-50' :
          'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg ${
                  dealerLevel.level === 'platin' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                  dealerLevel.level === 'gold' ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                  dealerLevel.level === 'silber' ? 'bg-gradient-to-br from-slate-400 to-gray-500' :
                  'bg-gradient-to-br from-orange-400 to-amber-500'
                }`}>
                  {dealerLevel.level === 'platin' ? <Crown className="h-7 w-7 text-white" /> :
                   dealerLevel.level === 'gold' ? <Star className="h-7 w-7 text-white" /> :
                   dealerLevel.level === 'silber' ? <Award className="h-7 w-7 text-white" /> :
                   <Zap className="h-7 w-7 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg capitalize">{dealerLevel.level}-Händler</h3>
                    <Badge variant="outline" className="text-xs">{dealerLevel.points} Punkte</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dealerLevel.total_bids} Gebote &middot; {dealerLevel.won_auctions} gewonnen &middot; €{Number(dealerLevel.total_volume).toLocaleString('de-DE')} Volumen
                  </p>
                </div>
              </div>
              {/* Progress to next level */}
              {dealerLevel.level !== 'platin' && (
                <div className="text-right hidden md:block">
                  <p className="text-xs text-muted-foreground mb-1">
                    Nächstes Level: {dealerLevel.level === 'bronze' ? 'Silber (30 Pkt.)' : dealerLevel.level === 'silber' ? 'Gold (100 Pkt.)' : 'Platin (200 Pkt.)'}
                  </p>
                  <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        dealerLevel.level === 'gold' ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                        dealerLevel.level === 'silber' ? 'bg-gradient-to-r from-slate-400 to-gray-500' :
                        'bg-gradient-to-r from-orange-400 to-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (
                          dealerLevel.level === 'bronze' ? (dealerLevel.points / 30) * 100 :
                          dealerLevel.level === 'silber' ? ((dealerLevel.points - 30) / 70) * 100 :
                          ((dealerLevel.points - 100) / 100) * 100
                        ))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
      {recentAuctions && recentAuctions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hersteller, Modell oder Inserat-Nr. suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Auktionen</SelectItem>
              <SelectItem value="mybids">Meine Gebote</SelectItem>
              <SelectItem value="leading">Führend</SelectItem>
              <SelectItem value="outbid">Überboten</SelectItem>
              <SelectItem value="nobid">Ohne Gebot</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active Auctions - Primary Focus Section */}
      <div>
        {sortedAuctions && sortedAuctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedAuctions.map((auction: any) => {
                const recommended = isRecommended(auction);
                // Get user's highest bid for this auction (bids are sorted by amount desc)
                const userBid = auction.bids?.[0];
                const hasBid = !!userBid;
                const isLeading = hasBid && userBid?.amount === auction.current_bid;
                const timeLeft = new Date(auction.end_time).getTime() - Date.now();
                const isExpired = timeLeft <= 0;
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
                const mainPhoto = auction.motorhome?.photos?.find((p: any) => p.display_order === 0)?.url || 
                                  auction.motorhome?.photos?.[0]?.url;
                
                return (
                  <div key={auction.id} className={`${isLocked ? 'pointer-events-none' : ''}`}>
                  <Link to={isLocked ? '#' : `/auktion/${auction.id}`} onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
                    <Card className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer h-full ${
                      isLeading ? 'ring-2 ring-green-500' : hasBid ? 'ring-2 ring-orange-300' : ''
                    }`}>
                      {/* Photo */}
                      <div className="relative h-40 bg-muted">
                        {mainPhoto ? (
                          <img 
                            src={mainPhoto} 
                            alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Gavel className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        
                        {/* Recommended Badge */}
                        {recommended && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge className="bg-primary text-white shadow-lg text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Empfohlen
                            </Badge>
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          {isExpired ? (
                            <Badge variant="secondary" className="shadow-lg">Beendet</Badge>
                          ) : hasBid ? (
                            isLeading ? (
                              <Badge className="bg-green-500 text-white shadow-lg">
                                <Trophy className="h-3 w-3 mr-1" />
                                Führend
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-500 text-white shadow-lg">
                                Überboten
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="shadow-lg">Neu</Badge>
                          )}
                        </div>
                        
                        {/* Time Left */}
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-black/70 text-white border-0">
                            <Clock className="h-3 w-3 mr-1" />
                            {isExpired ? 'Beendet' : hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <CardContent className="p-4">
                        <div className="mb-2">
                          <h3 className="font-semibold text-sm line-clamp-1">
                            {auction.motorhome?.manufacturer} {auction.motorhome?.model}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {auction.motorhome?.year} • #{auction.motorhome?.listing_number}
                          </p>
                        </div>
                        
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Aktuelles Gebot</p>
                            <p className="text-lg font-bold text-primary">
                              €{(auction.current_bid || auction.starting_bid || 0).toLocaleString('de-DE')}
                            </p>
                          </div>
                          {hasBid && (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Ihr Gebot</p>
                              <p className="text-sm font-semibold">
                                €{userBid.amount.toLocaleString('de-DE')}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <Button className="w-full mt-3" size="sm" variant={isExpired || hasBid ? "outline" : "default"} disabled={isExpired || isLocked}>
                          {isLocked ? (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Gesperrt
                            </>
                          ) : isExpired ? (
                            <>Auktion beendet</>
                          ) : hasBid ? (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Details
                            </>
                          ) : (
                            <>
                              <Gavel className="h-4 w-4 mr-2" />
                              Jetzt bieten
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
              <Gavel className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">Keine aktiven Auktionen</h3>
              <p className="text-muted-foreground mb-4">
                Derzeit sind keine Fahrzeuge in Auktion verfügbar
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

      {/* Enhanced Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}>
        {statCards.map((stat, index) => (
          <Link to={isLocked ? '#' : stat.link} key={stat.title} style={{ animationDelay: `${index * 100}ms` }} onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
            <Card 
              className="relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group bg-card animate-scale-in cursor-pointer h-full"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.format === "currency" 
                      ? `€${stat.value.toLocaleString('de-DE')}` 
                      : stat.value.toLocaleString('de-DE')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {stat.description}
                    </Badge>
                    {stat.trend === "up" && (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </div>
                
                {/* Subtle background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity -z-10`}></div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions - Full Width */}
      <Card className="border-2 hover:border-primary/20 transition-smooth">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Schnellzugriff
          </CardTitle>
          <CardDescription>
            Häufig verwendete Funktionen
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className={`block p-4 border rounded-lg ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer'} transition-smooth group`}
            onClick={isLocked ? undefined : () => window.location.href = '/kaufen'}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold mb-1 ${isLocked ? '' : 'group-hover:text-primary'} transition-colors`}>
                  Neue Auktionen
                  {isLocked && <Lock className="inline h-3 w-3 ml-2 text-muted-foreground" />}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aktuelle Fahrzeuge entdecken
                </p>
              </div>
              <ArrowUpRight className={`h-5 w-5 text-muted-foreground ${isLocked ? '' : 'group-hover:text-primary'} transition-colors`} />
            </div>
          </div>

          <div className={`block p-4 border rounded-lg ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer'} transition-smooth group`}
            onClick={isLocked ? undefined : () => window.location.href = '/dashboard/inventory'}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold mb-1 ${isLocked ? '' : 'group-hover:text-primary'} transition-colors`}>
                  Mein Inventar
                  {isLocked && <Lock className="inline h-3 w-3 ml-2 text-muted-foreground" />}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Gekaufte Fahrzeuge verwalten
                </p>
              </div>
              <ArrowUpRight className={`h-5 w-5 text-muted-foreground ${isLocked ? '' : 'group-hover:text-primary'} transition-colors`} />
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Benachrichtigungen</h3>
                <p className="text-sm text-muted-foreground">
                  Audio-Alerts verwalten
                </p>
              </div>
              <Button
                variant={audioEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAudioEnabled(!audioEnabled)}
              >
                {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
            
            {audioEnabled && (
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={audioNotifications.testNotification}
                  className="w-full"
                >
                  Test-Benachrichtigung
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <Card className="border-2 hover:border-primary/20 transition-smooth">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ihre Performance
          </CardTitle>
          <CardDescription>
            Übersicht über Ihre Aktivitäten und Erfolge
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Success Rate */}
            <div className="text-center p-6 border rounded-lg bg-green-50/50">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats?.totalBids > 0 ? Math.round((stats.wonAuctions / stats.totalBids) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Erfolgsquote</div>
            </div>

            {/* Average Spending */}
            <div className="text-center p-6 border rounded-lg bg-blue-50/50">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Euro className="h-8 w-8 text-white" />
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                €{stats?.wonAuctions > 0 ? Math.round(stats.totalSpent / stats.wonAuctions).toLocaleString('de-DE') : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Ø pro Fahrzeug</div>
            </div>

            {/* Total Commissions */}
            <div className="text-center p-6 border rounded-lg bg-purple-50/50">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div className="text-2xl font-bold text-purple-600 mb-1">
                €{stats?.totalCommissions.toLocaleString('de-DE') || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Provisionen gesamt</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Bid Overview with Status Indicators */}
      {!isLocked && stats?.recentBids && stats.recentBids.length > 0 && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" />
                  Meine Gebote
                </CardTitle>
                <CardDescription>
                  Übersicht aller Ihrer Gebote mit Status
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-green-500" />
                  {stats.leadingBids || 0} führend
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  {stats.activeBids || 0} aktiv
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-3">
              {stats.recentBids.map((bid: any) => {
                const isActive = bid.auctions?.status === "active";
                const isLeading = bid.amount === bid.auctions?.current_bid;
                const isWon = !isActive && bid.amount === bid.auctions?.current_bid;
                const isOutbid = isActive && bid.amount < bid.auctions?.current_bid;
                
                return (
                  <Link 
                    key={bid.id} 
                    to={`/auctions/${bid.auction_id}`}
                    className="block"
                  >
                    <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                      isLeading ? "bg-green-50 border-green-200 hover:border-green-300" :
                      isOutbid ? "bg-amber-50 border-amber-200 hover:border-amber-300" :
                      isWon ? "bg-blue-50 border-blue-200 hover:border-blue-300" :
                      "bg-muted/30 border-transparent hover:border-primary/20"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isLeading ? "bg-green-100" :
                          isOutbid ? "bg-amber-100" :
                          isWon ? "bg-blue-100" :
                          "bg-muted"
                        }`}>
                          {isLeading ? <Trophy className="h-5 w-5 text-green-600" /> :
                           isOutbid ? <TrendingUp className="h-5 w-5 text-amber-600" /> :
                           isWon ? <CheckCircle className="h-5 w-5 text-blue-600" /> :
                           <Gavel className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="font-medium">
                            {bid.auctions?.motorhome?.manufacturer} {bid.auctions?.motorhome?.model}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>Ihr Gebot: €{bid.amount.toLocaleString('de-DE')}</span>
                            {isActive && bid.auctions?.current_bid > bid.amount && (
                              <span className="text-amber-600">
                                (Aktuell: €{bid.auctions.current_bid.toLocaleString('de-DE')})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge 
                          variant={isLeading ? "default" : isOutbid ? "secondary" : isWon ? "default" : "outline"}
                          className={`mb-1 ${
                            isLeading ? "bg-green-500 hover:bg-green-600" :
                            isWon ? "bg-blue-500 hover:bg-blue-600" :
                            ""
                          }`}
                        >
                          {isLeading ? "Höchstbietend" :
                           isOutbid ? "Überboten" :
                           isWon ? "Gewonnen" :
                           !isActive ? "Nicht gewonnen" : "Beendet"}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </div>
                        {isActive && bid.auctions?.end_time && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Endet: {format(new Date(bid.auctions.end_time), "dd.MM. HH:mm", { locale: de })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Link to full bid history */}
            <div className="mt-4 pt-4 border-t">
              <Link to={isLocked ? '#' : '/dashboard/auctions'} className="w-full" onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
                <Button variant="outline" className="w-full" disabled={isLocked}>
                  {isLocked ? <Lock className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {isLocked ? 'Gesperrt' : 'Alle Gebote anzeigen'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DealerDashboard;