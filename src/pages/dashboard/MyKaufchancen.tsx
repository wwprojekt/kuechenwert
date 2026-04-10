import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KaufchanceBadge } from "@/components/KaufchanceBadge";
import { PostAuctionOfferDialog } from "@/components/PostAuctionOfferDialog";
import { Zap, Car, Clock, Euro, CheckCircle, XCircle, Trophy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { invokeWithAuth, SessionExpiredError } from "@/lib/sessionGuard";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface KaufchanceInvitation {
  id: string;
  auction_id: string;
  highest_bid: number;
  rank: number;
  invited_at: string;
}

interface KaufchanceAuction {
  id: string;
  current_bid: number | null;
  end_time: string;
  kaufchance_expires_at: string | null;
  kaufchance_min_price: number | null;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    listing_number: string | null;
    photos: Array<{ url: string; display_order: number }>;
  };
  // The current user's invitation data
  invitation?: KaufchanceInvitation;
}

interface MyOffer {
  id: string;
  offer_amount: number;
  counter_offer_amount: number | null;
  status: string;
  message: string | null;
  seller_response: string | null;
  created_at: string;
  expires_at: string | null;
  auction_id: string;
  auction: {
    id: string;
    current_bid: number | null;
    status: string;
    motorhome: {
      manufacturer: string;
      model: string;
      photos: Array<{ url: string; display_order: number }>;
    };
  };
}

export default function MyKaufchancen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showSessionExpired } = useSessionExpired();
  const [kaufchancen, setKaufchancen] = useState<KaufchanceAuction[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("browse");
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (!user || isLoadingRef.current) return;

    isLoadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      // Session-Check: Ensure valid token before RLS-protected queries
      // (expired sessions cause RLS to silently return empty results)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          showSessionExpired('/dashboard/kaufchancen');
          return;
        }
      }

      // Step 1: Load the current user's kaufchance invitations
      const { data: invitations, error: invError } = await supabase
        .from("kaufchance_invitations")
        .select("*")
        .eq("bidder_id", user.id);

      if (invError) throw invError;
      if (!isMountedRef.current) return;

      // Step 2: Load the auctions for which this user is invited
      if (invitations && invitations.length > 0) {
        const auctionIds = invitations.map((inv: any) => inv.auction_id);

        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select(`
            id,
            current_bid,
            end_time,
            kaufchance_expires_at,
            kaufchance_min_price,
            motorhome:motorhomes (
              id,
              manufacturer,
              model,
              year,
              listing_number,
              photos:motorhome_photos (url, display_order)
            )
          `)
          .in("id", auctionIds)
          .eq("status", "kaufchance")
          .gt("kaufchance_expires_at", new Date().toISOString())
          .order("kaufchance_expires_at", { ascending: true });

        if (auctionError) throw auctionError;
        if (!isMountedRef.current) return;

        // Merge invitation data into auction data
        const invMap = new Map(invitations.map((inv: any) => [inv.auction_id, inv]));
        const merged = (auctionData || []).map((auction: any) => ({
          ...auction,
          invitation: invMap.get(auction.id),
        }));

        setKaufchancen(merged as KaufchanceAuction[]);
      } else {
        // Empty invitations WHILE logged in → could be stale session
        // Verify by attempting a known-good query
        const { data: verifySession } = await supabase
          .from("kaufchance_invitations")
          .select("id")
          .limit(0);
        if (verifySession === null) {
          // Query returned null (not empty array) → session issue
          showSessionExpired('/dashboard/kaufchancen');
          return;
        }
        setKaufchancen([]);
      }

      // Step 3: Load my offers
      const { data: offersData, error: offersError } = await supabase
        .from("post_auction_offers")
        .select(`
          id,
          offer_amount,
          counter_offer_amount,
          status,
          message,
          seller_response,
          created_at,
          expires_at,
          auction_id,
          auction:auctions (
            id,
            current_bid,
            status,
            motorhome:motorhomes (
              manufacturer,
              model,
              photos:motorhome_photos (url, display_order)
            )
          )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (offersError) throw offersError;
      if (!isMountedRef.current) return;

      setMyOffers((offersData as unknown as MyOffer[]) || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading kaufchancen:", error);
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, [user, showSessionExpired]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: Subscribe to offer changes (seller responds, counter-offer, etc.)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`kaufchance-offers-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_auction_offers",
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          // Seller responded → reload data silently
          loadData(true);

          // Toast for status changes
          const newStatus = (payload.new as any)?.status;
          if (payload.eventType === "UPDATE" && newStatus) {
            if (newStatus === "countered") {
              const amount = (payload.new as any)?.counter_offer_amount;
              toast({
                title: "Neues Gegenangebot!",
                description: amount
                  ? `Der Verkäufer hat ein Gegenangebot über ${Number(amount).toLocaleString("de-DE")} € gemacht.`
                  : "Der Verkäufer hat ein Gegenangebot gemacht.",
              });
            } else if (newStatus === "accepted") {
              toast({
                title: "🎉 Angebot angenommen!",
                description: "Der Verkäufer hat Ihr Angebot akzeptiert!",
              });
            } else if (newStatus === "rejected") {
              toast({
                title: "Angebot abgelehnt",
                description: "Der Verkäufer hat Ihr Angebot leider abgelehnt.",
                variant: "destructive",
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kaufchance_invitations",
          filter: `bidder_id=eq.${user.id}`,
        },
        () => {
          // New kaufchance invitation → reload
          loadData(true);
          toast({
            title: "Neue Kaufchance!",
            description: "Sie wurden als Top-Bieter zu einer neuen Kaufchance eingeladen.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadData, toast]);

  // Refetch when tab/window regains focus
  useEffect(() => {
    const handleFocus = () => loadData(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadData(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadData]);

  // Polling fallback: refresh every 30s as safety net
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Cleanup mount ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleAcceptCounterOffer = async (e: React.MouseEvent, offer: MyOffer) => {
    e.preventDefault();
    e.stopPropagation();
    setRespondingOfferId(offer.id);
    try {
      const { data, error } = await invokeWithAuth('accept-kaufchance-offer', {
        body: { offerId: offer.id },
      });

      if (error) throw error;

      if ((data as any)?.success) {
        toast({
          title: 'Gegenangebot angenommen!',
          description: `Sie haben das Gegenangebot von ${offer.counter_offer_amount!.toLocaleString('de-DE')} € angenommen. Der Kaufvertrag wird erstellt.`,
        });
      } else {
        throw new Error((data as any)?.error || 'Unbekannter Fehler');
      }

      loadData();
    } catch (err: any) {
      if (err instanceof SessionExpiredError) {
        showSessionExpired('/dashboard/kaufchancen');
        return;
      }
      console.error('Error accepting counter offer:', err);
      toast({
        title: 'Fehler',
        description: err.message || 'Aktion konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleRejectCounterOffer = async (e: React.MouseEvent, offer: MyOffer) => {
    e.preventDefault();
    e.stopPropagation();
    setRespondingOfferId(offer.id);
    try {
      const { error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id)
        .eq('buyer_id', user!.id);
      if (error) throw error;
      toast({
        title: 'Gegenangebot abgelehnt',
        description: 'Sie haben das Gegenangebot abgelehnt.',
      });
      loadData();
    } catch (err) {
      console.error('Error rejecting counter offer:', err);
      toast({ title: 'Fehler', description: 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500 text-[10px] px-1.5 py-0">Angenommen</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Abgelehnt</Badge>;
      case "countered":
        return <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Gegenangebot</Badge>;
      case "expired":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Abgelaufen</Badge>;
      default:
        return <Badge variant="outline" className="text-orange-600 border-orange-600 text-[10px] px-1.5 py-0">Ausstehend</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            Kaufchancen
          </h1>
          <p className="text-sm text-muted-foreground">
            Exklusive Kaufchancen – Sie wurden als Top-Bieter eingeladen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {format(lastRefresh, "HH:mm", { locale: de })} Uhr
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => loadData(false)}
            disabled={loading}
            title="Aktualisieren"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="browse" className="text-xs px-3 py-1">
            Meine Kaufchancen ({kaufchancen.length})
          </TabsTrigger>
          <TabsTrigger value="my-offers" className="text-xs px-3 py-1">
            Meine Angebote ({myOffers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : kaufchancen.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Keine Kaufchancen verfügbar</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Aktuell sind keine Kaufchancen für Sie verfügbar. Sie werden per E-Mail benachrichtigt, wenn Sie als Top-Bieter eingeladen werden.
                </p>
                <Button size="sm" asChild>
                  <Link to="/kaufen">Aktive Auktionen ansehen</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {kaufchancen.map((auction) => {
                const motorhome = auction.motorhome;
                const safePhotos = Array.isArray(motorhome.photos) ? motorhome.photos : motorhome.photos ? [motorhome.photos] : [];
                const firstPhoto = [...safePhotos].sort((a, b) => a.display_order - b.display_order)[0];

                return (
                  <Link
                    key={auction.id}
                    to={`/auktion/${auction.id}`}
                    className="block group"
                  >
                    <Card className="overflow-hidden border hover:border-primary/40 transition-all duration-200 hover:shadow-md cursor-pointer h-full bg-card">
                      <div className="flex flex-row h-full">
                        {/* Thumbnail */}
                        <div className="relative w-28 sm:w-32 flex-shrink-0">
                          {firstPhoto ? (
                            <img
                              src={firstPhoto.url}
                              alt={`${motorhome.manufacturer} ${motorhome.model}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Car className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          {auction.kaufchance_expires_at && (
                            <div className="absolute top-1.5 left-1.5">
                              <KaufchanceBadge expiresAt={auction.kaufchance_expires_at} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                                {motorhome.manufacturer} {motorhome.model}
                              </h3>
                              {motorhome.listing_number && (
                                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                                  #{motorhome.listing_number}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Baujahr {motorhome.year}
                            </p>
                          </div>

                          {/* Bid info */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-0.5">
                                <Euro className="w-3 h-3" /> Letztes Gebot:
                              </span>
                              <span className="font-semibold tabular-nums">
                                {auction.current_bid?.toLocaleString('de-DE') || 0} €
                              </span>
                            </div>
                            {auction.invitation && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-0.5">
                                  <Trophy className="w-3 h-3 text-amber-500" /> Platz {auction.invitation.rank}:
                                </span>
                                <span className="font-semibold text-primary tabular-nums">
                                  {auction.invitation.highest_bid.toLocaleString('de-DE')} €
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Action button */}
                          <div className="mt-2 pt-1.5 border-t border-border/40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <PostAuctionOfferDialog
                              auctionId={auction.id}
                              currentBid={auction.current_bid || 0}
                              vehicleTitle={`${motorhome.manufacturer} ${motorhome.model}`}
                              onOfferSent={loadData}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-offers" className="space-y-3 mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : myOffers.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Keine Angebote</h3>
                <p className="text-sm text-muted-foreground">
                  Sie haben noch keine Kaufangebote abgegeben.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {myOffers.map((offer) => {
                const auction = offer.auction;
                const motorhome = auction?.motorhome;
                const safePhotos2 = Array.isArray(motorhome?.photos) ? motorhome.photos : motorhome?.photos ? [motorhome.photos] : [];
                const firstPhoto = [...safePhotos2].sort((a, b) => a.display_order - b.display_order)[0];

                return (
                  <Link
                    key={offer.id}
                    to={`/auktion/${auction?.id}`}
                    className="block group"
                  >
                    <Card className="overflow-hidden border hover:border-primary/40 transition-all duration-200 hover:shadow-md cursor-pointer h-full bg-card">
                      <div className="flex flex-row h-full">
                        {/* Thumbnail */}
                        <div className="relative w-28 sm:w-32 flex-shrink-0">
                          {firstPhoto ? (
                            <img
                              src={firstPhoto.url}
                              alt={`${motorhome?.manufacturer} ${motorhome?.model}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Car className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5">
                            {getStatusBadge(offer.status)}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                          <div>
                            <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                              {motorhome?.manufacturer} {motorhome?.model}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(new Date(offer.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </p>
                          </div>

                          {/* Offer details */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Ihr Angebot:</span>
                              <span className="font-semibold tabular-nums">{offer.offer_amount.toLocaleString('de-DE')} €</span>
                            </div>
                            {offer.counter_offer_amount && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Gegenangebot:</span>
                                <span className="font-semibold text-blue-600 tabular-nums">
                                  {offer.counter_offer_amount.toLocaleString('de-DE')} €
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Counter-offer actions */}
                          {offer.status === 'countered' && offer.counter_offer_amount && (
                            <div className="flex gap-1.5 mt-2 pt-1.5 border-t border-border/40">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs bg-green-500 hover:bg-green-600"
                                disabled={respondingOfferId === offer.id}
                                onClick={(e) => handleAcceptCounterOffer(e, offer)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Annehmen
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 h-7 text-xs"
                                disabled={respondingOfferId === offer.id}
                                onClick={(e) => handleRejectCounterOffer(e, offer)}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Ablehnen
                              </Button>
                            </div>
                          )}

                          {offer.seller_response && (
                            <p className="text-[11px] text-muted-foreground mt-1 italic line-clamp-1">
                              "{offer.seller_response}"
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
