import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
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
  Info,
  ShieldCheck,
  Hourglass,
  Archive,
  ArchiveRestore,
  Sparkles,
} from "lucide-react";
import { RestartListingDialog } from "@/components/dashboard/RestartListingDialog";
import { AdjustPriceRestartDialog } from "@/components/dashboard/AdjustPriceRestartDialog";
import { ArchiveListingDialog } from "@/components/dashboard/ArchiveListingDialog";
import { format, formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { MARKETING_CONFIG, computeReserveFloor } from "@/lib/marketing-config";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { withSessionRetry, invokeWithAuth, SessionExpiredError, ensureValidRLSSession, isNetworkError } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";
import { parseGermanNumber, formatBidDisplay } from "@/lib/parseGermanNumber";
import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Soft-Brake / Reaktivierungs-Dialoge (Phase 6)
  // Die Buttons in der `seller_soft_brake` und `seller_chose_to_end` Mail
  // verlinken mit ?action=restart|adjust-price|archive auf diese Seite.
  // Hier werden sie in echte UI-Aktionen übersetzt (RPC seller_restart_listing /
  // seller_archive_listing / seller_unarchive_listing).
  const [searchParams, setSearchParams] = useSearchParams();
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showAdjustPriceDialog, setShowAdjustPriceDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [unarchivingInProgress, setUnarchivingInProgress] = useState(false);

  const { data: kitchen, isLoading } = useQuery({
    queryKey: ["kitchenDetail", id],
    queryFn: async () => {
      if (!id) return null;

      // First try as seller (owner of the listing)
      const { data: sellerData } = await supabase
        .from("kitchens")
        .select(`
          *,
          photos:kitchen_photos (
            url,
            card_url,
            medium_url,
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
            auction_round,
            marketing_phase_started_at,
            last_price_reduction_at,
            reserve_price
          )
        `)
        .eq("id", id)
        .eq("seller_id", user?.id)
        .maybeSingle();

      if (sellerData) return { ...sellerData, _isSeller: true };

      // If not found as seller, try as buyer (dealer who purchased via auction)
      const { data: buyerData } = await supabase
        .from("kitchens")
        .select(`
          *,
          photos:kitchen_photos (
            url,
            card_url,
            medium_url,
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
            auction_round,
            marketing_phase_started_at,
            last_price_reduction_at,
            reserve_price
          )
        `)
        .eq("id", id)
        .eq("sold_to", user?.id)
        .maybeSingle();

      if (buyerData) return { ...buyerData, _isSeller: false };

      // Neither seller nor buyer — throw not found
      throw new Error('Kitchen not found or access denied');
    },
    enabled: !!id && !!user,
  });

  // Helper: Array-safe auction access (Supabase returns object when FK is UNIQUE)
  // Strategy-relevant Felder (auto_relist, dynamic_pricing,
  // marketing_phase_max_until, agb_version_at_start, seller_initial_*) sind
  // seit P4-Hardening NICHT mehr direkt selectable für authenticated/anon
  // (column-REVOKE auf public.auctions). Die werden via
  // get_auction_owner_meta-RPC (unten) nachgeladen und in resolvedAuction
  // gemerged, damit die Render-Logik weiter `auction.auto_relist` etc.
  // lesen kann.
  const baseAuction = kitchen?.auction
    ? (Array.isArray(kitchen.auction) ? kitchen.auction[0] : kitchen.auction)
    : null;

  // Owner-Meta (auto_relist, dynamic_pricing, marketing_phase_max_until,
  // agb_version_at_start) via SECURITY DEFINER RPC. Diese 4 Spalten sind
  // seit P4-Hardening (Audit Round 3, Bug #14/#15) NICHT mehr direkt für
  // authenticated/anon selectable — sonst könnte jeder Käufer die
  // Bid-Strategie reverse-engineeren. Nur Owner und Admin lesen sie über
  // `get_auction_owner_meta`. Buyer-Pfad bekommt 42501 → null Fallback.
  const auctionIdForOwnerMeta = baseAuction?.id as string | undefined;
  const isSellerForOwnerMeta = kitchen?._isSeller === true;
  const { data: ownerMeta } = useQuery({
    queryKey: ["auctionOwnerMeta", auctionIdForOwnerMeta],
    queryFn: async () => {
      if (!auctionIdForOwnerMeta) return null;
      const { data, error } = await supabase.rpc(
        "get_auction_owner_meta",
        { p_auction_id: auctionIdForOwnerMeta },
      );
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : null;
      return row
        ? {
            autoRelist: row.auto_relist,
            dynamicPricing: row.dynamic_pricing,
            marketingPhaseMaxUntil: row.marketing_phase_max_until,
            agbVersionAtStart: row.agb_version_at_start,
          }
        : null;
    },
    enabled: !!auctionIdForOwnerMeta && isSellerForOwnerMeta,
  });

  // Backward-compatible shape: baseAuction (public columns) +
  // ownerMeta (sensitive columns) → ein einziges Objekt, das die
  // bestehende Render-Logik unverändert konsumieren kann.
  const resolvedAuction = useMemo(() => {
    if (!baseAuction) return null;
    return {
      ...baseAuction,
      auto_relist: ownerMeta?.autoRelist ?? undefined,
      dynamic_pricing: ownerMeta?.dynamicPricing ?? undefined,
      marketing_phase_max_until: ownerMeta?.marketingPhaseMaxUntil ?? null,
      agb_version_at_start: ownerMeta?.agbVersionAtStart ?? null,
    } as typeof baseAuction & {
      auto_relist?: boolean | null;
      dynamic_pricing?: boolean | null;
      marketing_phase_max_until?: string | null;
      agb_version_at_start?: string | null;
    };
  }, [baseAuction, ownerMeta]);

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

  // ── Marketing-Anker (seller_initial_*): via SECURITY DEFINER RPC ──
  // Die zwei Anker-Spalten sind seit P4-Hardening NICHT mehr direkt
  // selectable für authenticated/anon (column-REVOKE auf public.auctions).
  // Die RPC `get_auction_marketing_anchors` erlaubt nur Owner und Admin
  // den Lesezugriff. Wir laden die Anker nur wenn wir Seller sind und
  // eine Auktion existiert — Käufer-Pfade brauchen die Werte nicht.
  const isSellerForAnchors = kitchen?._isSeller === true;
  const kitchenIdForAnchors = kitchen?.id as string | undefined;
  const { data: marketingAnchors } = useQuery({
    queryKey: ["marketingAnchors", kitchenIdForAnchors],
    queryFn: async () => {
      if (!kitchenIdForAnchors) return null;
      const { data, error } = await supabase.rpc(
        "get_auction_marketing_anchors",
        { p_kitchen_id: kitchenIdForAnchors },
      );
      if (error) {
        // 42501 (insufficient_privilege) → User ist weder Owner noch Admin.
        // Im seller-Pfad sollte das nicht passieren; defensiv null zurück.
        return null;
      }
      const row = Array.isArray(data) ? data[0] : null;
      return row
        ? {
            sellerInitialReserve: row.seller_initial_reserve,
            sellerInitialInstantPrice: row.seller_initial_instant_price,
          }
        : null;
    },
    enabled: !!kitchenIdForAnchors && isSellerForAnchors && !!baseAuction,
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

  const isFestpreisListing = kitchen?.sale_channel === 'instant_price';

  const toggleAutoRelistMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!resolvedAuction?.id) throw new Error("Keine Auktion");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session expired");
      // Bug-fix #2: use SECURITY DEFINER RPC instead of direct UPDATE.
      // The previous "Seller can toggle auto_relist" RLS policy was column-blind
      // and would have allowed sellers to mutate reserve_price, end_time, etc.
      // toggle_auto_relist verifies ownership + status server-side and only
      // writes the auto_relist column.
      const { data, error } = await supabase.rpc('toggle_auto_relist', {
        p_auction_id: resolvedAuction.id,
        p_value: newValue,
      });
      if (error) throw error;
      return (data as boolean | null) ?? newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ['kitchenDetail', id] });
      setShowOptOutConfirm(false);
      const isFestpreis = isFestpreisListing;
      toast({
        title: newValue ? 'Automatische Verlängerung aktiviert' : 'Automatische Verlängerung deaktiviert',
        description: newValue
          ? (isFestpreis
              ? 'Ihr Festpreis-Inserat wird nach Ablauf automatisch um 7 Tage verlängert.'
              : 'Ihr Fahrzeug wird nach der Kaufchance-Phase erneut versteigert.')
          : (isFestpreis
              ? 'Ihr Festpreis-Inserat wird nach Ablauf nicht mehr automatisch verlängert.'
              : 'Ihr Fahrzeug wird nach Ablauf der Kaufchance nicht erneut eingestellt.'),
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  // ── Dynamic Pricing Toggle (analog zu auto_relist, eigene Bestätigung) ──
  const [showDynamicPricingOptOut, setShowDynamicPricingOptOut] = useState(false);
  const toggleDynamicPricingMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!resolvedAuction?.id) throw new Error("Keine Auktion");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session expired");
      const { data, error } = await supabase.rpc('toggle_dynamic_pricing', {
        p_auction_id: resolvedAuction.id,
        p_value: newValue,
      });
      if (error) throw error;
      return (data as boolean | null) ?? newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ['kitchenDetail', id] });
      setShowDynamicPricingOptOut(false);
      toast({
        title: newValue ? 'Automatische Preissenkung aktiviert' : 'Automatische Preissenkung deaktiviert',
        description: newValue
          ? 'Ihr Mindestpreis wird in jeder neuen Runde automatisch gesenkt – bis zum festgelegten Floor.'
          : 'Ihr Mindestpreis bleibt in folgenden Runden unverändert. Sie können die Funktion jederzeit wieder aktivieren.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  // ── Kaufchance / Preisvorschlag: Angebote für den Seller laden ──
  // useCallback, damit die Funktion in useEffect-deps stable ist und kein
  // Re-Render einen neuen Polling-Interval anstösst (bzw. die exhaustive-deps-
  // Lint-Regel sauber erfüllt wird).
  const loadKaufchanceOffers = useCallback(async () => {
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
      // Transiente Netzwerkfehler nicht als CONSOLE_ERROR ins error_logs spülen
      if (isNetworkError(err)) {
        logger.warn('ListingDetail: transient network error loading kaufchance offers', err);
      } else {
        logger.error('Error loading kaufchance offers:', err);
      }
    } finally {
      setKaufchanceLoading(false);
    }
  }, [resolvedAuction?.id, resolvedAuction?.status, isFestpreisListing]);

  useEffect(() => {
    loadKaufchanceOffers();
  }, [loadKaufchanceOffers]);

  useEffect(() => {
    const shouldPoll = resolvedAuction?.status === 'kaufchance' ||
      (isFestpreisListing && resolvedAuction?.status === 'active');
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      loadKaufchanceOffers();
    }, 15000);
    return () => clearInterval(interval);
  }, [resolvedAuction?.status, isFestpreisListing, loadKaufchanceOffers]);

  // ── Soft-Brake / Reaktivierungs-URL-Handler (Phase 6) ────────────────────
  // Die 3 Buttons in der seller_soft_brake-Mail und der seller_chose_to_end-
  // Mail hängen den jeweiligen Action-Param an:
  //   ?action=restart       → frische Marketing-Phase ohne Preisänderung
  //   ?action=adjust-price  → Dialog mit Preis-Eingabe, danach Neustart
  //   ?action=archive       → Inserat vom Markt nehmen (is_archived=TRUE)
  // Wenn das Inserat in einem Zustand ist, der die Aktion nicht zulässt
  // (z.B. Restart bei bereits laufender Auktion), zeigen wir stattdessen
  // einen Toast und entfernen den Param wieder aus der URL, damit ein
  // Reload nicht den Dialog erneut öffnet.
  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;
    if (!kitchen) return;  // erst handeln wenn Daten da sind
    const isOwner = kitchen._isSeller === true;

    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    };

    if (!isOwner) {
      toast({
        title: "Keine Berechtigung",
        description: "Diese Aktion ist nur für den Verkäufer verfügbar.",
        variant: "destructive",
      });
      clearParam();
      return;
    }

    // Archive: nur wenn keine aktive Auktion läuft
    if (action === "archive") {
      if (resolvedAuction && ["active", "kaufchance", "draft"].includes(resolvedAuction.status as string)) {
        toast({
          title: "Archivierung nicht möglich",
          description: "Das Inserat hat eine laufende Auktion und kann nicht archiviert werden.",
          variant: "destructive",
        });
      } else if (kitchen.is_archived) {
        toast({
          title: "Bereits archiviert",
          description: "Dieses Inserat ist bereits archiviert.",
        });
      } else {
        setShowArchiveDialog(true);
      }
      clearParam();
      return;
    }

    // Restart / Adjust-Price: nur wenn keine aktive Auktion und nicht bereits verkauft
    if (action === "restart" || action === "adjust-price") {
      if (resolvedAuction && ["active", "kaufchance", "draft"].includes(resolvedAuction.status as string)) {
        toast({
          title: "Restart nicht möglich",
          description: "Das Inserat hat eine laufende Auktion.",
          variant: "destructive",
        });
      } else if (kitchen.status === "sold" || kitchen.status === "reserved") {
        toast({
          title: "Restart nicht möglich",
          description: `Inserat-Status ist „${kitchen.status}". Bitte legen Sie ein neues Inserat an.`,
          variant: "destructive",
        });
      } else {
        if (action === "restart") setShowRestartDialog(true);
        if (action === "adjust-price") setShowAdjustPriceDialog(true);
      }
      clearParam();
      return;
    }
    // Unbekannter Action-Param: einfach stehen lassen, kein Spam
  }, [searchParams, kitchen, resolvedAuction, setSearchParams, toast]);

  // Unarchive-Mutation: einfacher Inline-Call, kein eigener Dialog
  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seller_unarchive_listing", {
        p_kitchen_id: id!,
      });
      if (error) throw error;
      return data;
    },
    onMutate: () => setUnarchivingInProgress(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchenDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      toast({
        title: "Inserat wiederhergestellt",
        description: "Das Inserat ist nun wieder in Ihrer Liste sichtbar. Sie können es von dort neu einstellen.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Fehler",
        description: err?.message || "Wiederherstellung fehlgeschlagen.",
        variant: "destructive",
      });
    },
    onSettled: () => setUnarchivingInProgress(false),
  });

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
      queryClient.invalidateQueries({ queryKey: ['kitchenDetail', id] });
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

  if (!kitchen) {
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
  const isSeller = kitchen?._isSeller === true;
  const isAuctionLive = auction?.status === 'active' || auction?.status === 'kaufchance';
  const rawPhotos = kitchen.photos;
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
            {kitchen.manufacturer} {kitchen.model}
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
          Erstellt am {format(new Date(kitchen.created_at), "dd. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* ── Archiv-Banner (is_archived=TRUE) ─────────────────────────────── */}
      {isSeller && kitchen.is_archived && (
        <Card className="border-2 border-muted bg-muted/40">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-muted">
                <Archive className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-foreground">Inserat archiviert</h3>
                <p className="text-sm text-muted-foreground">
                  Dieses Inserat ist vom Markt genommen. Es erscheint nicht mehr in Suchergebnissen oder auf /kaufen.
                  Sie können es jederzeit wiederherstellen und erneut als Auktion oder Festpreis-Inserat einstellen.
                </p>
              </div>
              <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => unarchiveMutation.mutate()}
                  disabled={unarchivingInProgress}
                  className="gap-2"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  {unarchivingInProgress ? "Wird wiederhergestellt…" : "Wiederherstellen"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reaktivierungs-Card (nach Soft-Brake / Opt-out) ──────────────── */}
      {isSeller &&
        !kitchen.is_archived &&
        !isAuctionLive &&
        auction?.status !== "draft" &&
        kitchen.status !== "sold" &&
        kitchen.status !== "reserved" &&
        (auction?.status === "ended" ||
          auction?.status === "cancelled" ||
          kitchen.status === "not_sold") && (
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Wie möchten Sie weiter vorgehen?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Die Marketing-Phase ist abgelaufen, ohne dass ein Käufer zustande gekommen ist. Sie haben drei Möglichkeiten:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={() => setShowRestartDialog(true)}
                  className="justify-start gap-2 h-auto py-3 px-4 text-left flex-col items-start whitespace-normal"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <RotateCw className="w-4 h-4" />
                    Neu starten
                  </div>
                  <span className="text-xs opacity-90 font-normal">
                    Frische {MARKETING_CONFIG.AUCTION_DURATION_DAYS}-Tage-Auktion, Preis bleibt wie zuletzt
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAdjustPriceDialog(true)}
                  className="justify-start gap-2 h-auto py-3 px-4 text-left flex-col items-start whitespace-normal"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <TrendingDown className="w-4 h-4" />
                    Preis anpassen
                  </div>
                  <span className="text-xs text-muted-foreground font-normal">
                    Neuer Mindestpreis + frischer Start (empfohlen)
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowArchiveDialog(true)}
                  className="justify-start gap-2 h-auto py-3 px-4 text-left flex-col items-start whitespace-normal border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Archive className="w-4 h-4" />
                    Archivieren
                  </div>
                  <span className="text-xs font-normal opacity-80">
                    Inserat vom Markt nehmen (reversibel)
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                {kitchen.reserve_price && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-white/60 dark:bg-black/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-1.5">
                    <Euro className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">Ihr Mindestpreis:</span>
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      {Number(kitchen.reserve_price).toLocaleString("de-DE")} €
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
                    src={photo.medium_url || photo.url}
                    alt={`${kitchen.manufacturer} ${kitchen.model} - Foto ${index + 1}`}
                    loading={index < 2 ? "eager" : "lazy"}
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
                <p className="text-sm text-muted-foreground">{kitchen.sale_channel === 'instant_price' ? 'Festpreis' : 'Aktuelles Gebot'}</p>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">
                €{Number(kitchen.sale_channel === 'instant_price' ? kitchen.instant_price : (auction.current_bid || auction.starting_bid)).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {kitchen.sale_channel !== 'instant_price' && (
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
            {/* Mobile: horizontale Scroll-Leiste (Pattern aus KitchenEditDialog),
                damit fünf Tabs nicht in zwei Zeilen umbrechen oder auf 33% Breite
                zusammengequetscht werden. Tablet+ (sm:): klassisches Grid. */}
            <TabsList className="flex w-full overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 h-auto flex-nowrap justify-start sm:justify-stretch">
              <TabsTrigger value="basic" className="shrink-0 sm:shrink">Basis</TabsTrigger>
              <TabsTrigger value="technical" className="shrink-0 sm:shrink">Technik</TabsTrigger>
              <TabsTrigger value="dimensions" className="shrink-0 sm:shrink">Maße</TabsTrigger>
              <TabsTrigger value="interior" className="shrink-0 sm:shrink">Innenraum</TabsTrigger>
              <TabsTrigger value="equipment" className="shrink-0 sm:shrink">Ausstattung</TabsTrigger>
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
                    <span className="font-semibold">{kitchen.year}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Kilometerstand</span>
                    </div>
                    <span className="font-semibold">{kitchen.mileage.toLocaleString()} km</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aufbauart</span>
                    <span className="font-semibold">{kitchen.body_type}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Schlafplätze</span>
                    </div>
                    <span className="font-semibold">{kitchen.sleeping_places}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Zustand</span>
                    <Badge variant="outline">{kitchen.condition}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verkaufsweg</span>
                    <Badge>
                      {kitchen.sale_channel === "instant_price"
                        ? "Nur Festpreis"
                        : kitchen.sale_channel === "station"
                        ? "Station"
                        : kitchen.instant_price && Number(kitchen.instant_price) > 0
                        ? "Auktion + Sofortkauf"
                        : "Auktion"}
                    </Badge>
                  </div>
                </div>
              </div>
              {kitchen.description && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Beschreibung</h3>
                    <p className="text-foreground whitespace-pre-wrap break-words">{kitchen.description}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {kitchen.fuel_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Kraftstoff</span>
                        </div>
                        <span className="font-semibold">{kitchen.fuel_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.transmission && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Getriebe</span>
                        <span className="font-semibold">{kitchen.transmission}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {(kitchen.power_kw || kitchen.engine_power_hp) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Leistung</span>
                        </div>
                        <span className="font-semibold">
                          {kitchen.power_kw && `${kitchen.power_kw} kW`}
                          {kitchen.power_kw && kitchen.engine_power_hp && " / "}
                          {kitchen.engine_power_hp && `${kitchen.engine_power_hp} PS`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.emission_class && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Schadstoffklasse</span>
                        <Badge variant="secondary">{kitchen.emission_class}</Badge>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.fuel_tank_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tankinhalt</span>
                      <span className="font-semibold">{kitchen.fuel_tank_capacity_liters}L</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {kitchen.first_registration && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Erstzulassung</span>
                        <span className="font-semibold">
                          {(() => {
                            const v = kitchen.first_registration;
                            const m = /^(\d{4})-(\d{2})/.exec(v);
                            return m ? `${m[2]}.${m[1]}` : format(new Date(v), "MM.yyyy");
                          })()}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.last_tuev_date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Letzte TÜV/HU</span>
                        <span className="font-semibold">
                          {(() => {
                            const v = kitchen.last_tuev_date;
                            const m = /^(\d{4})-(\d{2})/.exec(v);
                            return m ? `${m[2]}.${m[1]}` : format(new Date(v), "MM.yyyy");
                          })()}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.tuev_valid_until && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nächste TÜV/HU</span>
                        <span className="font-semibold">
                          {(() => {
                            const v = kitchen.tuev_valid_until;
                            const m = /^(\d{4})-(\d{2})/.exec(v);
                            return m ? `${m[2]}.${m[1]}` : format(new Date(v), "MM.yyyy");
                          })()}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.previous_owners !== null && kitchen.previous_owners !== undefined && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Vorbesitzer</span>
                        <span className="font-semibold">{kitchen.previous_owners}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {kitchen.accident_free && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="w-3 h-3" />
                        Unfallfrei
                      </Badge>
                    )}
                    {kitchen.non_smoker && (
                      <Badge variant="secondary">Nichtraucher</Badge>
                    )}
                    {kitchen.service_history_available && (
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
                  {(kitchen.length_m || kitchen.width_m || kitchen.height_m) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Maße (L×B×H)</span>
                        </div>
                        <span className="font-semibold text-sm">
                          {kitchen.length_m && `${(kitchen.length_m / 100).toFixed(2)}m`}
                          {kitchen.width_m && ` × ${(kitchen.width_m / 100).toFixed(2)}m`}
                          {kitchen.height_m && ` × ${(kitchen.height_m / 100).toFixed(2)}m`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.weight_kg && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Weight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Gesamtgewicht</span>
                        </div>
                        <span className="font-semibold">{kitchen.weight_kg.toLocaleString()} kg</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.payload_kg && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nutzlast</span>
                      <span className="font-semibold">{kitchen.payload_kg.toLocaleString()} kg</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {kitchen.seats && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Sitzplätze</span>
                        </div>
                        <span className="font-semibold">{kitchen.seats}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.number_of_axles && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Achsen</span>
                        <span className="font-semibold">{kitchen.number_of_axles}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.beds_description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Betten-Beschreibung</p>
                      <p className="text-sm">{kitchen.beds_description}</p>
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
                    {kitchen.has_kitchen && (
                      <Badge variant="secondary" className="gap-1">
                        <Utensils className="w-3 h-3" />
                        Küche
                      </Badge>
                    )}
                    {kitchen.has_bathroom && (
                      <Badge variant="secondary" className="gap-1">
                        <Droplets className="w-3 h-3" />
                        Bad
                      </Badge>
                    )}
                    {kitchen.has_toilet && (
                      <Badge variant="secondary">Toilette</Badge>
                    )}
                    {kitchen.has_shower && (
                      <Badge variant="secondary">Dusche</Badge>
                    )}
                  </div>
                  <Separator />
                  {kitchen.refrigerator_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Kühlschrank</span>
                        <span className="font-semibold">{kitchen.refrigerator_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.heating_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Heizung</span>
                        </div>
                        <span className="font-semibold">{kitchen.heating_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.air_conditioning_type && kitchen.air_conditioning_type !== "Keine" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Klimaanlage</span>
                      <span className="font-semibold">{kitchen.air_conditioning_type}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {kitchen.water_tank_liters && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Frischwasser</span>
                        <span className="font-semibold">{kitchen.water_tank_liters}L</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {kitchen.grey_water_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Grauwasser</span>
                      <span className="font-semibold">{kitchen.grey_water_capacity_liters}L</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-6 mt-6">
              {(kitchen.has_solar || kitchen.has_inverter || kitchen.battery_capacity_ah) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Energie & Elektrik</p>
                  <div className="flex flex-wrap gap-2">
                    {kitchen.has_solar && (
                      <Badge variant="secondary" className="gap-1">
                        <Sun className="w-3 h-3" />
                        Solar {kitchen.solar_power_watts && `(${kitchen.solar_power_watts}W)`}
                      </Badge>
                    )}
                    {kitchen.has_inverter && (
                      <Badge variant="secondary" className="gap-1">
                        <Battery className="w-3 h-3" />
                        Wechselrichter
                      </Badge>
                    )}
                    {kitchen.battery_capacity_ah && (
                      <Badge variant="secondary">
                        Batterie {kitchen.battery_capacity_ah}Ah
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {(kitchen.has_awning || kitchen.has_bike_rack || kitchen.has_garage) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Außenausstattung</p>
                  <div className="flex flex-wrap gap-2">
                    {kitchen.has_awning && (
                      <Badge variant="secondary" className="gap-1">
                        <Wind className="w-3 h-3" />
                        Markise {kitchen.awning_length_m && `(${kitchen.awning_length_m}cm)`}
                      </Badge>
                    )}
                    {kitchen.has_bike_rack && (
                      <Badge variant="secondary" className="gap-1">
                        <Bike className="w-3 h-3" />
                        Fahrradträger
                      </Badge>
                    )}
                    {kitchen.has_garage && (
                      <Badge variant="secondary">Garage</Badge>
                    )}
                  </div>
                </div>
              )}

              {(kitchen.has_tv || kitchen.has_backup_camera || kitchen.has_parking_sensors || kitchen.has_cruise_control || kitchen.has_central_locking) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Komfort & Sicherheit</p>
                  <div className="flex flex-wrap gap-2">
                    {kitchen.has_tv && (
                      <Badge variant="secondary" className="gap-1">
                        <Tv className="w-3 h-3" />
                        TV/SAT
                      </Badge>
                    )}
                    {kitchen.has_backup_camera && (
                      <Badge variant="secondary" className="gap-1">
                        <Camera className="w-3 h-3" />
                        Rückfahrkamera
                      </Badge>
                    )}
                    {kitchen.has_parking_sensors && (
                      <Badge variant="secondary" className="gap-1">
                        <Radio className="w-3 h-3" />
                        Parksensoren
                      </Badge>
                    )}
                    {kitchen.has_cruise_control && (
                      <Badge variant="secondary">Tempomat</Badge>
                    )}
                    {kitchen.has_central_locking && (
                      <Badge variant="secondary">Zentralverriegelung</Badge>
                    )}
                  </div>
                </div>
              )}

              {kitchen.additional_equipment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Zusätzliche Ausstattung</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{kitchen.additional_equipment}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sale Information */}
      {(kitchen.instant_price || kitchen.reserve_price) && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <CardTitle>Verkaufsinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kitchen.instant_price && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sofortkauf-Preis</span>
                  <span className="font-semibold text-xl">
                    €{Number(kitchen.instant_price).toLocaleString()}
                  </span>
                </div>
                <Separator />
              </>
            )}
            {kitchen.reserve_price && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mindestpreis</span>
                <span className="font-semibold text-lg">
                  €{Number(kitchen.reserve_price).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Marketing-Phasen-Card (Verkäufer-Only, aktive/kaufchance-Auktionen) */}
      {isSeller && resolvedAuction && ['active', 'kaufchance'].includes(resolvedAuction.status as string) && (
        <MarketingPhaseCard
          auction={resolvedAuction}
          kitchen={kitchen}
          isFestpreis={isFestpreisListing}
          sellerInitialReserve={
            marketingAnchors?.sellerInitialReserve != null
              ? Number(marketingAnchors.sellerInitialReserve)
              : null
          }
          sellerInitialInstantPrice={
            marketingAnchors?.sellerInitialInstantPrice != null
              ? Number(marketingAnchors.sellerInitialInstantPrice)
              : null
          }
          dynamicPricingPending={toggleDynamicPricingMutation.isPending}
          showDynamicPricingOptOut={showDynamicPricingOptOut}
          onShowDynamicPricingOptOut={setShowDynamicPricingOptOut}
          onToggleDynamicPricing={(v) => toggleDynamicPricingMutation.mutate(v)}
        />
      )}

      {/* Kaufchancen-/Preisvorschlag-Sektion */}
      {(auction?.status === 'kaufchance' || (isFestpreisListing && auction?.status === 'active')) && (
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
                  <p className="text-lg font-bold text-yellow-600">{Number(kitchen.instant_price || 0).toLocaleString('de-DE')} €</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Letztes Auktionsgebot</p>
                  <p className="text-lg font-bold">{Number(auction.current_bid || 0).toLocaleString('de-DE')} €</p>
                </div>
              )}
              {!isFestpreisListing && kitchen.reserve_price && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center">
                  <p className="text-xs text-muted-foreground">Ihr Mindestpreis</p>
                  <p className="text-lg font-bold text-amber-600">{Number(kitchen.reserve_price).toLocaleString('de-DE')} €</p>
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

            {/* Auto-Relist / Auto-Verlängerung Info & Opt-out
                Auktion (Kaufchance): wird nach Kaufchance-Ende erneut versteigert
                Festpreis (active):   wird nach Ablauf automatisch um 7 Tage verlängert */}
            {isSeller && (
              <div className={`p-4 rounded-lg border ${auction.auto_relist !== false ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800' : 'bg-muted/50 border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCw className="w-4 h-4 text-teal-600" />
                      <p className="font-medium text-sm">
                        {isFestpreisListing
                          ? `Automatische Verlängerung (alle 7 Tage) ${auction.auto_relist !== false ? 'aktiv' : 'deaktiviert'}`
                          : `Automatische Wiedereinstellung ${auction.auto_relist !== false ? 'aktiv' : 'deaktiviert'}`}
                      </p>
                      {(auction.auction_round ?? 1) > 1 && (
                        <Badge variant="outline" className="text-xs">Runde {auction.auction_round}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {auction.auto_relist !== false
                        ? (isFestpreisListing
                            ? 'Wird Ihr Festpreis-Inserat nicht innerhalb von 7 Tagen verkauft, wird es automatisch um weitere 7 Tage verlängert. Bestehende Preisvorschläge bleiben dabei aktiv.'
                            : 'Wird keine Einigung erzielt, wird Ihr Fahrzeug automatisch erneut versteigert (gem. AGB §6).')
                        : (isFestpreisListing
                            ? 'Ihr Festpreis-Inserat wird nach Ablauf nicht mehr automatisch verlängert.'
                            : 'Ihr Fahrzeug wird nach Ablauf der Kaufchance nicht erneut eingestellt.')}
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
                          {isFestpreisListing
                            ? 'Ihr Festpreis-Inserat wird nach Ablauf nicht mehr verlängert. Sicher?'
                            : 'Ihr Fahrzeug wird nach Ablauf nicht mehr automatisch versteigert. Sicher?'}
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
                Wenn kein passendes Angebot dabei ist, kann Ihre Küche erneut in eine Auktion gegeben werden.
                Bitte kontaktieren Sie uns unter <strong>{BRAND.supportEmail}</strong> oder warten Sie, bis unser Team sich bei Ihnen meldet.
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
                    <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
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

      {/* ── Soft-Brake / Reaktivierungs-Dialoge (Phase 6) ─────────────────── */}
      {isSeller && id && kitchen && (
        <>
          <RestartListingDialog
            open={showRestartDialog}
            onOpenChange={setShowRestartDialog}
            kitchenId={id}
            kitchenName={`${kitchen.manufacturer} ${kitchen.model}`}
            saleChannel={kitchen.sale_channel}
            currentReservePrice={kitchen.reserve_price != null ? Number(kitchen.reserve_price) : null}
            currentInstantPrice={kitchen.instant_price != null ? Number(kitchen.instant_price) : null}
          />
          <AdjustPriceRestartDialog
            open={showAdjustPriceDialog}
            onOpenChange={setShowAdjustPriceDialog}
            kitchenId={id}
            kitchenName={`${kitchen.manufacturer} ${kitchen.model}`}
            saleChannel={kitchen.sale_channel}
            currentReservePrice={kitchen.reserve_price != null ? Number(kitchen.reserve_price) : null}
            currentInstantPrice={kitchen.instant_price != null ? Number(kitchen.instant_price) : null}
            previousAuctionRound={auction?.auction_round != null ? Number(auction.auction_round) : null}
          />
          <ArchiveListingDialog
            open={showArchiveDialog}
            onOpenChange={setShowArchiveDialog}
            kitchenId={id}
            kitchenName={`${kitchen.manufacturer} ${kitchen.model}`}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Marketing-Phasen-Card (P4.1): Verkäufer sieht aktuelle Phase, Hard-Cap,
// Preissenkungs-Hinweis und kann dynamic_pricing toggeln.
// Zeigt KEINE konkrete Senkungs-Zahl ("Mindestpreis wurde gesenkt" only).
// Floor-Aufklärung via computeReserveFloor (max -6 % Auktion / -10 % Festpreis).
// ─────────────────────────────────────────────────────────────────────
interface MarketingPhaseCardProps {
  auction: any;
  kitchen: any;
  isFestpreis: boolean;
  /** Original-Reserve vom Verkäufer (RPC-Call, da column-REVOKE auf auctions.seller_initial_reserve). */
  sellerInitialReserve: number | null;
  /** Original-Festpreis vom Verkäufer (RPC-Call). */
  sellerInitialInstantPrice: number | null;
  dynamicPricingPending: boolean;
  showDynamicPricingOptOut: boolean;
  onShowDynamicPricingOptOut: (v: boolean) => void;
  onToggleDynamicPricing: (v: boolean) => void;
}

function MarketingPhaseCard({
  auction,
  kitchen,
  isFestpreis,
  sellerInitialReserve,
  sellerInitialInstantPrice,
  dynamicPricingPending,
  showDynamicPricingOptOut,
  onShowDynamicPricingOptOut,
  onToggleDynamicPricing,
}: MarketingPhaseCardProps) {
  const channel: 'auction' | 'instant_price' = isFestpreis ? 'instant_price' : 'auction';
  // Anker-Preis: bevorzugt aus RPC, Fallback (Bestand-Inserate ohne Anker) auf
  // kitchens.instant_price / kitchens.reserve_price.
  const sellerInitial: number | null = isFestpreis
    ? (sellerInitialInstantPrice ?? kitchen.instant_price ?? null)
    : (sellerInitialReserve ?? auction.reserve_price ?? kitchen.reserve_price ?? null);

  const round = auction.auction_round ?? 1;
  const dynamicPricing = auction.dynamic_pricing !== false;
  const lastReductionAt = auction.last_price_reduction_at as string | null;
  const wasReduced = !!lastReductionAt;
  const maxUntil = auction.marketing_phase_max_until as string | null;

  const floor = sellerInitial && sellerInitial > 0
    ? computeReserveFloor(Number(sellerInitial), channel)
    : null;

  // Restzeit bis Hard-Cap. Bei Bestand-Inseraten ohne marketing_phase_max_until
  // wird es trotzdem schön gerendert (kein Crash).
  const maxUntilDate = maxUntil ? new Date(maxUntil) : null;
  const isNearCap = maxUntilDate
    ? maxUntilDate.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
    : false;

  // Ist diese Auktion überhaupt im neuen System? (Bestand erkennt man am
  // fehlenden seller_initial_reserve)
  const isLegacy = sellerInitial == null;

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
          Verkaufsphase
          {round > 1 && !isFestpreis && (
            <Badge variant="outline" className="text-xs">Runde {round} / {MARKETING_CONFIG.AUCTION_MAX_ROUNDS}</Badge>
          )}
          {isFestpreis && round > 1 && (
            <Badge variant="outline" className="text-xs">Verlängerung {round - 1}</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {isFestpreis
            ? `Festpreis-Inserat: ${MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS} Tage Laufzeit, automatische Verlängerung bis max. ${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tage Vermarktungsphase (gem. AGB §6).`
            : `Auktion: ${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage Auktion + ${MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS} h Kaufchance pro Runde, max. ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden Vermarktungsphase (gem. AGB §6).`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hard-Cap-Countdown */}
        {maxUntilDate && (
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isNearCap ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-card border border-border'}`}>
            <Hourglass className={`w-4 h-4 ${isNearCap ? 'text-amber-600' : 'text-muted-foreground'} flex-shrink-0`} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Vermarktungsphase endet</p>
              <p className="font-semibold text-sm">
                {format(maxUntilDate, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                {' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({formatDistanceToNowStrict(maxUntilDate, { addSuffix: true, locale: de })})
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Mindestpreis wurde gesenkt - OHNE konkrete Zahl */}
        {wasReduced && !isFestpreis && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Mindestpreis wurde gesenkt</p>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                Im Rahmen der automatischen Marktanpassung wurde Ihr Mindestpreis reduziert
                (zuletzt {lastReductionAt ? format(new Date(lastReductionAt), 'dd.MM.yyyy', { locale: de }) : '–'}).
                Die Senkung greift erst bei der nächsten Auktionsrunde.
              </p>
            </div>
          </div>
        )}

        {wasReduced && isFestpreis && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Festpreis wurde gesenkt</p>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                Im Rahmen der automatischen Marktanpassung wurde Ihr Festpreis reduziert
                (zuletzt {lastReductionAt ? format(new Date(lastReductionAt), 'dd.MM.yyyy', { locale: de }) : '–'}).
              </p>
            </div>
          </div>
        )}

        {/* dynamic_pricing Toggle */}
        <div className={`p-4 rounded-lg border ${dynamicPricing ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800' : 'bg-muted/40 border-border'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-teal-600" />
                <p className="font-medium text-sm">
                  Automatische Preissenkung {dynamicPricing ? 'aktiv' : 'deaktiviert'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {dynamicPricing
                  ? (isFestpreis
                      ? `Ihr Festpreis wird in jeder Verlängerungsrunde automatisch um ${(MARKETING_CONFIG.INSTANT_PRICE_REDUCTION_PER_ROUND * 100).toFixed(0)} % reduziert, bis max. ${(MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_REDUCTION * 100).toFixed(0)} % unter Ihrem Startpreis. Damit erhöhen wir Ihre Verkaufschance.`
                      : `Ihr Mindestpreis wird ab Runde 2 automatisch um ${(MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND * 100).toFixed(0)} % pro Runde reduziert, bis max. ${(MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION * 100).toFixed(0)} % unter Ihrem Startpreis. Damit erhöhen wir Ihre Verkaufschance.`)
                  : (isFestpreis
                      ? 'Ihr Festpreis bleibt in folgenden Verlängerungen unverändert.'
                      : 'Ihr Mindestpreis bleibt in allen folgenden Runden unverändert.')}
              </p>
              {floor != null && dynamicPricing && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  Niedrigster automatischer {isFestpreis ? 'Festpreis' : 'Mindestpreis'}:{' '}
                  <span className="font-semibold">€{floor.toLocaleString('de-DE')}</span>
                  <span className="text-muted-foreground">— darunter geht es niemals automatisch.</span>
                </p>
              )}
              {isLegacy && (
                <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5" />
                  <span>Bestand-Inserat (vor Einführung der neuen Vermarktungsphase erstellt). Die automatische Preissenkung ist hier nicht aktiv.</span>
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {!showDynamicPricingOptOut ? (
                <Button
                  variant={dynamicPricing ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => {
                    if (dynamicPricing) {
                      onShowDynamicPricingOptOut(true);
                    } else {
                      onToggleDynamicPricing(true);
                    }
                  }}
                  disabled={dynamicPricingPending || isLegacy}
                >
                  {dynamicPricing ? 'Deaktivieren' : 'Aktivieren'}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 items-end">
                  <p className="text-xs text-destructive font-medium text-right max-w-[220px]">
                    {isFestpreis
                      ? 'Ihr Festpreis wird in folgenden Verlängerungen nicht mehr automatisch gesenkt. Sicher?'
                      : 'Ihr Mindestpreis wird in folgenden Runden nicht mehr automatisch gesenkt. Sicher?'}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onShowDynamicPricingOptOut(false)}>Abbrechen</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onToggleDynamicPricing(false)}
                      disabled={dynamicPricingPending}
                    >
                      {dynamicPricingPending ? 'Wird gespeichert...' : 'Ja, deaktivieren'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
