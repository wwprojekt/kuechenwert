import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Search,
  Filter,
  Award,
  Star,
  Zap,
  Crown,
  Lock,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { useToast } from "@/hooks/use-toast";
import { useDealerPending } from "@/hooks/useDealerPending";
import PendingDealerBanner from "@/components/dashboard/PendingDealerBanner";
import PendingDealerDocumentUpload from "@/components/dashboard/PendingDealerDocumentUpload";
import { Link } from "react-router-dom";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

import { format } from "date-fns";
import { de } from "date-fns/locale";

const DealerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useSettings(); // Initialize settings context
  const { isPendingDealer, isRejectedDealer, hasDealerApplication, application, dealerCountry, refetch: refetchApp } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;
  const audioNotifications = useAudioNotification({ enabled: true, volume: 0.8 });
  const isMobile = useIsMobile();
  const audioRef = useRef(audioNotifications);
  useEffect(() => { audioRef.current = audioNotifications; }, [audioNotifications]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioEnabledRef = useRef(audioEnabled);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "mybids" | "leading" | "outbid" | "nobid">("all");

  // Keep ref in sync with state (needed for Realtime callback closure)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // ─── Realtime: Audio-Benachrichtigung bei neuen Geboten ───────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dashboard-bid-audio")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
        },
        async (payload: any) => {
          // Eigene Gebote ignorieren (der Händler weiß, dass er geboten hat)
          if (payload.new.bidder_id === user.id) return;

          // Daten sofort aktualisieren (statt 30s Polling abzuwarten)
          queryClient.invalidateQueries({ queryKey: ["dealerStats", user.id] });
          queryClient.invalidateQueries({ queryKey: ["allActiveAuctions", user.id] });

          // Audio abspielen wenn aktiviert
          if (audioEnabledRef.current) {
            await audioRef.current.playNotification("bid");
          }

          // Toast-Benachrichtigung anzeigen
          toast({
            title: "Neues Gebot!",
            description: `€${Number(payload.new.amount).toLocaleString("de-DE")} auf eine Auktion`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast]);

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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

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
        // auctions is a single object (not array) because motorhome_id has UNIQUE constraint
        const auction = Array.isArray(mh.auctions) ? mh.auctions[0] : mh.auctions;
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
        .gt("end_time", new Date().toISOString())
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

  // Compute outbid auctions for the alert section
  const outbidAuctions = useMemo(() => {
    if (!recentAuctions) return [];
    return recentAuctions.filter((auction: any) => {
      const userBid = auction.bids?.[0];
      const hasBid = !!userBid;
      const isLeading = hasBid && userBid?.amount === auction.current_bid;
      const timeLeft = new Date(auction.end_time).getTime() - Date.now();
      return hasBid && !isLeading && timeLeft > 0;
    }).sort((a: any, b: any) => {
      // Sort by urgency: ending soonest first
      return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
    });
  }, [recentAuctions]);

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
            countryCode={dealerCountry}
          />

          {/* Document Upload for pending/rejected dealers */}
          {(isPendingDealer || isRejectedDealer) && (
            <PendingDealerDocumentUpload
              dealerApplicationId={application.id}
              countryCode={dealerCountry}
            />
          )}
        </>
      )}

      {/* Compact Header with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Gavel className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Verfügbare Auktionen
            </h1>
            <p className="text-sm text-muted-foreground">
              {recentAuctions?.length || 0} aktive Auktionen verfügbar
            </p>
          </div>
          {/* Audio Button – auf Handy neben dem Titel */}
          <Button
            variant={audioEnabled ? "default" : "outline"}
            size="sm"
            className="md:hidden"
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? "Audio an" : "Audio aus"}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
        
        {/* Quick Stats Row */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-green-50 rounded-lg border border-green-200">
            <Trophy className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
            <span className="text-xs md:text-sm font-medium text-green-700">{stats?.leadingBids || 0} führend</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-blue-50 rounded-lg border border-blue-200">
            <Gavel className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600" />
            <span className="text-xs md:text-sm font-medium text-blue-700">{stats?.activeBids || 0} Gebote</span>
          </div>
          <Button
            variant={audioEnabled ? "default" : "outline"}
            size="sm"
            className="hidden md:flex"
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
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={`h-10 w-10 sm:h-14 sm:w-14 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 ${
                  dealerLevel.level === 'platin' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                  dealerLevel.level === 'gold' ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                  dealerLevel.level === 'silber' ? 'bg-gradient-to-br from-slate-400 to-gray-500' :
                  'bg-gradient-to-br from-orange-400 to-amber-500'
                }`}>
                  {dealerLevel.level === 'platin' ? <Crown className="h-5 w-5 sm:h-7 sm:w-7 text-white" /> :
                   dealerLevel.level === 'gold' ? <Star className="h-5 w-5 sm:h-7 sm:w-7 text-white" /> :
                   dealerLevel.level === 'silber' ? <Award className="h-5 w-5 sm:h-7 sm:w-7 text-white" /> :
                   <Zap className="h-5 w-5 sm:h-7 sm:w-7 text-white" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-lg capitalize">{dealerLevel.level}-Händler</h3>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">{dealerLevel.points} Pkt.</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {dealerLevel.total_bids} Gebote &middot; {dealerLevel.won_auctions} gewonnen
                    <span className="hidden sm:inline"> &middot; €{Number(dealerLevel.total_volume).toLocaleString('de-DE')} Volumen</span>
                  </p>
                  {/* Mobile progress bar inline */}
                  {dealerLevel.level !== 'platin' && (
                    <div className="sm:hidden mt-1.5">
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
              </div>
              {/* Desktop progress to next level */}
              {dealerLevel.level !== 'platin' && (
                <div className="text-right hidden sm:block flex-shrink-0">
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

      {/* OUTBID ALERT SECTION */}
      {!isLocked && outbidAuctions.length > 0 && (
        <Card className="border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 shadow-md animate-scale-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 md:gap-3 mb-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-orange-800 dark:text-orange-300 text-sm md:text-lg truncate">
                  {outbidAuctions.length} {outbidAuctions.length === 1 ? 'Auktion' : 'Auktionen'} überboten!
                </h3>
                <p className="text-xs md:text-sm text-orange-600 dark:text-orange-400 hidden md:block">
                  Reagieren Sie jetzt, bevor die Auktionen enden
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-orange-400 text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30 flex-shrink-0 text-xs md:text-sm"
                onClick={() => setFilterStatus('outbid')}
              >
                Alle anzeigen
              </Button>
            </div>
            <div className="space-y-2">
              {outbidAuctions.slice(0, isMobile ? 2 : 3).map((auction: any) => {
                const userBid = auction.bids?.[0];
                const diff = (auction.current_bid || 0) - (userBid?.amount || 0);
                const timeLeft = new Date(auction.end_time).getTime() - Date.now();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
                const isUrgent = timeLeft < 2 * 60 * 60 * 1000; // Less than 2 hours
                return (
                  <div
                    key={auction.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      isUrgent
                        ? 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700'
                        : 'bg-white border-orange-200 dark:bg-orange-950/20 dark:border-orange-700'
                    }`}
                    onClick={() => navigate(`/auktion/${auction.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {auction.motorhome?.manufacturer} {auction.motorhome?.model}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Ihr Gebot: <strong>€{userBid?.amount?.toLocaleString('de-DE')}</strong></span>
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            +€{diff.toLocaleString('de-DE')} überboten
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <Badge variant="secondary" className={`text-xs ${
                          isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : ''
                        }`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`}
                        </Badge>
                      </div>
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {outbidAuctions.length > (isMobile ? 2 : 3) && (
                <p className="text-center text-sm text-orange-600 dark:text-orange-400 pt-1">
                  + {outbidAuctions.length - (isMobile ? 2 : 3)} weitere überbotene {outbidAuctions.length - (isMobile ? 2 : 3) === 1 ? 'Auktion' : 'Auktionen'}
                </p>
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
                const auctionPhotos = Array.isArray(auction.motorhome?.photos) ? auction.motorhome.photos : auction.motorhome?.photos ? [auction.motorhome.photos] : [];
                const mainPhoto = auctionPhotos.find((p: any) => p.display_order === 0)?.url || 
                                  auctionPhotos[0]?.url;
                
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
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Gavel className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        
                        {/* Status Badge + Empfohlen + Sofortkauf – links oben */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          {isExpired ? (
                            <Badge variant="secondary" className="shadow-lg text-xs">Beendet</Badge>
                          ) : hasBid ? (
                            isLeading ? (
                              <Badge className="bg-green-500 text-white shadow-lg text-xs">
                                <Trophy className="h-3 w-3 mr-1" />
                                Führend
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-500 text-white shadow-lg text-xs">
                                Überboten
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="shadow-lg text-xs">Neu</Badge>
                          )}
                          {recommended && (
                            <Badge className="bg-primary text-white shadow-lg text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Empfohlen
                            </Badge>
                          )}
                          {auction.buy_now_price && auction.buy_now_price > 0 && !isExpired && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Sofortkauf
                            </Badge>
                          )}
                        </div>

                        {/* Favorite Heart – rechts oben */}
                        <div className="absolute top-2 right-2">
                          {auction.motorhome?.id && (
                            <FavoriteButton motorhomeId={auction.motorhome.id} />
                          )}
                        </div>
                        
                        {/* Time Left */}
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
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
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}>
        {statCards.map((stat, index) => (
          <Link to={isLocked ? '#' : stat.link} key={stat.title} style={{ animationDelay: `${index * 100}ms` }} onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
            <Card 
              className="relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group bg-card animate-scale-in cursor-pointer h-full"
            >
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">
                    {stat.format === "currency" 
                      ? `€${stat.value.toLocaleString('de-DE')}` 
                      : stat.value.toLocaleString('de-DE')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">
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
          <div className={`block p-4 border rounded-lg ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer active:bg-primary/10'} transition-smooth group`}
            onClick={isLocked ? undefined : () => navigate('/kaufen')}
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



          <div className={`block p-4 border rounded-lg ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer active:bg-primary/10'} transition-smooth group`}
            onClick={isLocked ? undefined : () => navigate('/dashboard/inventory')}
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
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {/* Success Rate */}
            <div className="text-center p-3 sm:p-6 border rounded-lg bg-green-50/50">
              <div className="h-10 w-10 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <Trophy className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-green-600 mb-0.5 sm:mb-1">
                {stats?.totalBids > 0 ? Math.round((stats.wonAuctions / stats.totalBids) * 100) : 0}%
              </div>
              <div className="text-[11px] sm:text-sm text-muted-foreground">Erfolgsquote</div>
            </div>

            {/* Average Spending */}
            <div className="text-center p-3 sm:p-6 border rounded-lg bg-blue-50/50">
              <div className="h-10 w-10 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Euro className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600 mb-0.5 sm:mb-1">
                €{stats?.wonAuctions > 0 ? Math.round(stats.totalSpent / stats.wonAuctions).toLocaleString('de-DE') : '0'}
              </div>
              <div className="text-[11px] sm:text-sm text-muted-foreground">Ø Fahrzeug</div>
            </div>

            {/* Total Commissions */}
            <div className="text-center p-3 sm:p-6 border rounded-lg bg-purple-50/50">
              <div className="h-10 w-10 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Target className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600 mb-0.5 sm:mb-1">
                €{stats?.totalCommissions.toLocaleString('de-DE') || '0'}
              </div>
              <div className="text-[11px] sm:text-sm text-muted-foreground">Provisionen</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Card for new dealers who haven't bid yet */}
      {!isLocked && stats && stats.totalBids === 0 && recentAuctions && recentAuctions.length > 0 && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-cyan-50/50 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Willkommen! So starten Sie Ihr erstes Gebot
            </CardTitle>
            <CardDescription>
              Sie haben noch kein Gebot abgegeben – aktuell {recentAuctions.length > 1 ? `warten ${recentAuctions.length} Fahrzeuge` : 'wartet 1 Fahrzeug'} auf Ihr Gebot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/70 border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Auktion wählen</p>
                  <p className="text-xs text-muted-foreground">Scrollen Sie nach unten und klicken Sie auf ein Fahrzeug</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/70 border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Betrag eingeben</p>
                  <p className="text-xs text-muted-foreground">Geben Sie Ihren Wunschpreis ein und klicken Sie auf "Bieten"</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/70 border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Benachrichtigung erhalten</p>
                  <p className="text-xs text-muted-foreground">Sie werden per E-Mail informiert wenn Sie überboten werden</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Zap className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Tipp:</strong> Mit "Auto-Bid" bietet das System automatisch für Sie bis zu Ihrem Höchstbetrag – so verpassen Sie kein Fahrzeug.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Bid Overview with Status Indicators */}
      {!isLocked && stats?.recentBids && stats.recentBids.length > 0 && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Trophy className="h-3 w-3 text-green-500" />
                  {stats.leadingBids || 0} führend
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
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
                    to={`/auktion/${bid.auction_id}`}
                    className="block"
                  >
                    <div className={`p-3 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                      isLeading ? "bg-green-50 border-green-200 hover:border-green-300" :
                      isOutbid ? "bg-amber-50 border-amber-200 hover:border-amber-300" :
                      isWon ? "bg-blue-50 border-blue-200 hover:border-blue-300" :
                      "bg-muted/30 border-transparent hover:border-primary/20"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isLeading ? "bg-green-100" :
                          isOutbid ? "bg-amber-100" :
                          isWon ? "bg-blue-100" :
                          "bg-muted"
                        }`}>
                          {isLeading ? <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" /> :
                           isOutbid ? <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" /> :
                           isWon ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> :
                           <Gavel className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm sm:text-base truncate">
                                {bid.auctions?.motorhome?.manufacturer} {bid.auctions?.motorhome?.model}
                              </div>
                              <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>Ihr Gebot: €{bid.amount.toLocaleString('de-DE')}</span>
                                {isActive && bid.auctions?.current_bid > bid.amount && (
                                  <span className="text-amber-600">
                                    (Aktuell: €{bid.auctions.current_bid.toLocaleString('de-DE')})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <Badge 
                                variant={isLeading ? "default" : isOutbid ? "secondary" : isWon ? "default" : "outline"}
                                className={`text-[10px] sm:text-xs ${
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
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </div>
                            {isActive && bid.auctions?.end_time && (
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                Endet: {format(new Date(bid.auctions.end_time), "dd.MM. HH:mm", { locale: de })}
                              </div>
                            )}
                          </div>
                        </div>
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