import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KaufchanceBadge } from "@/components/KaufchanceBadge";
import { PostAuctionOfferDialog } from "@/components/PostAuctionOfferDialog";
import { Input } from "@/components/ui/input";
import { Zap, Car, Clock, Euro, CheckCircle, XCircle, Trophy, RefreshCw, TrendingUp, MessageCircleReply } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession, isNetworkError } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";
import { parseGermanNumber, formatBidDisplay } from "@/lib/parseGermanNumber";
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

/** Auktion: Bieterphase vorbei, DB-Status noch „active“ – close-auction / Cron steht aus */
interface PendingClosureAuction {
  id: string;
  current_bid: number | null;
  end_time: string;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    listing_number: string | null;
    photos: Array<{ url: string; display_order: number }>;
  };
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
      sale_channel?: string | null;
      instant_price?: number | null;
      photos: Array<{ url: string; display_order: number }>;
    };
  };
}

export default function MyKaufchancen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showSessionExpired } = useSessionExpired();
  const [kaufchancen, setKaufchancen] = useState<KaufchanceAuction[]>([]);
  const [pendingClosure, setPendingClosure] = useState<PendingClosureAuction[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("browse");
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [raiseAmounts, setRaiseAmounts] = useState<Record<string, string>>({});
  // Per-offer text for "eigenes Gegenangebot" input (status='countered' offers).
  const [counterAmounts, setCounterAmounts] = useState<Record<string, string>>({});
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (!user || isLoadingRef.current) return;

    isLoadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      // Session-Check: Ensure valid token before RLS-protected queries.
      // KRITISCH: getSession() gibt auch abgelaufene Tokens aus dem Cache zurück!
      // ensureValidRLSSession() prüft die TATSÄCHLICHE Token-Gültigkeit und refresht wenn nötig.
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        showSessionExpired('/dashboard/kaufchancen');
        return;
      }

      // Step 1: Load the current user's kaufchance invitations
      const { data: invitations, error: invError } = await supabase
        .from("kaufchance_invitations")
        .select("*")
        .eq("bidder_id", user.id);

      if (invError) throw invError;
      if (!isMountedRef.current) return;

      // Step 1b: Auktionen mit eigenem Gebot, die „abgelaufen“ sind aber noch status active (Schließung ausstehend)
      const { data: bidRows, error: bidRowsErr } = await supabase
        .from("bids")
        .select("auction_id")
        .eq("bidder_id", user.id);
      if (bidRowsErr) throw bidRowsErr;

      const bidAuctionIds = [...new Set((bidRows || []).map((r) => r.auction_id).filter(Boolean))] as string[];
      if (bidAuctionIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { data: stuckRows, error: stuckErr } = await supabase
          .from("auctions")
          .select(`
            id,
            current_bid,
            end_time,
            motorhome:motorhomes (
              id,
              manufacturer,
              model,
              year,
              listing_number,
              photos:motorhome_photos (url, display_order)
            )
          `)
          .in("id", bidAuctionIds)
          .eq("status", "active")
          .lt("end_time", nowIso)
          .order("end_time", { ascending: false });
        if (stuckErr) throw stuckErr;
        if (!isMountedRef.current) return;
        setPendingClosure((stuckRows || []) as PendingClosureAuction[]);
      } else {
        setPendingClosure([]);
      }

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

      // Step 3: Load my offers (Kaufchance + Festpreis-Preisvorschläge)
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
              sale_channel,
              instant_price,
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
      // Transiente Netzwerkfehler nicht als CONSOLE_ERROR ins error_logs spülen
      if (isNetworkError(error)) {
        logger.warn("MyKaufchancen: transient network error, will retry on next focus/reconnect", error);
      } else {
        console.error("Error loading kaufchancen:", error);
      }
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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        showSessionExpired('/dashboard/kaufchancen');
        return;
      }
      const { data: updateResult, error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id)
        .eq('buyer_id', user!.id)
        .eq('status', 'countered')
        .select('id');
      if (error) throw error;
      if (!updateResult || updateResult.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte laden Sie die Seite neu.' });
        loadData();
        return;
      }
      try {
        await invokeWithAuth('notify-offer-action', {
          body: {
            action: 'buyer_reject_counter',
            auctionId: offer.auction_id,
            buyerId: user!.id,
            offerAmount: Number(offer.offer_amount),
            counterAmount: Number(offer.counter_offer_amount),
          },
        });
      } catch (notifyErr) {
        console.error('Failed to notify seller about rejected counter:', notifyErr);
      }
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

  const handleRaiseOffer = async (e: React.MouseEvent, offer: MyOffer) => {
    e.preventDefault();
    e.stopPropagation();
    const newAmount = parseGermanNumber(raiseAmounts[offer.id]);
    if (isNaN(newAmount) || newAmount <= offer.offer_amount) {
      toast({ title: 'Ungültiger Betrag', description: `Neuer Betrag muss höher als ${offer.offer_amount.toLocaleString('de-DE')} € sein.`, variant: 'destructive' });
      return;
    }
    setRespondingOfferId(offer.id);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { showSessionExpired('/dashboard/kaufchancen'); return; }

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({ offer_amount: newAmount, message: `Angebot erhöht auf ${newAmount.toLocaleString('de-DE')} €`, updated_at: new Date().toISOString() })
        .eq('id', offer.id)
        .eq('buyer_id', user!.id)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte laden Sie die Seite neu.' });
        loadData();
        return;
      }
      // Notify seller about raised offer
      try {
        await invokeWithAuth('notify-offer-action', {
          body: {
            action: 'new_offer',
            auctionId: offer.auction_id,
            buyerId: user!.id,
            offerAmount: newAmount,
            message: `Angebot erhöht von ${offer.offer_amount.toLocaleString('de-DE')} € auf ${newAmount.toLocaleString('de-DE')} €`,
          },
        });
      } catch (notifyErr) {
        console.error('Failed to notify seller about raised offer:', notifyErr);
      }
      toast({ title: 'Angebot erhöht', description: `Ihr Angebot wurde auf ${newAmount.toLocaleString('de-DE')} € erhöht.` });
      setRaiseAmounts(prev => ({ ...prev, [offer.id]: '' }));
      loadData();
    } catch (err) {
      console.error('Error raising offer:', err);
      toast({ title: 'Fehler', description: 'Angebot konnte nicht erhöht werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  // Send the buyer's own counter to a seller-counter (status='countered'),
  // converting the row back to status='pending' with a new offer_amount.
  // This unblocks the "Preisvorstellung des Verkäufers" deadlock where the
  // dialog only offered Accept / Reject.
  const handleBuyerCounter = async (e: React.MouseEvent, offer: MyOffer) => {
    e.preventDefault();
    e.stopPropagation();
    const newAmount = parseGermanNumber(counterAmounts[offer.id]);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast({ title: 'Ungültiger Betrag', description: 'Bitte geben Sie einen gültigen Betrag ein.', variant: 'destructive' });
      return;
    }
    const sellerCounter = Number(offer.counter_offer_amount ?? 0);
    if (sellerCounter > 0 && newAmount >= sellerCounter) {
      toast({
        title: 'Betrag ≥ Gegenangebot',
        description: `Wenn Ihr Vorschlag (${newAmount.toLocaleString('de-DE')} €) ≥ ${sellerCounter.toLocaleString('de-DE')} € ist, sollten Sie das Gegenangebot lieber direkt annehmen.`,
        variant: 'destructive',
      });
      return;
    }
    setRespondingOfferId(offer.id);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { showSessionExpired('/dashboard/kaufchancen'); return; }

      const { data: auctionForExpiry } = await supabase
        .from('auctions').select('kaufchance_expires_at').eq('id', offer.auction_id).single();
      const counterExpiresAt = auctionForExpiry?.kaufchance_expires_at ?? null;

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'pending',
          offer_amount: newAmount,
          counter_offer_amount: null,
          seller_response: null,
          message: `Gegenvorschlag des Käufers: ${newAmount.toLocaleString('de-DE')} €`,
          expires_at: counterExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id)
        .eq('buyer_id', user!.id)
        .eq('status', 'countered')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte Seite neu laden.' });
        loadData();
        return;
      }

      try {
        await invokeWithAuth('notify-offer-action', {
          body: {
            action: 'new_offer',
            auctionId: offer.auction_id,
            buyerId: user!.id,
            offerAmount: newAmount,
            message: `Käufer hat Ihr Gegenangebot über ${sellerCounter.toLocaleString('de-DE')} € mit einem eigenen Vorschlag von ${newAmount.toLocaleString('de-DE')} € beantwortet.`,
          },
        });
      } catch (notifyErr) {
        console.error('Failed to notify seller about buyer counter:', notifyErr);
      }

      toast({
        title: 'Gegenvorschlag gesendet',
        description: `Ihr Vorschlag über ${newAmount.toLocaleString('de-DE')} € wurde an den Verkäufer übermittelt.`,
      });
      setCounterAmounts(prev => ({ ...prev, [offer.id]: '' }));
      loadData();
    } catch (err) {
      console.error('Error submitting buyer counter:', err);
      toast({ title: 'Fehler', description: 'Gegenvorschlag konnte nicht gesendet werden.', variant: 'destructive' });
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
            Kaufchancen & Preisvorschläge
          </h1>
          <p className="text-sm text-muted-foreground">
            Nachverhandlung nach Auktionen, Preisvorschläge für Festpreis-Inserate und ausstehende Auswertungen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {format(lastRefresh, "HH:mm", { locale: de })} Uhr
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => loadData(false)}
            disabled={loading}
            title="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-1">
          <TabsTrigger value="browse" className="text-xs sm:text-sm px-3 py-1.5">
            Kaufchancen ({kaufchancen.length})
          </TabsTrigger>
          <TabsTrigger value="my-offers" className="text-xs sm:text-sm px-3 py-1.5">
            Angebote ({myOffers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-3">
          {!loading && pendingClosure.length > 0 && (
            <Card className="border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/25 p-4">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                Auswertung ausstehend ({pendingClosure.length})
              </h3>
              <p className="text-xs text-amber-900/90 dark:text-amber-100/90 mb-3">
                Diese Auktionen sind bereits beendet, wurden auf dem Server aber noch nicht endgültig abgeschlossen. Sobald die
                Auswertung läuft, erscheint hier ggf. eine Kaufchance (wenn das Limit nicht erreicht wurde) oder der Status in{" "}
                <Link to="/dashboard/gebote" className="underline font-medium">
                  Meine Gebote
                </Link>
                . Die Auktionsseite bleibt aufrufbar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pendingClosure.map((a) => {
                  const mh = a.motorhome;
                  const safePh = Array.isArray(mh?.photos) ? mh.photos : mh?.photos ? [mh.photos] : [];
                  const first = [...safePh].sort((x, y) => x.display_order - y.display_order)[0];
                  return (
                    <Link
                      key={a.id}
                      to={`/auktion/${a.id}`}
                      className="flex gap-3 rounded-md border border-amber-200 dark:border-amber-800 bg-background/80 p-2 text-left hover:border-primary/40 transition-colors"
                    >
                      <div className="w-16 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                        {first ? (
                          <img src={first.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Car className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-1">
                          {mh?.manufacturer} {mh?.model}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Ende {format(new Date(a.end_time), "dd.MM.yyyy HH:mm", { locale: de })} · Höchstgebot{" "}
                          {Number(a.current_bid || 0).toLocaleString("de-DE")} €
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : kaufchancen.length === 0 && pendingClosure.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Keine laufende Kaufchance</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Hier erscheinen Auktionen in der Kaufchance-Phase, nachdem die Plattform sie abgeschlossen hat und Sie als
                  Top-Bieter eingeladen wurden. Prüfen Sie oben „Auswertung ausstehend“ oder{" "}
                  <Link to="/dashboard/gebote" className="text-primary underline">
                    Meine Gebote
                  </Link>
                  .
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
                            {offer.offer_amount > 0 ? (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Ihr Angebot:</span>
                                <span className="font-semibold tabular-nums">{offer.offer_amount.toLocaleString('de-DE')} €</span>
                              </div>
                            ) : offer.counter_offer_amount ? (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Preisvorstellung:</span>
                                <span className="font-semibold text-blue-600 tabular-nums">
                                  {offer.counter_offer_amount.toLocaleString('de-DE')} €
                                </span>
                              </div>
                            ) : null}
                            {offer.offer_amount > 0 && offer.counter_offer_amount && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Gegenangebot:</span>
                                <span className="font-semibold text-blue-600 tabular-nums">
                                  {offer.counter_offer_amount.toLocaleString('de-DE')} €
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Raise pending offer */}
                          {offer.status === 'pending' && (
                            <div className="flex gap-1.5 mt-2 pt-1.5 border-t border-border/40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder={`> ${offer.offer_amount.toLocaleString('de-DE')} €`}
                                value={raiseAmounts[offer.id] || ''}
                                onChange={(e) => setRaiseAmounts(prev => ({ ...prev, [offer.id]: formatBidDisplay(e.target.value) }))}
                                className="flex-1 h-9 text-sm"
                              />
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600"
                                disabled={respondingOfferId === offer.id || !raiseAmounts[offer.id]}
                                onClick={(e) => handleRaiseOffer(e, offer)}
                              >
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Erhöhen
                              </Button>
                            </div>
                          )}

                          {/* Counter-offer actions */}
                          {offer.status === 'countered' && offer.counter_offer_amount && (
                            <div className="space-y-1.5 mt-2 pt-1.5 border-t border-border/40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-green-500 hover:bg-green-600"
                                  disabled={respondingOfferId === offer.id}
                                  onClick={(e) => handleAcceptCounterOffer(e, offer)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  Annehmen
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  disabled={respondingOfferId === offer.id}
                                  onClick={(e) => handleRejectCounterOffer(e, offer)}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  Ablehnen
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={`< ${Number(offer.counter_offer_amount).toLocaleString('de-DE')} €`}
                                  value={counterAmounts[offer.id] || ''}
                                  onChange={(e) => setCounterAmounts(prev => ({ ...prev, [offer.id]: formatBidDisplay(e.target.value) }))}
                                  className="flex-1 h-9 text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  disabled={respondingOfferId === offer.id || !counterAmounts[offer.id]}
                                  onClick={(e) => handleBuyerCounter(e, offer)}
                                >
                                  <MessageCircleReply className="w-3.5 h-3.5 mr-1" />
                                  Gegenvorschlag
                                </Button>
                              </div>
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
