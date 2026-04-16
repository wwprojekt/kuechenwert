import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Eye,
  Calendar,
  Gauge,
  Bed,
  Droplets,
  Sun,
  Wind,
  TrendingUp,
  Users,
  Clock,
  Fuel,
  Zap,
  Ruler,
  Weight,
  Utensils,
  Thermometer,
  Battery,
  Bike,
  Tv,
  Camera,
  Radio,
  Shield,
  Lock,
  FileText,
  Send,
  Plus,
  MessageSquarePlus,
  ImagePlus,
  Euro,
  CheckCircle,
  XCircle,
  Handshake,
  TrendingDown,
  RotateCw,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { withSessionRetry, invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { parseGermanNumber, formatBidDisplay } from "@/lib/parseGermanNumber";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showSessionExpired } = useSessionExpired();
  const queryClient = useQueryClient();
  const [addendumText, setAddendumText] = useState("");
  const [showAddendumForm, setShowAddendumForm] = useState(false);

  // Kaufchance state
  const [kaufchanceOffers, setKaufchanceOffers] = useState<any[]>([]);
  const [kaufchanceLoading, setKaufchanceLoading] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [counterOfferAmounts, setCounterOfferAmounts] = useState<Record<string, string>>({});
  const [counterOfferMessages, setCounterOfferMessages] = useState<Record<string, string>>({});
  const [lowerCounterAmounts, setLowerCounterAmounts] = useState<Record<string, string>>({});
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);

  const { data: motorhome, isLoading } = useQuery({
    queryKey: ["motorhomeDetail", id],
    queryFn: async () => {
      if (!id) return null;

      // First try as seller (owner of the listing)
      const { data: sellerData, error: sellerError } = await supabase
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
            end_time,
            start_time,
            created_at,
            kaufchance_expires_at,
            kaufchance_min_price,
            auto_relist,
            auction_round
          )
        `)
        .eq("id", id)
        .eq("seller_id", user?.id)
        .maybeSingle();

      if (sellerData) return { ...sellerData, _isSeller: true };

      // If not found as seller, try as buyer (dealer who purchased via auction)
      const { data: buyerData, error: buyerError } = await supabase
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
            end_time,
            start_time,
            created_at,
            kaufchance_expires_at,
            kaufchance_min_price,
            auto_relist,
            auction_round
          )
        `)
        .eq("id", id)
        .eq("sold_to", user?.id)
        .maybeSingle();

      if (buyerData) return { ...buyerData, _isSeller: false };

      // Neither seller nor buyer — throw not found
      throw new Error('Motorhome not found or access denied');
    },
    enabled: !!id && !!user,
  });

  // Helper: Array-safe auction access (Supabase returns object when FK is UNIQUE)
  const resolvedAuction = motorhome?.auction
    ? (Array.isArray(motorhome.auction) ? motorhome.auction[0] : motorhome.auction)
    : null;

  const { data: bidStats } = useQuery({
    queryKey: ["bidStats", resolvedAuction?.id],
    queryFn: async () => {
      const auctionId = resolvedAuction?.id;
      if (!auctionId) return null;

      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const totalBids = data.length;
      const uniqueBidders = new Set(data.map((bid) => bid.bidder_id)).size;
      const highestBid = data.length > 0 ? Math.max(...data.map((b) => Number(b.amount))) : 0;

      return {
        totalBids,
        uniqueBidders,
        highestBid,
        recentBids: data.slice(0, 5),
      };
    },
    enabled: !!resolvedAuction?.id,
  });

  // ── Addenda: Nachträge für diese Auktion laden ──
  const auctionIdForAddenda = resolvedAuction?.id;
  const { data: addenda = [] } = useQuery({
    queryKey: ["auctionAddenda", auctionIdForAddenda],
    queryFn: async () => {
      if (!auctionIdForAddenda) return [];
      const { data, error } = await supabase
        .from("auction_addenda")
        .select("*")
        .eq("auction_id", auctionIdForAddenda)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!auctionIdForAddenda,
  });

  // ── Addendum erstellen ──
  const addendumMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!auctionIdForAddenda || !user) throw new Error("Nicht authentifiziert");
      if (!content.trim()) throw new Error("Bitte geben Sie einen Text ein");

      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("auction_addenda")
          .insert({
            auction_id: auctionIdForAddenda,
            seller_id: user.id,
            content: content.trim(),
          });
        if (error) throw error;
      }, 'ListingDetail.addAddendum');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctionAddenda", auctionIdForAddenda] });
      setAddendumText("");
      setShowAddendumForm(false);
      toast({
        title: "Nachtrag veröffentlicht",
        description: "Ihr Nachtrag ist jetzt auf der Auktionsseite sichtbar.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Nachtrag konnte nicht gespeichert werden",
        variant: "destructive",
      });
    },
  });

  const toggleAutoRelistMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!resolvedAuction?.id) throw new Error("Keine Auktion");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session expired");
      const { error } = await supabase
        .from('auctions')
        .update({ auto_relist: newValue })
        .eq('id', resolvedAuction.id);
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ['motorhomeDetail', id] });
      setShowOptOutConfirm(false);
      toast({
        title: newValue ? 'Automatische Wiedereinstellung aktiviert' : 'Automatische Wiedereinstellung deaktiviert',
        description: newValue
          ? 'Ihr Fahrzeug wird nach der Kaufchance-Phase erneut versteigert.'
          : 'Ihr Fahrzeug wird nach Ablauf der Kaufchance nicht erneut eingestellt.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  const isFestpreisListing = motorhome?.sale_channel === 'instant_price';

  // ── Kaufchance / Preisvorschlag: Angebote für den Seller laden ──
  const loadKaufchanceOffers = async () => {
    const isKaufchance = resolvedAuction?.status === 'kaufchance';
    const isFestpreisActive = isFestpreisListing && resolvedAuction?.status === 'active';
    if (!resolvedAuction?.id || (!isKaufchance && !isFestpreisActive)) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setKaufchanceLoading(true);
    try {
      // Anonymisierung: Nur Angebotsdaten laden, KEIN buyer_id (Identität erst nach Kaufvertrag)
      const { data, error } = await supabase
        .from('post_auction_offers')
        .select('id, auction_id, offer_amount, counter_offer_amount, status, message, seller_response, created_at, updated_at, expires_at')
        .eq('auction_id', resolvedAuction.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKaufchanceOffers(data || []);
    } catch (err) {
      console.error('Error loading kaufchance offers:', err);
    } finally {
      setKaufchanceLoading(false);
    }
  };

  useEffect(() => {
    loadKaufchanceOffers();
  }, [resolvedAuction?.id, resolvedAuction?.status]);

  useEffect(() => {
    const shouldPoll = resolvedAuction?.status === 'kaufchance' ||
      (isFestpreisListing && resolvedAuction?.status === 'active');
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      loadKaufchanceOffers();
    }, 15000);
    return () => clearInterval(interval);
  }, [resolvedAuction?.id, resolvedAuction?.status]);

  const handleSellerAcceptOffer = async (offerId: string) => {
    setRespondingOfferId(offerId);
    try {
      const { data, error } = await invokeWithAuth('accept-kaufchance-offer', {
        body: { offerId },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Unbekannter Fehler');

      toast({
        title: 'Angebot angenommen!',
        description: 'Der Kaufvertrag wird erstellt. Sie erhalten eine E-Mail mit den Details.',
      });
      loadKaufchanceOffers();
      queryClient.invalidateQueries({ queryKey: ['motorhomeDetail', id] });
    } catch (err: any) {
      if (err instanceof SessionExpiredError) {
        showSessionExpired(`/dashboard/listings/${id}`);
        return;
      }
      console.error('Error accepting offer:', err);
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleSellerRejectOffer = async (offerId: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    setRespondingOfferId(offerId);
    try {
      const { data: offerData } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount, auction_id')
        .eq('id', offerId)
        .single();

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'rejected',
          seller_response: 'Angebot abgelehnt',
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte laden Sie die Seite neu.' });
        loadKaufchanceOffers();
        return;
      }

      if (offerData) {
        try {
          const { error: notifyErr } = await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'offer_rejected',
              auctionId: offerData.auction_id,
              buyerId: offerData.buyer_id,
              offerAmount: Number(offerData.offer_amount),
              sellerResponse: 'Angebot abgelehnt',
            },
          });
          if (notifyErr) console.error('notify-offer-action:', notifyErr);
        } catch (e) {
          console.error('notify-offer-action:', e);
        }
      }

      toast({ title: 'Angebot abgelehnt' });
      loadKaufchanceOffers();
    } catch (err: any) {
      console.error('Error rejecting offer:', err);
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleSellerCounterOffer = async (offerId: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    const amountStr = counterOfferAmounts[offerId];
    const message = counterOfferMessages[offerId] || '';
    const amount = parseGermanNumber(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte geben Sie einen gültigen Betrag ein.', variant: 'destructive' });
      return;
    }

    setRespondingOfferId(offerId);
    try {
      const { data: offerData } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount, auction_id')
        .eq('id', offerId)
        .single();

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'countered',
          counter_offer_amount: amount,
          seller_response: message || `Gegenangebot: ${amount.toLocaleString('de-DE')} €`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte laden Sie die Seite neu.' });
        loadKaufchanceOffers();
        return;
      }

      if (offerData) {
        try {
          const { error: notifyErr } = await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'counter_offer',
              auctionId: offerData.auction_id,
              buyerId: offerData.buyer_id,
              offerAmount: Number(offerData.offer_amount),
              counterAmount: amount,
              sellerResponse: message || undefined,
            },
          });
          if (notifyErr) console.error('notify-offer-action:', notifyErr);
        } catch (e) {
          console.error('notify-offer-action:', e);
        }
      }

      toast({
        title: 'Gegenangebot gesendet',
        description: `Gegenangebot von ${amount.toLocaleString('de-DE')} € wurde gesendet.`,
      });
      setCounterOfferAmounts(prev => ({ ...prev, [offerId]: '' }));
      setCounterOfferMessages(prev => ({ ...prev, [offerId]: '' }));
      loadKaufchanceOffers();
    } catch (err: any) {
      console.error('Error sending counter offer:', err);
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleSellerLowerCounter = async (offerId: string) => {
    const newAmountStr = lowerCounterAmounts[offerId];
    const newAmount = parseGermanNumber(newAmountStr);
    const currentOffer = kaufchanceOffers.find(o => o.id === offerId);
    if (!currentOffer || !currentOffer.counter_offer_amount) return;

    if (isNaN(newAmount) || newAmount >= currentOffer.counter_offer_amount) {
      toast({ title: 'Ungültiger Betrag', description: `Neuer Betrag muss niedriger als ${Number(currentOffer.counter_offer_amount).toLocaleString('de-DE')} € sein.`, variant: 'destructive' });
      return;
    }
    if (newAmount <= Number(currentOffer.offer_amount)) {
      toast({ title: 'Ungültiger Betrag', description: `Betrag muss über dem Angebot des Händlers (${Number(currentOffer.offer_amount).toLocaleString('de-DE')} €) liegen.`, variant: 'destructive' });
      return;
    }

    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    setRespondingOfferId(offerId);
    try {
      const { data: offerData } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount, auction_id')
        .eq('id', offerId)
        .single();

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({
          counter_offer_amount: newAmount,
          seller_response: `Gegenangebot gesenkt auf ${newAmount.toLocaleString('de-DE')} €`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId)
        .eq('status', 'countered')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte laden Sie die Seite neu.' });
        loadKaufchanceOffers();
        return;
      }

      if (offerData) {
        try {
          await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'counter_offer',
              auctionId: offerData.auction_id,
              buyerId: offerData.buyer_id,
              offerAmount: Number(offerData.offer_amount),
              counterAmount: newAmount,
              sellerResponse: `Gegenangebot gesenkt auf ${newAmount.toLocaleString('de-DE')} €`,
            },
          });
        } catch (e) {
          console.error('notify-offer-action:', e);
        }
      }

      toast({ title: 'Gegenangebot gesenkt', description: `Neues Gegenangebot: ${newAmount.toLocaleString('de-DE')} €` });
      setLowerCounterAmounts(prev => ({ ...prev, [offerId]: '' }));
      loadKaufchanceOffers();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  if (!motorhome) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Inserat nicht gefunden</p>
        <Button onClick={() => navigate("/dashboard/listings")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zu Inseraten
        </Button>
      </div>
    );
  }

  const auction = resolvedAuction;
  const isSeller = motorhome?._isSeller === true;
  const isAuctionLive = auction?.status === 'active' || auction?.status === 'kaufchance';
  const rawPhotos = motorhome.photos;
  const sortedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : rawPhotos ? [rawPhotos] : []).sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(isSeller ? "/dashboard/listings" : "/dashboard/inventory")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {isSeller ? "Zurück zu Inseraten" : "Zurück zum Inventar"}
        </Button>
        <div className="flex gap-2 flex-wrap">
          {auction?.id && (
            <Link to={`/auktion/${auction.id}`} target="_blank">
              <Button variant="outline" className="gap-2">
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Öffentliche Ansicht</span>
                <span className="sm:hidden">Ansicht</span>
              </Button>
            </Link>
          )}
          {isSeller && (isAuctionLive ? (
            <Button variant="outline" className="gap-2 border-orange-500 text-orange-700 hover:bg-orange-50" disabled>
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeitung gesperrt</span>
              <span className="sm:hidden">Gesperrt</span>
            </Button>
          ) : (
            <>
              <Link to={`/dashboard/listings/${id}/edit?tab=photos`}>
                <Button variant="outline" className="gap-2">
                  <ImagePlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Fotos verwalten</span>
                  <span className="sm:hidden">Fotos</span>
                </Button>
              </Link>
              <Link to={`/dashboard/listings/${id}/edit`}>
                <Button className="gap-2">
                  <Edit className="w-4 h-4" />
                  Bearbeiten
                </Button>
              </Link>
            </>
          ))}
        </div>
      </div>

      {/* Title & Status */}
      <div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            {motorhome.manufacturer} {motorhome.model}
          </h1>
          {auction && (
            <Badge
              variant={auction.status === "active" ? "default" : "secondary"}
              className={`whitespace-nowrap ${auction.status === "active" ? "bg-green-500" : ""}`}
            >
              {auction.status === "active"
                ? "Aktiv"
                : auction.status === "draft"
                ? "Wartet auf Freischaltung"
                : auction.status === "ended"
                ? "Beendet"
                : auction.status === "sold"
                ? "Verkauft"
                : auction.status === "kaufchance"
                ? "Kaufchance"
                : auction.status === "cancelled"
                ? "Abgebrochen"
                : auction.status}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Erstellt am {format(new Date(motorhome.created_at), "dd. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Draft status info banner */}
      {auction?.status === "draft" && (
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  Wartet auf Freischaltung
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Ihr Inserat wurde erfolgreich erstellt. Unser Support-Team prüft die Angaben und aktiviert
                  Ihr Inserat in Kürze. Sie werden benachrichtigt, sobald es live geht.
                </p>
                {motorhome.reserve_price && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-white/60 dark:bg-black/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-1.5">
                    <Euro className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">Ihr Mindestpreis:</span>
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      {Number(motorhome.reserve_price).toLocaleString("de-DE")} €
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {sortedPhotos.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPhotos.map((photo, index) => (
                <div key={photo.url} className="relative aspect-video overflow-hidden rounded-lg">
                  <img
                    src={photo.url}
                    alt={`${motorhome.manufacturer} ${motorhome.model} - Foto ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {auction && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{motorhome.sale_channel === 'instant_price' ? 'Festpreis' : 'Aktuelles Gebot'}</p>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">
                €{Number(motorhome.sale_channel === 'instant_price' ? motorhome.instant_price : (auction.current_bid || auction.starting_bid)).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {motorhome.sale_channel !== 'instant_price' && (
          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Gebote</p>
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{bidStats?.totalBids || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {bidStats?.uniqueBidders || 0} Bieter
              </p>
            </CardContent>
          </Card>
          )}

          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Endet in</p>
                <Clock className="w-5 h-5 text-primary" />
              </div>
              {auction.end_time ? (
                <>
                  <p className="text-xl font-bold">
                    {format(new Date(auction.end_time), "dd.MM.yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(auction.end_time), "HH:mm", { locale: de })} Uhr
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Nicht gesetzt</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comprehensive Vehicle Data in Tabs */}
      <Card className="border-2">
        <CardContent className="p-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
              <TabsTrigger value="basic">Basis</TabsTrigger>
              <TabsTrigger value="technical">Technik</TabsTrigger>
              <TabsTrigger value="dimensions">Maße</TabsTrigger>
              <TabsTrigger value="interior">Innenraum</TabsTrigger>
              <TabsTrigger value="equipment">Ausstattung</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Baujahr</span>
                    </div>
                    <span className="font-semibold">{motorhome.year}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Kilometerstand</span>
                    </div>
                    <span className="font-semibold">{motorhome.mileage.toLocaleString()} km</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aufbauart</span>
                    <span className="font-semibold">{motorhome.body_type}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Schlafplätze</span>
                    </div>
                    <span className="font-semibold">{motorhome.sleeping_places}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Zustand</span>
                    <Badge variant="outline">{motorhome.condition}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verkaufsweg</span>
                    <Badge>
                      {motorhome.sale_channel === "instant_price"
                        ? "Nur Festpreis"
                        : motorhome.sale_channel === "station"
                        ? "Station"
                        : motorhome.instant_price && Number(motorhome.instant_price) > 0
                        ? "Auktion + Sofortkauf"
                        : "Auktion"}
                    </Badge>
                  </div>
                </div>
              </div>
              {motorhome.description && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Beschreibung</h3>
                    <p className="text-foreground whitespace-pre-wrap">{motorhome.description}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {motorhome.fuel_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Kraftstoff</span>
                        </div>
                        <span className="font-semibold">{motorhome.fuel_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.transmission && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Getriebe</span>
                        <span className="font-semibold">{motorhome.transmission}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {(motorhome.power_kw || motorhome.engine_power_hp) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Leistung</span>
                        </div>
                        <span className="font-semibold">
                          {motorhome.power_kw && `${motorhome.power_kw} kW`}
                          {motorhome.power_kw && motorhome.engine_power_hp && " / "}
                          {motorhome.engine_power_hp && `${motorhome.engine_power_hp} PS`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.emission_class && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Schadstoffklasse</span>
                        <Badge variant="secondary">{motorhome.emission_class}</Badge>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.fuel_tank_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tankinhalt</span>
                      <span className="font-semibold">{motorhome.fuel_tank_capacity_liters}L</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.first_registration && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Erstzulassung</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.first_registration), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.last_tuev_date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Letzte TÜV/HU</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.last_tuev_date), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.tuev_valid_until && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nächste TÜV/HU</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.tuev_valid_until), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.previous_owners !== null && motorhome.previous_owners !== undefined && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Vorbesitzer</span>
                        <span className="font-semibold">{motorhome.previous_owners}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {motorhome.accident_free && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="w-3 h-3" />
                        Unfallfrei
                      </Badge>
                    )}
                    {motorhome.non_smoker && (
                      <Badge variant="secondary">Nichtraucher</Badge>
                    )}
                    {motorhome.service_history_available && (
                      <Badge variant="secondary">Scheckheft</Badge>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Dimensions Tab */}
            <TabsContent value="dimensions" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {(motorhome.length_m || motorhome.width_m || motorhome.height_m) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Maße (L×B×H)</span>
                        </div>
                        <span className="font-semibold text-sm">
                          {motorhome.length_m && `${(motorhome.length_m / 100).toFixed(2)}m`}
                          {motorhome.width_m && ` × ${(motorhome.width_m / 100).toFixed(2)}m`}
                          {motorhome.height_m && ` × ${(motorhome.height_m / 100).toFixed(2)}m`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.weight_kg && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Weight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Gesamtgewicht</span>
                        </div>
                        <span className="font-semibold">{motorhome.weight_kg.toLocaleString()} kg</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.payload_kg && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nutzlast</span>
                      <span className="font-semibold">{motorhome.payload_kg.toLocaleString()} kg</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.seats && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Sitzplätze</span>
                        </div>
                        <span className="font-semibold">{motorhome.seats}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.number_of_axles && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Achsen</span>
                        <span className="font-semibold">{motorhome.number_of_axles}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.beds_description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Betten-Beschreibung</p>
                      <p className="text-sm">{motorhome.beds_description}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Interior Tab */}
            <TabsContent value="interior" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_kitchen && (
                      <Badge variant="secondary" className="gap-1">
                        <Utensils className="w-3 h-3" />
                        Küche
                      </Badge>
                    )}
                    {motorhome.has_bathroom && (
                      <Badge variant="secondary" className="gap-1">
                        <Droplets className="w-3 h-3" />
                        Bad
                      </Badge>
                    )}
                    {motorhome.has_toilet && (
                      <Badge variant="secondary">Toilette</Badge>
                    )}
                    {motorhome.has_shower && (
                      <Badge variant="secondary">Dusche</Badge>
                    )}
                  </div>
                  <Separator />
                  {motorhome.refrigerator_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Kühlschrank</span>
                        <span className="font-semibold">{motorhome.refrigerator_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.heating_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Heizung</span>
                        </div>
                        <span className="font-semibold">{motorhome.heating_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.air_conditioning_type && motorhome.air_conditioning_type !== "Keine" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Klimaanlage</span>
                      <span className="font-semibold">{motorhome.air_conditioning_type}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.water_tank_liters && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Frischwasser</span>
                        <span className="font-semibold">{motorhome.water_tank_liters}L</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.grey_water_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Grauwasser</span>
                      <span className="font-semibold">{motorhome.grey_water_capacity_liters}L</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-6 mt-6">
              {(motorhome.has_solar || motorhome.has_inverter || motorhome.battery_capacity_ah) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Energie & Elektrik</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_solar && (
                      <Badge variant="secondary" className="gap-1">
                        <Sun className="w-3 h-3" />
                        Solar {motorhome.solar_power_watts && `(${motorhome.solar_power_watts}W)`}
                      </Badge>
                    )}
                    {motorhome.has_inverter && (
                      <Badge variant="secondary" className="gap-1">
                        <Battery className="w-3 h-3" />
                        Wechselrichter
                      </Badge>
                    )}
                    {motorhome.battery_capacity_ah && (
                      <Badge variant="secondary">
                        Batterie {motorhome.battery_capacity_ah}Ah
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {(motorhome.has_awning || motorhome.has_bike_rack || motorhome.has_garage) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Außenausstattung</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_awning && (
                      <Badge variant="secondary" className="gap-1">
                        <Wind className="w-3 h-3" />
                        Markise {motorhome.awning_length_m && `(${motorhome.awning_length_m}cm)`}
                      </Badge>
                    )}
                    {motorhome.has_bike_rack && (
                      <Badge variant="secondary" className="gap-1">
                        <Bike className="w-3 h-3" />
                        Fahrradträger
                      </Badge>
                    )}
                    {motorhome.has_garage && (
                      <Badge variant="secondary">Garage</Badge>
                    )}
                  </div>
                </div>
              )}

              {(motorhome.has_tv || motorhome.has_backup_camera || motorhome.has_parking_sensors || motorhome.has_cruise_control || motorhome.has_central_locking) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Komfort & Sicherheit</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_tv && (
                      <Badge variant="secondary" className="gap-1">
                        <Tv className="w-3 h-3" />
                        TV/SAT
                      </Badge>
                    )}
                    {motorhome.has_backup_camera && (
                      <Badge variant="secondary" className="gap-1">
                        <Camera className="w-3 h-3" />
                        Rückfahrkamera
                      </Badge>
                    )}
                    {motorhome.has_parking_sensors && (
                      <Badge variant="secondary" className="gap-1">
                        <Radio className="w-3 h-3" />
                        Parksensoren
                      </Badge>
                    )}
                    {motorhome.has_cruise_control && (
                      <Badge variant="secondary">Tempomat</Badge>
                    )}
                    {motorhome.has_central_locking && (
                      <Badge variant="secondary">Zentralverriegelung</Badge>
                    )}
                  </div>
                </div>
              )}

              {motorhome.additional_equipment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Zusätzliche Ausstattung</p>
                  <p className="text-sm whitespace-pre-wrap">{motorhome.additional_equipment}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sale Information */}
      {(motorhome.instant_price || motorhome.reserve_price) && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <CardTitle>Verkaufsinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {motorhome.instant_price && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sofortkauf-Preis</span>
                  <span className="font-semibold text-xl">
                    €{Number(motorhome.instant_price).toLocaleString()}
                  </span>
                </div>
                <Separator />
              </>
            )}
            {motorhome.reserve_price && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mindestpreis</span>
                <span className="font-semibold text-lg">
                  €{Number(motorhome.reserve_price).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Kaufchancen-/Preisvorschlag-Sektion */}
      {(auction?.status === 'kaufchance' || (isFestpreisListing && auction?.status === 'active' && kaufchanceOffers.length > 0)) && (
        <Card className={`border-2 ${isFestpreisListing ? 'border-blue-200 dark:border-blue-800' : 'border-amber-200 dark:border-amber-800'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className={`w-5 h-5 ${isFestpreisListing ? 'text-blue-600' : 'text-amber-600'}`} />
              {isFestpreisListing ? 'Preisvorschläge von Händlern' : 'Kaufchancen – Eingehende Angebote'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isFestpreisListing
                ? 'Händler haben Ihnen Preisvorschläge für Ihr Fahrzeug unterbreitet. Sie können annehmen, ablehnen oder ein Gegenangebot machen.'
                : 'Die Auktion endete ohne Verkauf. Die Top-Bieter wurden eingeladen, Ihnen ein Angebot zu unterbreiten.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info-Karten: Preise und Frist */}
            <div className={`grid grid-cols-1 ${isFestpreisListing ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
              {isFestpreisListing ? (
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-center">
                  <p className="text-xs text-muted-foreground">Ihr Festpreis</p>
                  <p className="text-lg font-bold text-yellow-600">{Number(motorhome.instant_price || 0).toLocaleString('de-DE')} €</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Letztes Auktionsgebot</p>
                  <p className="text-lg font-bold">{Number(auction.current_bid || 0).toLocaleString('de-DE')} €</p>
                </div>
              )}
              {!isFestpreisListing && motorhome.reserve_price && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center">
                  <p className="text-xs text-muted-foreground">Ihr Mindestpreis</p>
                  <p className="text-lg font-bold text-amber-600">{Number(motorhome.reserve_price).toLocaleString('de-DE')} €</p>
                </div>
              )}
              {!isFestpreisListing && auction.kaufchance_expires_at && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                  <p className="text-xs text-muted-foreground">Kaufchance-Frist</p>
                  <p className="text-sm font-semibold">
                    {format(new Date(auction.kaufchance_expires_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </p>
                </div>
              )}
              {isFestpreisListing && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-center">
                  <p className="text-xs text-muted-foreground">Anzahl Vorschläge</p>
                  <p className="text-lg font-bold text-blue-600">{kaufchanceOffers.length}</p>
                </div>
              )}
            </div>

            {/* Auto-Relist Info & Opt-out — only for Kaufchance, not Festpreis */}
            {!isFestpreisListing && isSeller && (
              <div className={`p-4 rounded-lg border ${auction.auto_relist !== false ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800' : 'bg-muted/50 border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCw className="w-4 h-4 text-teal-600" />
                      <p className="font-medium text-sm">
                        Automatische Wiedereinstellung {auction.auto_relist !== false ? 'aktiv' : 'deaktiviert'}
                      </p>
                      {(auction.auction_round ?? 1) > 1 && (
                        <Badge variant="outline" className="text-xs">Runde {auction.auction_round}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {auction.auto_relist !== false
                        ? 'Wird keine Einigung erzielt, wird Ihr Fahrzeug automatisch erneut versteigert (gem. AGB §6).'
                        : 'Ihr Fahrzeug wird nach Ablauf der Kaufchance nicht erneut eingestellt.'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {!showOptOutConfirm ? (
                      <Button
                        variant={auction.auto_relist !== false ? "outline" : "default"}
                        size="sm"
                        onClick={() => {
                          if (auction.auto_relist !== false) {
                            setShowOptOutConfirm(true);
                          } else {
                            toggleAutoRelistMutation.mutate(true);
                          }
                        }}
                        disabled={toggleAutoRelistMutation.isPending}
                      >
                        {auction.auto_relist !== false ? 'Deaktivieren' : 'Aktivieren'}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2 items-end">
                        <p className="text-xs text-destructive font-medium text-right max-w-[200px]">
                          Ihr Fahrzeug wird nach Ablauf nicht mehr automatisch versteigert. Sicher?
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setShowOptOutConfirm(false)}>
                            Abbrechen
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => toggleAutoRelistMutation.mutate(false)}
                            disabled={toggleAutoRelistMutation.isPending}
                          >
                            {toggleAutoRelistMutation.isPending ? 'Wird gespeichert...' : 'Ja, deaktivieren'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {kaufchanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : kaufchanceOffers.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {isFestpreisListing
                    ? 'Noch keine Preisvorschläge eingegangen.'
                    : 'Noch keine Angebote eingegangen. Die eingeladenen Bieter wurden benachrichtigt.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {kaufchanceOffers.map((offer: any, offerIdx: number) => {
                  // Anonymisiert: Verkäufer sieht keine echten Händlernamen
                  const anonymizedName = `Bieter ${offerIdx + 1}`;

                  return (
                    <div key={offer.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{anonymizedName}</h4>
                            {/* Kundennummer ausgeblendet - Anonymisierung */}
                            {offer.status === 'pending' && (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">Ausstehend</Badge>
                            )}
                            {offer.status === 'accepted' && (
                              <Badge className="bg-green-500">Angenommen</Badge>
                            )}
                            {offer.status === 'rejected' && (
                              <Badge variant="destructive">Abgelehnt</Badge>
                            )}
                            {offer.status === 'countered' && (
                              <Badge className="bg-blue-500 text-white">Gegenangebot gesendet</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mb-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Angebot</p>
                              <p className="font-bold text-lg flex items-center gap-1">
                                <Euro className="w-4 h-4" />
                                {Number(offer.offer_amount).toLocaleString('de-DE')} €
                              </p>
                            </div>
                            {offer.counter_offer_amount && (
                              <div>
                                <p className="text-xs text-muted-foreground">Ihr Gegenangebot</p>
                                <p className="font-bold text-lg text-blue-600">
                                  {Number(offer.counter_offer_amount).toLocaleString('de-DE')} €
                                </p>
                              </div>
                            )}
                          </div>

                          {offer.message && (
                            <p className="text-sm text-muted-foreground italic mb-2">
                              "{offer.message}"
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Eingegangen am {format(new Date(offer.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                          </p>
                        </div>

                        {/* Aktions-Buttons */}
                        {offer.status === 'pending' && (
                          <div className="flex flex-col gap-3 w-full md:min-w-[280px] md:w-auto">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-600 flex-1"
                                disabled={respondingOfferId === offer.id}
                                onClick={() => handleSellerAcceptOffer(offer.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Annehmen
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                disabled={respondingOfferId === offer.id}
                                onClick={() => handleSellerRejectOffer(offer.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Ablehnen
                              </Button>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium">Oder Gegenangebot senden:</p>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Betrag in €"
                                  value={counterOfferAmounts[offer.id] || ''}
                                  onChange={(e) => setCounterOfferAmounts(prev => ({ ...prev, [offer.id]: formatBidDisplay(e.target.value) }))}
                                  className="flex-1"
                                />
                              </div>
                              <Textarea
                                placeholder="Nachricht (optional)"
                                value={counterOfferMessages[offer.id] || ''}
                                onChange={(e) => setCounterOfferMessages(prev => ({ ...prev, [offer.id]: e.target.value }))}
                                rows={2}
                                className="resize-none"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-blue-500 text-blue-700 hover:bg-blue-50"
                                disabled={respondingOfferId === offer.id || !counterOfferAmounts[offer.id]}
                                onClick={() => handleSellerCounterOffer(offer.id)}
                              >
                                <Handshake className="w-4 h-4 mr-1" />
                                Gegenangebot senden
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Gegenangebot senken (bei countered, solange Händler nicht reagiert hat) */}
                        {offer.status === 'countered' && offer.counter_offer_amount && (
                          <div className="flex flex-col gap-2 w-full md:min-w-[280px] md:w-auto">
                            <p className="text-xs text-muted-foreground">
                              Wartet auf Antwort des Händlers. Sie können Ihr Gegenangebot senken:
                            </p>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder={`< ${Number(offer.counter_offer_amount).toLocaleString('de-DE')} €`}
                                value={lowerCounterAmounts[offer.id] || ''}
                                onChange={(e) => setLowerCounterAmounts(prev => ({ ...prev, [offer.id]: formatBidDisplay(e.target.value) }))}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-500 text-blue-700 hover:bg-blue-50"
                                disabled={respondingOfferId === offer.id || !lowerCounterAmounts[offer.id]}
                                onClick={() => handleSellerLowerCounter(offer.id)}
                              >
                                <TrendingDown className="w-4 h-4 mr-1" />
                                Senken
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hinweis: Zurück in Auktion */}
            <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Wenn kein passendes Angebot dabei ist, kann Ihr Wohnmobil erneut in eine Auktion gegeben werden.
                Bitte kontaktieren Sie uns unter <strong>info@caravanwert.de</strong> oder warten Sie, bis unser Team sich bei Ihnen meldet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nachträge-Sektion (nur bei aktiver Auktion für Verkäufer) */}
      {isAuctionLive && auction?.id && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquarePlus className="w-5 h-5 text-blue-600" />
                Nachträge
              </CardTitle>
              {!showAddendumForm && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30 w-full sm:w-auto"
                  onClick={() => setShowAddendumForm(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nachtrag hinzufügen
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Nachträge werden öffentlich auf der Auktionsseite mit Datum und Uhrzeit angezeigt.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bestehende Nachträge */}
            {addenda.length > 0 && (
              <div className="space-y-3">
                {addenda.map((item: any) => (
                  <div key={item.id} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Veröffentlicht am {format(new Date(item.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {addenda.length === 0 && !showAddendumForm && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Nachträge vorhanden.
              </p>
            )}

            {/* Nachtrag-Formular */}
            {showAddendumForm && (
              <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/10">
                <Label htmlFor="addendum" className="font-semibold">
                  Neuer Nachtrag
                </Label>
                <Textarea
                  id="addendum"
                  value={addendumText}
                  onChange={(e) => setAddendumText(e.target.value)}
                  placeholder="z.B. Neuer TÜV wurde am 25.03.2026 gemacht. Neue Reifen montiert."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Dieser Text wird öffentlich auf der Auktionsseite angezeigt und kann nicht mehr gelöscht werden.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowAddendumForm(false); setAddendumText(""); }}
                    className="w-full sm:w-auto"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!addendumText.trim() || addendumMutation.isPending}
                    onClick={() => addendumMutation.mutate(addendumText)}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Send className="w-4 h-4" />
                    {addendumMutation.isPending ? "Wird veröffentlicht..." : "Nachtrag veröffentlichen"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Bids */}
      {bidStats && bidStats.recentBids.length > 0 && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <CardTitle>Neueste Gebote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bidStats.recentBids.map((bid: any) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-semibold">€{Number(bid.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                  {bid.is_autobid && (
                    <Badge variant="outline" className="text-xs">
                      Autobid
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
