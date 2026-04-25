import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { de } from "date-fns/locale";
import {
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Euro,
  Gavel,
  Trash2,
  Loader2,
  RefreshCw,
  HandshakeIcon,
  Timer,
  AlertTriangle,
  MessageSquare,
  User,
  Plus,
  Send,
  ExternalLink,
  CalendarPlus,
  Ban,
  RotateCcw,
  History,
  TrendingUp,
  Shield,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Phone,
  Car,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PostAuctionOffer {
  id: string;
  auction_id: string;
  buyer_id: string;
  offer_amount: number;
  message: string | null;
  status: string;
  seller_response: string | null;
  responded_at: string | null;
  created_at: string;
  expires_at: string | null;
  counter_offer_amount: number | null;
}

interface AuctionInfo {
  id: string;
  motorhome_id: string | null;
  status: string | null;
  current_bid: number | null;
  kaufchance_expires_at: string | null;
  kaufchance_min_price: number | null;
  reserve_price: number | null;
  starting_bid: number | null;
  end_time: string | null;
  auction_round: number;
  auto_relist: boolean;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    seller_id: string;
    reserve_price: number | null;
    year: number | null;
    sale_channel?: string | null;
    instant_price?: number | null;
    listing_number?: string | null;
    photos?: Array<{ url: string; card_url: string | null; display_order: number }> | null;
  } | null;
}

interface ProfileInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  customer_number: string | null;
  phone: string | null;
}

interface BidInfo {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
  is_autobid: boolean;
}

interface KaufchanceInvitation {
  id: string;
  auction_id: string;
  bidder_id: string;
  highest_bid: number;
  rank: number;
  invited_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Liefert das Titelbild (niedrigste display_order) einer Wohnmobil-Fotos-Liste.
 * Supabase-Relation kann als Array, Objekt oder null zurückkommen.
 */
function firstPhotoUrl(motorhome: AuctionInfo["motorhome"] | null | undefined): string | null {
  if (!motorhome) return null;
  const raw = motorhome.photos;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (arr.length === 0) return null;
  const first = [...arr].sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))[0];
  return first?.card_url || first?.url || null;
}

/**
 * Kleines klickbares Fahrzeug-Thumbnail das zu /admin/auctions/{id} führt.
 * Fallback: Car-Icon wenn kein Foto vorhanden. Verwendet stopPropagation,
 * damit übergeordnete onClick-Handler (Detail-Dialog, Zeilen-Klick) nicht auslösen.
 */
function MotorhomeThumb({
  auctionId,
  motorhome,
  size = "md",
  className = "",
}: {
  auctionId: string;
  motorhome: AuctionInfo["motorhome"] | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const photo = firstPhotoUrl(motorhome);
  const alt = motorhome ? `${motorhome.manufacturer ?? ""} ${motorhome.model ?? ""}`.trim() : "Fahrzeug";
  const dims =
    size === "sm" ? "w-12 h-9" : size === "lg" ? "w-20 h-16" : "w-16 h-12";
  return (
    <Link
      to={`/admin/auctions/${auctionId}`}
      onClick={(e) => e.stopPropagation()}
      className={`block flex-shrink-0 ${dims} rounded overflow-hidden bg-muted border hover:border-primary/50 hover:shadow-sm transition-all ${className}`}
      title="Zur Auktion öffnen"
    >
      {photo ? (
        <img
          src={photo}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Car className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </Link>
  );
}

function OfferStatusBadge({ status, expiresAt }: { status: string; expiresAt: string | null }) {
  const isExpired = expiresAt && isPast(new Date(expiresAt)) && status === "pending";

  if (isExpired) {
    return <Badge variant="outline" className="text-muted-foreground">Abgelaufen</Badge>;
  }

  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500 text-white">Ausstehend</Badge>;
    case "accepted":
      return <Badge className="bg-green-500 text-white">Angenommen</Badge>;
    case "rejected":
      return <Badge variant="destructive">Abgelehnt</Badge>;
    case "countered":
      return <Badge className="bg-blue-500 text-white">Gegenangebot</Badge>;
    case "withdrawn":
      return <Badge variant="outline" className="text-muted-foreground">Zurückgezogen</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function StatCard({ title, value, icon: Icon, description, color }: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color} text-white`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminPostAuctionOffers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOffer, setSelectedOffer] = useState<PostAuctionOffer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  // Kaufchance Detail Dialog state
  const [kaufchanceDetailOpen, setKaufchanceDetailOpen] = useState(false);
  const [selectedKaufchanceAuction, setSelectedKaufchanceAuction] = useState<AuctionInfo | null>(null);
  const [kaufchanceBids, setKaufchanceBids] = useState<BidInfo[]>([]);
  const [kaufchanceInvitations, setKaufchanceInvitations] = useState<KaufchanceInvitation[]>([]);
  const [kaufchanceAllOffers, setKaufchanceAllOffers] = useState<PostAuctionOffer[]>([]);
  const [kaufchanceDetailLoading, setKaufchanceDetailLoading] = useState(false);
  const [showAllBids, setShowAllBids] = useState(false);

  // Admin action state
  const [adminCounterAmount, setAdminCounterAmount] = useState("");
  const [adminCounterMessage, setAdminCounterMessage] = useState("");
  const [adminMinPriceInputs, setAdminMinPriceInputs] = useState<Record<string, string>>({});
  const [savingMinPrice, setSavingMinPrice] = useState<string | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [endingKaufchance, setEndingKaufchance] = useState<string | null>(null);
  const [endKaufchanceConfirm, setEndKaufchanceConfirm] = useState<{ auctionId: string; vehicleName: string } | null>(null);
  const [extendingKaufchance, setExtendingKaufchance] = useState<string | null>(null);
  const [backToAuctionLoading, setBackToAuctionLoading] = useState<string | null>(null);
  const [backToAuctionDialogOpen, setBackToAuctionDialogOpen] = useState(false);
  const [backToAuctionAuctionId, setBackToAuctionAuctionId] = useState<string | null>(null);
  const [backToAuctionReservePrice, setBackToAuctionReservePrice] = useState("");
  const [backToAuctionVehicleName, setBackToAuctionVehicleName] = useState("");
  const [backToAuctionLowestOffer, setBackToAuctionLowestOffer] = useState<number | null>(null);

  // Admin: Angebot im Namen des Händlers erstellen
  const [adminOfferDealerId, setAdminOfferDealerId] = useState("");
  const [adminOfferAmount, setAdminOfferAmount] = useState("");
  const [adminOfferMessage, setAdminOfferMessage] = useState("");
  const [adminOfferLoading, setAdminOfferLoading] = useState(false);

  // Admin: Im Namen des Verkäufers handeln
  const [sellerActionCounterAmount, setSellerActionCounterAmount] = useState("");
  const [sellerActionMessage, setSellerActionMessage] = useState("");
  const [sellerActionLoading, setSellerActionLoading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["adminPostAuctionOffers"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("post_auction_offers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PostAuctionOffer[];
    },
    refetchInterval: 90000,
    staleTime: 45000,
  });

  const { data: auctionMap = {} } = useQuery({
    queryKey: ["adminOfferAuctions", offers.map(o => o.auction_id)],
    queryFn: async () => {
      const auctionIds = [...new Set(offers.map(o => o.auction_id).filter(Boolean))];
      if (auctionIds.length === 0) return {};
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id, motorhome_id, status, current_bid, starting_bid, end_time,
          kaufchance_expires_at, kaufchance_min_price, reserve_price,
          auction_round,
          motorhome:motorhomes (
            id, manufacturer, model, seller_id, reserve_price, year,
            sale_channel, instant_price, listing_number,
            photos:motorhome_photos (url, card_url, display_order)
          )
        `)
        .in("id", auctionIds);
      if (error) throw error;
      // P4-Hardening: auto_relist via bulk-RPC nachladen (column-REVOKE).
      const { data: metaRows } = await supabase.rpc(
        "get_auctions_owner_meta_bulk",
        { p_auction_ids: auctionIds },
      );
      const autoRelistByAuction = new Map<string, boolean | null>();
      for (const row of (metaRows || []) as Array<{ auction_id: string; auto_relist: boolean | null }>) {
        autoRelistByAuction.set(row.auction_id, row.auto_relist);
      }
      const map: Record<string, AuctionInfo> = {};
      (data || []).forEach((a: any) => {
        a.auto_relist = autoRelistByAuction.get(a.id) ?? null;
        map[a.id] = a;
      });
      return map;
    },
    enabled: offers.length > 0,
  });

  // Load kaufchance auctions AND active Festpreis listings with offers
  const { data: kaufchanceAuctions = [] } = useQuery({
    queryKey: ["adminKaufchanceAuctions"],
    queryFn: async () => {
      // Kaufchance auctions
      const { data: kcData, error: kcErr } = await supabase
        .from("auctions")
        .select(`
          id, motorhome_id, status, current_bid, starting_bid, end_time,
          kaufchance_expires_at, kaufchance_min_price, reserve_price,
          auction_round,
          motorhome:motorhomes (
            id, manufacturer, model, seller_id, reserve_price, year,
            sale_channel, instant_price, listing_number,
            photos:motorhome_photos (url, card_url, display_order)
          )
        `)
        .eq("status", "kaufchance")
        .order("kaufchance_expires_at", { ascending: true });
      if (kcErr) throw kcErr;

      // Active Festpreis listings that have pending/countered offers
      const { data: fpOffers } = await supabase
        .from("post_auction_offers")
        .select("auction_id")
        .in("status", ["pending", "countered"]);

      const fpAuctionIds = [...new Set((fpOffers || []).map(o => o.auction_id))];
      let fpAuctions: AuctionInfo[] = [];
      if (fpAuctionIds.length > 0) {
        const { data: fpData } = await supabase
          .from("auctions")
          .select(`
            id, motorhome_id, status, current_bid, starting_bid, end_time,
            kaufchance_expires_at, kaufchance_min_price, reserve_price,
            auction_round,
            motorhome:motorhomes (
              id, manufacturer, model, seller_id, reserve_price, year,
              sale_channel, instant_price, listing_number,
              photos:motorhome_photos (url, card_url, display_order)
            )
          `)
          .eq("status", "active")
          .in("id", fpAuctionIds);
        fpAuctions = ((fpData || []) as any[]).filter(a => {
          const mh = Array.isArray(a.motorhome) ? a.motorhome[0] : a.motorhome;
          return mh?.sale_channel === 'instant_price';
        }) as AuctionInfo[];
      }

      // Merge, deduplicate by id
      const merged = [...(kcData || []), ...fpAuctions];
      const seen = new Set<string>();
      const dedup = merged.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

      // P4-Hardening: auto_relist via bulk-RPC nachladen (column-REVOKE).
      const ids = dedup.map(a => a.id).filter(Boolean) as string[];
      if (ids.length > 0) {
        const { data: metaRows } = await supabase.rpc(
          "get_auctions_owner_meta_bulk",
          { p_auction_ids: ids },
        );
        const autoRelistByAuction = new Map<string, boolean | null>();
        for (const row of (metaRows || []) as Array<{ auction_id: string; auto_relist: boolean | null }>) {
          autoRelistByAuction.set(row.auction_id, row.auto_relist);
        }
        for (const a of dedup) {
          (a as any).auto_relist = autoRelistByAuction.get(a.id) ?? null;
        }
      }
      return dedup as AuctionInfo[];
    },
    refetchInterval: 90000,
    staleTime: 45000,
  });

  // Collect all profile IDs we need (stable dependency for queryKey)
  const allProfileIds = useMemo(() => {
    const ids = new Set<string>();
    offers.forEach(o => {
      if (o.buyer_id) ids.add(o.buyer_id);
    });
    Object.values(auctionMap).forEach((a: AuctionInfo) => {
      if (a.motorhome?.seller_id) ids.add(a.motorhome.seller_id);
    });
    kaufchanceAuctions.forEach((a: any) => {
      if (a.motorhome?.seller_id) ids.add(a.motorhome.seller_id);
    });
    return Array.from(ids).sort();
  }, [offers, auctionMap, kaufchanceAuctions]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["adminOfferProfiles", allProfileIds],
    queryFn: async () => {
      if (allProfileIds.length === 0) return {};

      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return {};

      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_name, email, customer_number, phone")
        .in("id", allProfileIds);
      const map: Record<string, ProfileInfo> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: allProfileIds.length > 0,
  });

  // ---- Statistics ----

  const stats = useMemo(() => {
    const total = offers.length;
    const pending = offers.filter(o => o.status === "pending" && (!o.expires_at || !isPast(new Date(o.expires_at)))).length;
    const accepted = offers.filter(o => o.status === "accepted").length;
    const rejected = offers.filter(o => o.status === "rejected").length;
    const expired = offers.filter(o => o.status === "pending" && o.expires_at && isPast(new Date(o.expires_at))).length;
    const countered = offers.filter(o => o.status === "countered").length;
    const totalOfferValue = offers.reduce((sum, o) => sum + (o.offer_amount || 0), 0);
    const avgOffer = total > 0 ? Math.round(totalOfferValue / total) : 0;
    const activeKaufchancen = kaufchanceAuctions.length;

    return { total, pending, accepted, rejected, expired, countered, totalOfferValue, avgOffer, activeKaufchancen };
  }, [offers, kaufchanceAuctions]);

  // ---- Filtering ----

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (statusFilter !== "all") {
        if (statusFilter === "expired") {
          if (!(offer.status === "pending" && offer.expires_at && isPast(new Date(offer.expires_at)))) return false;
        } else if (offer.status !== statusFilter) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const buyer = profileMap[offer.buyer_id];
        const auction = auctionMap[offer.auction_id];
        const buyerName = buyer
          ? `${buyer.first_name || ""} ${buyer.last_name || ""} ${buyer.company_name || ""} ${buyer.email || ""}`.toLowerCase()
          : "";
        const vehicleName = auction?.motorhome
          ? `${auction.motorhome.manufacturer} ${auction.motorhome.model}`.toLowerCase()
          : "";
        return (
          buyerName.includes(q) ||
          vehicleName.includes(q) ||
          offer.offer_amount.toString().includes(q) ||
          (offer.message || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [offers, statusFilter, searchQuery, profileMap, auctionMap]);

  // ---- Mutations ----

  const deleteOffers = useMutation({
    mutationFn: async (ids: string[]) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");
      const { error } = await supabase
        .from("post_auction_offers")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({ title: `${ids.length} Angebot${ids.length > 1 ? "e" : ""} gelöscht` });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  // ---- Load Kaufchance Detail Data ----

  const loadKaufchanceDetail = useCallback(async (auction: AuctionInfo) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setKaufchanceDetailLoading(true);
    setSelectedKaufchanceAuction(auction);
    setKaufchanceDetailOpen(true);
    setShowAllBids(false);
    setAdminOfferDealerId("");
    setAdminOfferAmount("");
    setAdminOfferMessage("");

    try {
      // Load all bids for this auction
      const { data: bidsData, error: bidsErr } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auction.id)
        .order("created_at", { ascending: false });
      if (bidsErr) throw bidsErr;

      setKaufchanceBids((bidsData || []) as BidInfo[]);

      // Load kaufchance invitations
      const { data: invData, error: invErr } = await supabase
        .from("kaufchance_invitations")
        .select("*")
        .eq("auction_id", auction.id)
        .order("rank", { ascending: true });
      if (invErr) throw invErr;

      setKaufchanceInvitations((invData || []) as KaufchanceInvitation[]);

      // Load all post-auction offers for this auction
      const { data: offersData, error: offersErr } = await supabase
        .from("post_auction_offers")
        .select("*")
        .eq("auction_id", auction.id)
        .order("created_at", { ascending: false });
      if (offersErr) throw offersErr;

      setKaufchanceAllOffers((offersData || []) as PostAuctionOffer[]);

      // Load profiles for bidders and offer buyers
      const newProfileIds = new Set<string>();
      (bidsData || []).forEach((b: any) => { if (b.bidder_id) newProfileIds.add(b.bidder_id); });
      (invData || []).forEach((i: any) => { if (i.bidder_id) newProfileIds.add(i.bidder_id); });
      (offersData || []).forEach((o: any) => { if (o.buyer_id) newProfileIds.add(o.buyer_id); });

      // Filter out already loaded profiles
      const missingIds = Array.from(newProfileIds).filter(id => !profileMap[id]);
      if (missingIds.length > 0) {
        const { data: newProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_name, email, customer_number, phone")
          .in("id", missingIds);

        if (newProfiles && newProfiles.length > 0) {
          // Merge new profiles directly into the cache so they are immediately available
          queryClient.setQueryData<Record<string, ProfileInfo>>(
            ["adminOfferProfiles", allProfileIds],
            (old) => {
              const merged = { ...(old || {}) };
              newProfiles.forEach((p: any) => { merged[p.id] = p; });
              return merged;
            }
          );
        }
      }
    } catch (err) {
      console.error("Error loading kaufchance detail:", err);
      toast({ title: "Fehler", description: "Details konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setKaufchanceDetailLoading(false);
    }
  }, [profileMap, queryClient, toast, allProfileIds]);

  // ---- Admin Actions ----

  const handleAdminAcceptOffer = async (offerId: string) => {
    setAdminActionLoading(true);
    try {
      const { data, error } = await invokeWithAuth('accept-kaufchance-offer', {
        body: { offerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');

      toast({ title: 'Angebot angenommen', description: 'Kaufvertrag wird erstellt.' });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      setDetailDialogOpen(false);
      setKaufchanceDetailOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminRejectOffer = async (offerId: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setAdminActionLoading(true);
    try {
      // Lade Offer-Daten vor dem Update für die Benachrichtigung
      const { data: offerData } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount, auction_id')
        .eq('id', offerId)
        .single();

      const { error } = await supabase
        .from('post_auction_offers')
        .update({ status: 'rejected', seller_response: 'Abgelehnt durch Admin', updated_at: new Date().toISOString() })
        .eq('id', offerId);
      if (error) throw error;

      // Käufer benachrichtigen via Edge Function
      let notifyFailed = false;
      if (offerData) {
        try {
          const { error: notifyErr } = await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'offer_rejected',
              auctionId: offerData.auction_id,
              buyerId: offerData.buyer_id,
              offerAmount: Number(offerData.offer_amount),
              sellerResponse: 'Abgelehnt durch Admin',
            },
          });
          if (notifyErr) throw notifyErr;
        } catch (notifyErr) {
          console.error('Failed to send rejection notification:', notifyErr);
          notifyFailed = true;
        }
      }

      toast({ title: 'Angebot abgelehnt', description: notifyFailed ? 'Angebot abgelehnt, aber E-Mail-Benachrichtigung fehlgeschlagen.' : 'Der Käufer wurde per E-Mail benachrichtigt.' });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      // Reload detail if open
      if (selectedKaufchanceAuction) {
        loadKaufchanceDetail(selectedKaufchanceAuction);
      }
      setDetailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminCounterOffer = async (offerId: string) => {
    const amount = parseFloat(adminCounterAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte gültigen Betrag eingeben.', variant: 'destructive' });
      return;
    }
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setAdminActionLoading(true);
    try {
      // Lade Offer-Daten vor dem Update für die Benachrichtigung
      const { data: offerData } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount, auction_id')
        .eq('id', offerId)
        .single();

      const { error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'countered',
          counter_offer_amount: amount,
          seller_response: adminCounterMessage || `Gegenangebot: ${amount.toLocaleString('de-DE')} \u20ac`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId);
      if (error) throw error;

      // Käufer benachrichtigen via Edge Function
      let counterNotifyFailed = false;
      if (offerData) {
        try {
          const { error: notifyErr } = await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'counter_offer',
              auctionId: offerData.auction_id,
              buyerId: offerData.buyer_id,
              offerAmount: Number(offerData.offer_amount),
              counterAmount: amount,
              sellerResponse: adminCounterMessage || undefined,
            },
          });
          if (notifyErr) throw notifyErr;
        } catch (notifyErr) {
          console.error('Failed to send counter offer notification:', notifyErr);
          counterNotifyFailed = true;
        }
      }

      toast({ title: 'Gegenangebot gesendet', description: counterNotifyFailed ? `${amount.toLocaleString('de-DE')} \u20ac \u2013 E-Mail-Benachrichtigung fehlgeschlagen.` : `${amount.toLocaleString('de-DE')} \u20ac \u2013 K\u00e4ufer wurde per E-Mail benachrichtigt.` });
      setAdminCounterAmount("");
      setAdminCounterMessage("");
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      if (selectedKaufchanceAuction) {
        loadKaufchanceDetail(selectedKaufchanceAuction);
      }
      setDetailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleSaveMinPrice = async (auctionId: string) => {
    const val = adminMinPriceInputs[auctionId];
    const amount = parseFloat(val);
    if (!val || isNaN(amount) || amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte gültigen Betrag eingeben.', variant: 'destructive' });
      return;
    }
    setSavingMinPrice(auctionId);
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ kaufchance_min_price: amount })
        .eq('id', auctionId);
      if (error) throw error;
      toast({ title: 'Mindestgebot gespeichert', description: `${amount.toLocaleString('de-DE')} €` });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminOfferAuctions"] });
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSavingMinPrice(null);
    }
  };

  const handleEndKaufchance = async (auctionId: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setEndingKaufchance(auctionId);
    try {
      const { data, error } = await invokeWithAuth('end-kaufchance', {
        body: { auctionId, mode: 'end_unsold' },
      });
      if (error) throw error;
      const result = data as {
        success?: boolean;
        rejectedOffers?: number;
        deletedInvitations?: number;
        uniqueRecipientsNotified?: number;
        bidderMailsFailed?: number;
        sellerMailSent?: boolean;
        sellerMailError?: string | null;
        error?: string;
      };
      if (result?.error) throw new Error(result.error);

      const parts: string[] = ['Auktion als "nicht verkauft" markiert.'];
      if ((result.rejectedOffers ?? 0) > 0) parts.push(`${result.rejectedOffers} Angebote abgelehnt.`);
      if ((result.deletedInvitations ?? 0) > 0) parts.push(`${result.deletedInvitations} Kaufchance-Einladungen entfernt.`);
      const totalRecipients = (result.uniqueRecipientsNotified ?? 0) + (result.sellerMailSent ? 1 : 0);
      if (totalRecipients > 0) parts.push(`${totalRecipients} E-Mail(s) versendet.`);
      if ((result.bidderMailsFailed ?? 0) > 0 || result.sellerMailError) {
        parts.push('⚠️ Manche E-Mails sind fehlgeschlagen – bitte error_logs prüfen.');
      }
      toast({
        title: 'Kaufchance beendet',
        description: parts.join(' '),
        variant: (result.bidderMailsFailed ?? 0) > 0 || result.sellerMailError ? 'destructive' : 'default',
      });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      setKaufchanceDetailOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setEndingKaufchance(null);
    }
  };

  const handleExtendKaufchance = async (auctionId: string, days: number = 3) => {
    setExtendingKaufchance(auctionId);
    try {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + days);

      const { error } = await supabase
        .from('auctions')
        .update({ kaufchance_expires_at: newExpiry.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', auctionId);
      if (error) throw error;

      toast({ title: 'Frist verlängert', description: `Kaufchance läuft jetzt bis ${newExpiry.toLocaleDateString('de-DE')} ${newExpiry.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setExtendingKaufchance(null);
    }
  };

  // ---- Zurück in Auktion: Dialog öffnen ----
  const openBackToAuctionDialog = async (auctionId: string, vehicleName: string, currentReservePrice: number | null) => {
    setBackToAuctionAuctionId(auctionId);
    setBackToAuctionVehicleName(vehicleName);
    setBackToAuctionLowestOffer(null);
    setBackToAuctionDialogOpen(true);

    // Niedrigstes Verkäufer-Gegenangebot als neuen Reservepreis vorschlagen
    const { data: offers } = await supabase
      .from('post_auction_offers')
      .select('counter_offer_amount')
      .eq('auction_id', auctionId)
      .not('counter_offer_amount', 'is', null)
      .order('counter_offer_amount', { ascending: true })
      .limit(1);

    const lowestSellerOffer = offers?.[0]?.counter_offer_amount;
    if (lowestSellerOffer) {
      setBackToAuctionReservePrice(String(lowestSellerOffer));
      setBackToAuctionLowestOffer(lowestSellerOffer);
    } else {
      setBackToAuctionReservePrice(currentReservePrice ? String(currentReservePrice) : "");
    }
  };

  // ---- Zurück in Auktion: atomic via Edge Function `end-kaufchance` (mode='restart_auction') ----
  // Die Edge-Function setzt die bestehende Auktion auf 'active' zurück (neuer
  // Mindestpreis + neue 7-Tage-Laufzeit), löscht alte Bids/Invitations,
  // lehnt offene Festpreis-Angebote ab UND informiert alle Bieter, Festpreis-
  // Anbieter und Kaufchance-Invitees per E-Mail (sowie den Verkäufer).
  const handleBackToAuction = async () => {
    if (!backToAuctionAuctionId) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    const auctionId = backToAuctionAuctionId;
    setBackToAuctionLoading(auctionId);
    try {
      const newReservePriceParsed = backToAuctionReservePrice ? parseFloat(backToAuctionReservePrice) : NaN;
      const { data, error } = await invokeWithAuth('end-kaufchance', {
        body: {
          auctionId,
          mode: 'restart_auction',
          newReservePrice: !isNaN(newReservePriceParsed) ? newReservePriceParsed : null,
          durationDays: 7,
        },
      });
      if (error) throw error;
      const result = data as {
        success?: boolean;
        rejectedOffers?: number;
        deletedInvitations?: number;
        newEndTime?: string | null;
        uniqueRecipientsNotified?: number;
        bidderMailsFailed?: number;
        sellerMailSent?: boolean;
        sellerMailError?: string | null;
        error?: string;
      };
      if (result?.error) throw new Error(result.error);

      const endTime = result.newEndTime ? new Date(result.newEndTime) : null;
      const parts: string[] = endTime
        ? [`Auktion neu gestartet! Läuft bis ${endTime.toLocaleDateString('de-DE')} ${endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.`]
        : ['Auktion neu gestartet.'];
      if (!isNaN(newReservePriceParsed)) parts.push(`Mindestpreis: ${newReservePriceParsed.toLocaleString('de-DE')} €.`);
      if ((result.rejectedOffers ?? 0) > 0) parts.push(`${result.rejectedOffers} Angebote abgelehnt.`);
      if ((result.deletedInvitations ?? 0) > 0) parts.push(`${result.deletedInvitations} Einladungen entfernt.`);
      const totalRecipients = (result.uniqueRecipientsNotified ?? 0) + (result.sellerMailSent ? 1 : 0);
      if (totalRecipients > 0) parts.push(`${totalRecipients} E-Mail(s) versendet.`);
      if ((result.bidderMailsFailed ?? 0) > 0 || result.sellerMailError) {
        parts.push('⚠️ Manche E-Mails sind fehlgeschlagen – bitte error_logs prüfen.');
      }

      toast({
        title: 'Zurück in Auktion',
        description: parts.join(' '),
        variant: (result.bidderMailsFailed ?? 0) > 0 || result.sellerMailError ? 'destructive' : 'default',
      });

      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      setKaufchanceDetailOpen(false);
      setBackToAuctionDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setBackToAuctionLoading(null);
    }
  };

  // ---- Admin: Angebot im Namen des Händlers erstellen ----
  const handleAdminCreateOffer = async (auctionId: string) => {
    const amount = parseFloat(adminOfferAmount);
    if (!adminOfferDealerId) {
      toast({ title: 'Fehler', description: 'Bitte Händler-ID eingeben.', variant: 'destructive' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte gültigen Betrag eingeben.', variant: 'destructive' });
      return;
    }

    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setAdminOfferLoading(true);
    try {
      // Pre-check: the unique index idx_post_auction_offers_one_active_per_buyer
      // forbids more than one pending/countered offer per (auction_id, buyer_id).
      // Without this guard the INSERT below would fail with a raw Postgres
      // "duplicate key value violates unique constraint" error in the toast.
      const { data: existingOffer, error: existingErr } = await supabase
        .from('post_auction_offers')
        .select('id, status')
        .eq('auction_id', auctionId)
        .eq('buyer_id', adminOfferDealerId)
        .in('status', ['pending', 'countered'])
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existingOffer) {
        toast({
          title: 'Aktives Angebot vorhanden',
          description:
            'Dieser Händler hat bereits ein offenes Angebot auf diese Auktion. Bitte nutzen Sie "Kontern" oder "Ablehnen" statt ein neues Angebot anzulegen.',
          variant: 'destructive',
        });
        setAdminOfferLoading(false);
        return;
      }

      const adminAuction = auctionMap[auctionId];
      const adminOfferExpiresAt = adminAuction?.kaufchance_expires_at ?? null;

      const { error } = await supabase
        .from('post_auction_offers')
        .insert({
          auction_id: auctionId,
          buyer_id: adminOfferDealerId,
          offer_amount: amount,
          message: adminOfferMessage || 'Angebot erstellt durch Admin',
          status: 'pending',
          expires_at: adminOfferExpiresAt,
        });
      if (error) {
        // Race-condition fallback: between our pre-check and insert another
        // offer may have been created. Surface a friendly message instead of
        // the raw Postgres unique-violation text.
        if ((error as { code?: string }).code === '23505') {
          toast({
            title: 'Aktives Angebot vorhanden',
            description:
              'Zwischen Prüfung und Speichern wurde bereits ein Angebot angelegt. Bitte die Liste neu laden.',
            variant: 'destructive',
          });
          setAdminOfferLoading(false);
          return;
        }
        throw error;
      }

      // Verkäufer benachrichtigen via Edge Function
      try {
        await invokeWithAuth('notify-offer-action', {
          body: {
            action: 'admin_offer',
            auctionId,
            buyerId: adminOfferDealerId,
            offerAmount: amount,
            message: adminOfferMessage || undefined,
          },
        });
      } catch (notifyErr) {
        console.error('Failed to send admin offer notification:', notifyErr);
      }

      toast({ title: 'Angebot erstellt', description: `${amount.toLocaleString('de-DE')} \u20ac im Namen des H\u00e4ndlers \u2013 Verk\u00e4ufer wurde per E-Mail benachrichtigt.` });
      setAdminOfferDealerId("");
      setAdminOfferAmount("");
      setAdminOfferMessage("");
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      // Reload detail
      if (selectedKaufchanceAuction) {
        loadKaufchanceDetail(selectedKaufchanceAuction);
      }
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setAdminOfferLoading(false);
    }
  };

  // ---- Admin: Im Namen des Verkäufers alle offenen Angebote ablehnen ----
  const handleAdminRejectAllPending = async (auctionId: string) => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setSellerActionLoading(true);
    try {
      const { data: actionableOffers, error: fetchErr } = await supabase
        .from('post_auction_offers')
        .select('id, buyer_id, offer_amount, auction_id, status')
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (fetchErr) throw fetchErr;
      if (!actionableOffers || actionableOffers.length === 0) {
        toast({ title: 'Hinweis', description: 'Keine offenen Angebote vorhanden.' });
        setSellerActionLoading(false);
        return;
      }

      const offerIds = actionableOffers.map(o => o.id);
      const { error } = await supabase
        .from('post_auction_offers')
        .update({ status: 'rejected', seller_response: sellerActionMessage || 'Abgelehnt durch Admin im Namen des Verkäufers', updated_at: new Date().toISOString() })
        .in('id', offerIds);
      if (error) throw error;

      for (const offer of actionableOffers) {
        try {
          await invokeWithAuth('notify-offer-action', {
            body: {
              action: 'offer_rejected',
              auctionId: offer.auction_id,
              buyerId: offer.buyer_id,
              offerAmount: Number(offer.offer_amount),
              sellerResponse: sellerActionMessage || 'Abgelehnt durch Admin im Namen des Verkäufers',
            },
          });
        } catch (e) {
          console.error('Failed to notify buyer:', e);
        }
      }

      toast({ title: 'Alle Angebote abgelehnt', description: `${actionableOffers.length} Angebot(e) im Namen des Verkäufers abgelehnt.` });
      setSellerActionMessage("");
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      if (selectedKaufchanceAuction) loadKaufchanceDetail(selectedKaufchanceAuction);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSellerActionLoading(false);
    }
  };

  // ---- Admin: Im Namen des Verkäufers Gegenangebot an alle offenen Bieter senden ----
  // Fallback: Wenn keine offenen Angebote, proaktive Preisvorstellung an eingeladene Bieter
  const handleAdminSellerCounterAll = async (auctionId: string) => {
    const amount = parseFloat(sellerActionCounterAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte gültigen Betrag eingeben.', variant: 'destructive' });
      return;
    }
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    setSellerActionLoading(true);
    try {
      const { data: actionableOffers, error: fetchErr } = await supabase
        .from('post_auction_offers')
        .select('id, buyer_id, offer_amount, auction_id, status')
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (fetchErr) throw fetchErr;

      if (!actionableOffers || actionableOffers.length === 0) {
        // Keine offenen Angebote → Proaktive Preisvorstellung an eingeladene Bieter
        const { data: invitations, error: invErr } = await supabase
          .from('kaufchance_invitations')
          .select('bidder_id')
          .eq('auction_id', auctionId);
        if (invErr) throw invErr;

        if (!invitations || invitations.length === 0) {
          toast({ title: 'Hinweis', description: 'Keine eingeladenen Bieter vorhanden.' });
          setSellerActionLoading(false);
          return;
        }

        const proactiveAuction = auctionMap[auctionId];
        const proactiveExpiresAt = proactiveAuction?.kaufchance_expires_at ?? null;
        let createErrors = 0;

        for (const inv of invitations) {
          const { error } = await supabase
            .from('post_auction_offers')
            .insert({
              auction_id: auctionId,
              buyer_id: inv.bidder_id,
              offer_amount: 0,
              counter_offer_amount: amount,
              status: 'countered',
              seller_response: sellerActionMessage || `Preisvorstellung des Verkäufers: ${amount.toLocaleString('de-DE')} €`,
              expires_at: proactiveExpiresAt,
            });
          if (error) {
            console.error('Failed to create proactive counter offer:', error);
            createErrors++;
            continue;
          }

          try {
            await invokeWithAuth('notify-offer-action', {
              body: {
                action: 'counter_offer',
                auctionId,
                buyerId: inv.bidder_id,
                offerAmount: 0,
                counterAmount: amount,
                sellerResponse: sellerActionMessage || `Preisvorstellung des Verkäufers: ${amount.toLocaleString('de-DE')} €`,
              },
            });
          } catch (e) {
            console.error('Failed to notify buyer:', e);
          }
        }

        if (createErrors > 0) {
          toast({ title: 'Teilweise fehlgeschlagen', description: `${invitations.length - createErrors} von ${invitations.length} Preisvorschläge gesendet.`, variant: 'destructive' });
        } else {
          toast({ title: 'Preisvorschläge gesendet', description: `${amount.toLocaleString('de-DE')} € an ${invitations.length} eingeladene Bieter gesendet.` });
        }
      } else {
        // Offene Angebote vorhanden → direkt kontern
        let updateErrors = 0;
        for (const offer of actionableOffers) {
          const { error } = await supabase
            .from('post_auction_offers')
            .update({
              status: 'countered',
              counter_offer_amount: amount,
              seller_response: sellerActionMessage || `Preisvorstellung des Verkäufers: ${amount.toLocaleString('de-DE')} €`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', offer.id);
          if (error) {
            console.error('Failed to counter offer:', error);
            updateErrors++;
            continue;
          }

          try {
            const { error: notifyErr } = await invokeWithAuth('notify-offer-action', {
              body: {
                action: 'counter_offer',
                auctionId: offer.auction_id,
                buyerId: offer.buyer_id,
                offerAmount: Number(offer.offer_amount),
                counterAmount: amount,
                sellerResponse: sellerActionMessage || undefined,
              },
            });
            if (notifyErr) console.error('Failed to notify buyer:', notifyErr);
          } catch (e) {
            console.error('Failed to notify buyer:', e);
          }
        }

        if (updateErrors > 0) {
          toast({ title: 'Teilweise fehlgeschlagen', description: `${actionableOffers.length - updateErrors} von ${actionableOffers.length} Gegenangeboten gesendet.`, variant: 'destructive' });
        } else {
          toast({ title: 'Gegenangebote gesendet', description: `${amount.toLocaleString('de-DE')} € an ${actionableOffers.length} Bieter im Namen des Verkäufers gesendet.` });
        }
      }

      setSellerActionCounterAmount("");
      setSellerActionMessage("");
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      if (selectedKaufchanceAuction) loadKaufchanceDetail(selectedKaufchanceAuction);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSellerActionLoading(false);
    }
  };

  // ---- Handlers ----

  const getProfileName = (id: string) => {
    const p = profileMap[id];
    if (!p) return "Unbekannt";
    if (p.company_name) return p.company_name;
    return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Unbekannt";
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredOffers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOffers.map((o) => o.id)));
    }
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandshakeIcon className="w-6 h-6 text-primary" />
            Kaufchancen & Nachauktions-Angebote
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie Kaufchancen, setzen Sie Mindestgebote und vermitteln Sie zwischen Händlern und Verkäufern
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
            queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Aktive Kaufchancen"
          value={stats.activeKaufchancen}
          icon={Gavel}
          description="Auktionen im Kaufchance-Status"
          color="bg-amber-500"
        />
        <StatCard
          title="Gesamt Angebote"
          value={stats.total}
          icon={HandshakeIcon}
          description={`${stats.countered} Gegenangebote`}
          color="bg-blue-500"
        />
        <StatCard
          title="Ausstehend"
          value={stats.pending}
          icon={Clock}
          description={`${stats.expired} abgelaufen`}
          color="bg-yellow-500"
        />
        <StatCard
          title="Angenommen"
          value={stats.accepted}
          icon={CheckCircle2}
          description={`${stats.rejected} abgelehnt`}
          color="bg-green-500"
        />
        <StatCard
          title="Durchschn. Angebot"
          value={`${stats.avgOffer.toLocaleString("de-DE")} €`}
          icon={Euro}
          description={`${stats.totalOfferValue.toLocaleString("de-DE")} € gesamt`}
          color="bg-purple-500"
        />
      </div>

      {/* ================================================================== */}
      {/* Active Kaufchancen Overview - CLICKABLE */}
      {/* ================================================================== */}
      {kaufchanceAuctions.length > 0 && (
        <Card className="border-2 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Gavel className="w-5 h-5 text-amber-600" />
              Aktive Kaufchancen – Auktionsübersicht
              <Badge variant="outline" className="ml-2">{kaufchanceAuctions.length}</Badge>
            </h2>
            <div className="space-y-4">
              {kaufchanceAuctions.map((auction: AuctionInfo) => {
                const motorhome = auction.motorhome;
                const vehicleName = motorhome
                  ? `${motorhome.manufacturer} ${motorhome.model}`
                  : 'Unbekannt';
                const seller = motorhome?.seller_id ? profileMap[motorhome.seller_id] : null;
                const sellerName = seller
                  ? (seller.company_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'Unbekannt')
                  : 'Unbekannt';
                const auctionOffers = offers.filter(o => o.auction_id === auction.id);
                const pendingOffers = auctionOffers.filter(o => o.status === 'pending');
                const isExpired = auction.kaufchance_expires_at && isPast(new Date(auction.kaufchance_expires_at));
                const effectiveReserve = auction.reserve_price ?? motorhome?.reserve_price ?? null;
                const sortedOffers = [...auctionOffers].sort(
                  (a, b) => Number(b.offer_amount || 0) - Number(a.offer_amount || 0)
                );
                const highestOffer = sortedOffers[0]?.offer_amount ?? null;
                const highestDiff =
                  effectiveReserve !== null && highestOffer !== null
                    ? Number(highestOffer) - Number(effectiveReserve)
                    : null;

                return (
                  <div
                    key={auction.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/40 ${isExpired ? 'bg-muted/50 opacity-70' : 'bg-card'}`}
                    onClick={() => loadKaufchanceDetail(auction)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1 flex gap-3 min-w-0">
                        <MotorhomeThumb auctionId={auction.id} motorhome={motorhome} size="lg" />
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link
                            to={`/admin/auctions/${auction.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold hover:text-primary hover:underline"
                            title="Zur Auktion öffnen"
                          >
                            {vehicleName}
                          </Link>
                          {motorhome?.year && <span className="text-sm text-muted-foreground">({motorhome.year})</span>}
                          {motorhome?.listing_number && (
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                              #{motorhome.listing_number}
                            </span>
                          )}
                          {isExpired ? (
                            <Badge variant="outline" className="text-destructive border-destructive">Abgelaufen</Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white">Aktiv</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Eye className="w-3 h-3 mr-1" />
                            Details anzeigen
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span>Verkäufer: <strong>{sellerName}</strong></span>
                          <span>Letztes Gebot: <strong>{Number(auction.current_bid || 0).toLocaleString('de-DE')} €</strong></span>
                          {auction.reserve_price && (
                            <span>Reservepreis: <strong className="text-amber-600">{Number(auction.reserve_price).toLocaleString('de-DE')} €</strong></span>
                          )}
                          {motorhome?.reserve_price && !auction.reserve_price && (
                            <span>Mindestpreis (WM): <strong className="text-amber-600">{Number(motorhome.reserve_price).toLocaleString('de-DE')} €</strong></span>
                          )}
                          <span>Angebote: <strong>{auctionOffers.length}</strong> ({pendingOffers.length} ausstehend)</span>
                          {highestDiff !== null && (
                            <span className={highestDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              Höchstes Angebot Δ Reserve:{' '}
                              <strong>
                                {highestDiff >= 0 ? '+' : ''}
                                {highestDiff.toLocaleString('de-DE')} €
                              </strong>
                            </span>
                          )}
                          {(auction.auction_round ?? 1) > 1 && (
                            <span>Runde: <strong>{auction.auction_round}</strong></span>
                          )}
                          <span className={auction.auto_relist ? 'text-teal-600' : 'text-red-500'}>
                            Auto-Relist: <strong>{auction.auto_relist ? 'Aktiv' : 'Deaktiviert'}</strong>
                          </span>
                          {auction.kaufchance_expires_at && (
                            <span>
                              Frist: <strong>{format(new Date(auction.kaufchance_expires_at), "dd.MM.yyyy HH:mm", { locale: de })}</strong>
                              {!isExpired && (
                                <span className="text-xs ml-1">
                                  ({formatDistanceToNow(new Date(auction.kaufchance_expires_at), { addSuffix: true, locale: de })})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        </div>
                      </div>

                      {/* Quick Actions (stop propagation to prevent detail dialog) */}
                      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="text-primary border-primary/30 hover:bg-primary/10"
                          title="Auktionsseite im neuen Tab öffnen"
                        >
                          <Link to={`/admin/auctions/${auction.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Auktion
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          disabled={extendingKaufchance === auction.id}
                          onClick={() => handleExtendKaufchance(auction.id, 3)}
                        >
                          {extendingKaufchance === auction.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-3.5 h-3.5 mr-1" />
                          )}
                          +3 Tage
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          disabled={backToAuctionLoading === auction.id}
                          onClick={() => openBackToAuctionDialog(
                            auction.id,
                            vehicleName,
                            auction.reserve_price || motorhome?.reserve_price || null
                          )}
                        >
                          {backToAuctionLoading === auction.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          )}
                          Neue Auktion
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={endingKaufchance === auction.id}
                          onClick={() => setEndKaufchanceConfirm({ auctionId: auction.id, vehicleName })}
                        >
                          {endingKaufchance === auction.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Ban className="w-3.5 h-3.5 mr-1" />
                          )}
                          Beenden
                        </Button>
                      </div>
                    </div>

                    {sortedOffers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Angebote im Detail
                        </p>
                        <div className="space-y-1.5">
                          {sortedOffers.map((offer) => {
                            const buyer = profileMap[offer.buyer_id];
                            const buyerName = buyer
                              ? (buyer.company_name
                                  || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim()
                                  || buyer.email
                                  || 'Händler')
                              : 'Händler';
                            const offerDiff =
                              effectiveReserve !== null
                                ? Number(offer.offer_amount) - Number(effectiveReserve)
                                : null;
                            const counterDiff =
                              effectiveReserve !== null && offer.counter_offer_amount
                                ? Number(offer.counter_offer_amount) - Number(effectiveReserve)
                                : null;
                            return (
                              <div
                                key={offer.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs bg-muted/40 rounded px-2 py-1.5"
                              >
                                <span className="font-medium truncate max-w-[200px]" title={buyerName}>
                                  {buyerName}
                                </span>
                                <span>
                                  Händler-Angebot:{' '}
                                  <strong className="text-blue-600">
                                    {Number(offer.offer_amount).toLocaleString('de-DE')} €
                                  </strong>
                                  {offerDiff !== null && (
                                    <span className={`ml-1 ${offerDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      ({offerDiff >= 0 ? '+' : ''}
                                      {offerDiff.toLocaleString('de-DE')} €)
                                    </span>
                                  )}
                                </span>
                                {offer.counter_offer_amount && (
                                  <span>
                                    Verkäufer-Gegenangebot:{' '}
                                    <strong className="text-amber-600">
                                      {Number(offer.counter_offer_amount).toLocaleString('de-DE')} €
                                    </strong>
                                    {counterDiff !== null && (
                                      <span className={`ml-1 ${counterDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        ({counterDiff >= 0 ? '+' : ''}
                                        {counterDiff.toLocaleString('de-DE')} €)
                                      </span>
                                    )}
                                  </span>
                                )}
                                <OfferStatusBadge status={offer.status} expiresAt={offer.expires_at} />
                                <span className="text-muted-foreground ml-auto">
                                  {format(new Date(offer.created_at), 'dd.MM. HH:mm', { locale: de })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Käufer, Auktion, Betrag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="accepted">Angenommen</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            <SelectItem value="countered">Gegenangebot</SelectItem>
            <SelectItem value="expired">Abgelaufen</SelectItem>
            <SelectItem value="withdrawn">Zurückgezogen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 animate-fade-in">
          <span className="text-sm font-medium">
            {selectedIds.size} Angebot{selectedIds.size > 1 ? "e" : ""} ausgewählt
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Auswahl aufheben
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteIds(Array.from(selectedIds));
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {selectedIds.size} löschen
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredOffers.length > 0 && selectedIds.size === filteredOffers.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Käufer</TableHead>
              <TableHead>Auktion</TableHead>
              <TableHead>Angebot</TableHead>
              <TableHead>Gegenangebot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Läuft ab</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead className="w-20">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Lade Angebote...
                </TableCell>
              </TableRow>
            ) : filteredOffers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Keine Nachauktions-Angebote gefunden
                </TableCell>
              </TableRow>
            ) : (
              filteredOffers.map((offer) => {
                const auction = auctionMap[offer.auction_id];
                const isExpired = offer.expires_at && isPast(new Date(offer.expires_at)) && offer.status === "pending";

                return (
                  <TableRow
                    key={offer.id}
                    className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(offer.id) ? "bg-primary/5" : ""} ${isExpired ? "opacity-60" : ""}`}
                    onClick={() => {
                      setSelectedOffer(offer);
                      setAdminCounterAmount("");
                      setAdminCounterMessage("");
                      setDetailDialogOpen(true);
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(offer.id)}
                        onCheckedChange={() => toggleSelection(offer.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{getProfileName(offer.buyer_id)}</p>
                        {profileMap[offer.buyer_id]?.email && (
                          <p className="text-xs text-muted-foreground">{profileMap[offer.buyer_id].email}</p>
                        )}
                        {profileMap[offer.buyer_id]?.phone && (
                          <a href={`tel:${profileMap[offer.buyer_id].phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {profileMap[offer.buyer_id].phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 min-w-0">
                        {auction ? (
                          <MotorhomeThumb auctionId={auction.id} motorhome={auction.motorhome} size="sm" />
                        ) : null}
                        <div className="min-w-0">
                          {auction?.motorhome ? (
                            <Link
                              to={`/admin/auctions/${auction.id}`}
                              className="text-sm font-medium hover:text-primary hover:underline line-clamp-1"
                              title="Zur Auktion öffnen"
                            >
                              {auction.motorhome.manufacturer} {auction.motorhome.model}
                            </Link>
                          ) : (
                            <p className="text-sm text-muted-foreground">Unbekannte Auktion</p>
                          )}
                          {auction?.motorhome?.listing_number && (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              #{auction.motorhome.listing_number}
                            </p>
                          )}
                          {auction?.status && (
                            <p className="text-xs text-muted-foreground">
                              Status: {auction.status}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600">
                        {offer.offer_amount.toLocaleString("de-DE")} €
                      </span>
                    </TableCell>
                    <TableCell>
                      {offer.counter_offer_amount != null ? (
                        <span className="font-semibold text-blue-600">
                          {offer.counter_offer_amount.toLocaleString("de-DE")} €
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OfferStatusBadge status={offer.status} expiresAt={offer.expires_at} />
                    </TableCell>
                    <TableCell>
                      {offer.expires_at ? (
                        <span className={`text-sm ${isExpired ? "text-destructive" : ""}`}>
                          {format(new Date(offer.expires_at), "dd.MM. HH:mm", { locale: de })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(offer.created_at), "dd.MM. HH:mm", { locale: de })}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedOffer(offer);
                            setAdminCounterAmount("");
                            setAdminCounterMessage("");
                            setDetailDialogOpen(true);
                          }}
                          title="Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {auction && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-primary"
                            asChild
                            title="Zur Auktion"
                          >
                            <Link
                              to={`/admin/auctions/${auction.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => {
                            setDeleteIds([offer.id]);
                            setDeleteDialogOpen(true);
                          }}
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ================================================================== */}
      {/* KAUFCHANCE DETAIL DIALOG - Full view with bids, offers, admin tools */}
      {/* ================================================================== */}
      <Dialog open={kaufchanceDetailOpen} onOpenChange={setKaufchanceDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          {selectedKaufchanceAuction && (() => {
            const auction = selectedKaufchanceAuction;
            const motorhome = auction.motorhome;
            const vehicleName = motorhome ? `${motorhome.manufacturer} ${motorhome.model}` : 'Unbekannt';
            const seller = motorhome?.seller_id ? profileMap[motorhome.seller_id] : null;
            const sellerName = seller
              ? (seller.company_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'Unbekannt')
              : 'Unbekannt';
            const isExpired = auction.kaufchance_expires_at && isPast(new Date(auction.kaufchance_expires_at));
            const effectiveReservePrice = auction.reserve_price || motorhome?.reserve_price || null;
            const displayBids = showAllBids ? kaufchanceBids : kaufchanceBids.slice(0, 10);

            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <MotorhomeThumb auctionId={auction.id} motorhome={motorhome} size="lg" />
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="flex items-center gap-2 text-xl flex-wrap">
                        <Gavel className={`w-5 h-5 flex-shrink-0 ${motorhome?.sale_channel === 'instant_price' ? 'text-yellow-600' : 'text-amber-600'}`} />
                        {motorhome?.sale_channel === 'instant_price' ? 'Festpreis: ' : 'Kaufchance: '}
                        <Link
                          to={`/admin/auctions/${auction.id}`}
                          className="hover:text-primary hover:underline"
                          title="Zur Auktion öffnen"
                        >
                          {vehicleName}
                        </Link>
                        {motorhome?.year && <span className="text-muted-foreground font-normal">({motorhome.year})</span>}
                        {motorhome?.listing_number && (
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            #{motorhome.listing_number}
                          </span>
                        )}
                      </DialogTitle>
                      <DialogDescription className="flex items-center gap-3 flex-wrap mt-2">
                        {isExpired ? (
                          <Badge variant="outline" className="text-destructive border-destructive">Abgelaufen</Badge>
                        ) : motorhome?.sale_channel === 'instant_price' ? (
                          <Badge className="bg-yellow-500 text-white">Festpreis aktiv</Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white">Aktiv</Badge>
                        )}
                        <span>Verkäufer: <strong>{sellerName}</strong></span>
                        {seller?.email && <span className="text-xs">({seller.email})</span>}
                        {seller?.phone && (
                          <a href={`tel:${seller.phone}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {seller.phone}
                          </a>
                        )}
                        <Button size="sm" variant="outline" asChild className="h-7 ml-auto">
                          <Link to={`/admin/auctions/${auction.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Auktion öffnen
                          </Link>
                        </Button>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {kaufchanceDetailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Tabs defaultValue="overview" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                      <TabsTrigger value="overview">Übersicht</TabsTrigger>
                      <TabsTrigger value="bids">
                        Gebote ({kaufchanceBids.length})
                      </TabsTrigger>
                      <TabsTrigger value="offers">
                        Angebote ({kaufchanceAllOffers.length})
                      </TabsTrigger>
                      <TabsTrigger value="admin">Admin-Tools</TabsTrigger>
                    </TabsList>

                    {/* ---- TAB: Übersicht ---- */}
                    <TabsContent value="overview" className="space-y-4 mt-4">
                      {/* Preisübersicht */}
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Euro className="w-4 h-4" /> Preisübersicht
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Letztes Gebot</p>
                            <p className="text-lg font-bold">{Number(auction.current_bid || 0).toLocaleString('de-DE')} €</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                            <p className="text-xs text-muted-foreground">Reservepreis</p>
                            <p className="text-lg font-bold text-amber-600">
                              {effectiveReservePrice ? `${Number(effectiveReservePrice).toLocaleString('de-DE')} €` : 'Nicht gesetzt'}
                            </p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                            <p className="text-xs text-muted-foreground">Mindestgebot (Admin)</p>
                            <p className="text-lg font-bold text-blue-600">
                              {auction.kaufchance_min_price ? `${Number(auction.kaufchance_min_price).toLocaleString('de-DE')} €` : 'Nicht gesetzt'}
                            </p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                            <p className="text-xs text-muted-foreground">Höchstes Angebot</p>
                            <p className="text-lg font-bold text-green-600">
                              {kaufchanceAllOffers.length > 0
                                ? `${Math.max(...kaufchanceAllOffers.map(o => o.offer_amount)).toLocaleString('de-DE')} €`
                                : 'Keine'}
                            </p>
                          </div>
                        </div>
                      </Card>

                      {/* Zeitinfo */}
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Zeitverlauf
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {auction.end_time && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Auktion beendet:</span>
                              <span>{format(new Date(auction.end_time), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                            </div>
                          )}
                          {auction.kaufchance_expires_at && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Kaufchance-Frist:</span>
                              <span className={isExpired ? "text-destructive font-medium" : "font-medium"}>
                                {format(new Date(auction.kaufchance_expires_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                {isExpired && " (abgelaufen)"}
                                {!isExpired && (
                                  <span className="text-xs ml-1 text-muted-foreground">
                                    ({formatDistanceToNow(new Date(auction.kaufchance_expires_at), { addSuffix: true, locale: de })})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Eingeladene Bieter */}
                      {kaufchanceInvitations.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" /> Eingeladene Bieter ({kaufchanceInvitations.length})
                          </h3>
                          <div className="space-y-2">
                            {kaufchanceInvitations.map((inv) => {
                              const bidder = profileMap[inv.bidder_id];
                              const bidderName = bidder
                                ? (bidder.company_name || `${bidder.first_name || ''} ${bidder.last_name || ''}`.trim() || bidder.email || 'Unbekannt')
                                : inv.bidder_id.substring(0, 8) + '...';
                              const hasOffer = kaufchanceAllOffers.some(o => o.buyer_id === inv.bidder_id);

                              return (
                                <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 flex-wrap gap-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs font-mono">#{inv.rank}</Badge>
                                    <span className="text-sm font-medium">{bidderName}</span>
                                    {bidder?.customer_number && (
                                      <span className="text-xs text-muted-foreground font-mono">#{bidder.customer_number}</span>
                                    )}
                                    {bidder?.email && (
                                      <span className="text-xs text-muted-foreground">{bidder.email}</span>
                                    )}
                                    {bidder?.phone && (
                                      <a href={`tel:${bidder.phone}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> {bidder.phone}
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold">{Number(inv.highest_bid).toLocaleString('de-DE')} €</span>
                                    {hasOffer ? (
                                      <Badge className="bg-green-500 text-white text-xs">Hat Angebot</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">Kein Angebot</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ---- TAB: Gebote (Auktions-Historie) ---- */}
                    <TabsContent value="bids" className="space-y-4 mt-4">
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <History className="w-4 h-4" /> Auktions-Gebote (chronologisch)
                        </h3>
                        {kaufchanceBids.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Keine Gebote vorhanden.</p>
                        ) : (
                          <>
                            <div className="text-xs text-muted-foreground mb-3">
                              {kaufchanceBids.length} Gebote insgesamt | Höchstes: {Math.max(...kaufchanceBids.map(b => Number(b.amount))).toLocaleString('de-DE')} € | {new Set(kaufchanceBids.map(b => b.bidder_id)).size} Bieter
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Bieter</TableHead>
                                  <TableHead>Betrag</TableHead>
                                  <TableHead>Typ</TableHead>
                                  <TableHead>Zeitpunkt</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {displayBids.map((bid, idx) => {
                                  const bidder = profileMap[bid.bidder_id];
                                  const bidderName = bidder
                                    ? (bidder.company_name || `${bidder.first_name || ''} ${bidder.last_name || ''}`.trim() || bidder.email || bid.bidder_id.substring(0, 8))
                                    : bid.bidder_id.substring(0, 8) + '...';
                                  const isHighest = idx === 0;

                                  return (
                                    <TableRow key={bid.id} className={isHighest ? "bg-green-50 dark:bg-green-950/20" : ""}>
                                      <TableCell className="font-mono text-xs">{kaufchanceBids.length - (showAllBids ? idx : idx)}</TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="text-sm font-medium">{bidderName}</p>
                                          {bidder?.customer_number && (
                                            <p className="text-xs text-muted-foreground font-mono">#{bidder.customer_number}</p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <span className={`font-semibold ${isHighest ? 'text-green-600' : ''}`}>
                                          {Number(bid.amount).toLocaleString('de-DE')} €
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {bid.is_autobid ? (
                                          <Badge variant="outline" className="text-xs">Auto</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">Manuell</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm:ss", { locale: de })}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                            {kaufchanceBids.length > 10 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => setShowAllBids(!showAllBids)}
                              >
                                {showAllBids ? (
                                  <><ChevronUp className="w-4 h-4 mr-1" /> Weniger anzeigen</>
                                ) : (
                                  <><ChevronDown className="w-4 h-4 mr-1" /> Alle {kaufchanceBids.length} Gebote anzeigen</>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </Card>
                    </TabsContent>

                    {/* ---- TAB: Kaufchance-Angebote ---- */}
                    <TabsContent value="offers" className="space-y-4 mt-4">
                      {kaufchanceAllOffers.length === 0 ? (
                        <Card className="p-8">
                          <div className="text-center">
                            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Noch keine Kaufchance-Angebote eingegangen.</p>
                          </div>
                        </Card>
                      ) : (
                        kaufchanceAllOffers.map((offer) => {
                          const buyer = profileMap[offer.buyer_id];
                          const buyerName = buyer
                            ? (buyer.company_name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.email || 'Unbekannt')
                            : 'Unbekannt';
                          const offerExpired = offer.expires_at && isPast(new Date(offer.expires_at)) && offer.status === 'pending';
                          const canAct = (offer.status === 'pending' && !offerExpired) || offer.status === 'countered';

                          return (
                            <Card key={offer.id} className={`p-4 ${offerExpired ? 'opacity-60' : ''}`}>
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <h4 className="font-semibold">{buyerName}</h4>
                                    {buyer?.customer_number && (
                                      <Badge variant="outline" className="text-xs font-mono">#{buyer.customer_number}</Badge>
                                    )}
                                    <OfferStatusBadge status={offer.status} expiresAt={offer.expires_at} />
                                  </div>
                                  {(buyer?.email || buyer?.phone) && (
                                    <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground flex-wrap">
                                      {buyer?.email && <span>{buyer.email}</span>}
                                      {buyer?.phone && (
                                        <a href={`tel:${buyer.phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                                          <Phone className="w-3 h-3" /> {buyer.phone}
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-6 mb-2">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Angebot</p>
                                      <p className="font-bold text-lg text-green-600">{Number(offer.offer_amount).toLocaleString('de-DE')} €</p>
                                    </div>
                                    {offer.counter_offer_amount != null && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Gegenangebot</p>
                                        <p className="font-bold text-lg text-blue-600">{Number(offer.counter_offer_amount).toLocaleString('de-DE')} €</p>
                                      </div>
                                    )}
                                  </div>

                                  {offer.message && (
                                    <p className="text-sm text-muted-foreground italic mb-1">"{offer.message}"</p>
                                  )}
                                  {offer.seller_response && (
                                    <p className="text-sm text-blue-600 mb-1">Antwort: "{offer.seller_response}"</p>
                                  )}

                                  <p className="text-xs text-muted-foreground">
                                    Erstellt: {format(new Date(offer.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                    {offer.expires_at && (
                                      <> | Frist: {format(new Date(offer.expires_at), "dd.MM.yyyy HH:mm", { locale: de })}</>
                                    )}
                                  </p>
                                </div>

                                {/* Admin-Aktionen für dieses Angebot */}
                                {canAct && (
                                  <div className="flex flex-col gap-2 min-w-[200px]">
                                    <Button
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600"
                                      disabled={adminActionLoading}
                                      onClick={() => handleAdminAcceptOffer(offer.id)}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      {offer.status === 'countered' ? `Annehmen (${Number(offer.counter_offer_amount).toLocaleString('de-DE')} €)` : 'Annehmen'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={adminActionLoading}
                                      onClick={() => handleAdminRejectOffer(offer.id)}
                                    >
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Ablehnen
                                    </Button>
                                    {offer.status === 'pending' && (
                                      <>
                                        <Separator />
                                        <div className="space-y-1">
                                          <Input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Gegenangebot €"
                                            value={adminCounterAmount}
                                            onChange={(e) => setAdminCounterAmount(e.target.value.replace(/\D/g, ''))}
                                            className="h-8 text-sm"
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-blue-500 text-blue-700 hover:bg-blue-50 h-8"
                                            disabled={adminActionLoading || !adminCounterAmount}
                                            onClick={() => handleAdminCounterOffer(offer.id)}
                                          >
                                            <Send className="w-3.5 h-3.5 mr-1" />
                                            Gegenangebot
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </TabsContent>

                    {/* ---- TAB: Admin-Tools ---- */}
                    <TabsContent value="admin" className="space-y-4 mt-4">
                      {/* Mindestgebot setzen */}
                      <Card className="p-4 border-2 border-amber-200">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-700">
                          <Shield className="w-4 h-4" /> Mindestgebot (Admin)
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Setzen Sie das Mindestgebot, unter dem kein Angebot angenommen werden soll.
                          {auction.kaufchance_min_price && (
                            <> Aktuell: <strong className="text-amber-600">{Number(auction.kaufchance_min_price).toLocaleString('de-DE')} €</strong></>
                          )}
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder={auction.kaufchance_min_price ? `Aktuell: ${Number(auction.kaufchance_min_price).toLocaleString('de-DE')} €` : 'Betrag in €'}
                            value={adminMinPriceInputs[auction.id] || ''}
                            onChange={(e) => setAdminMinPriceInputs(prev => ({ ...prev, [auction.id]: e.target.value.replace(/\D/g, '') }))}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            disabled={savingMinPrice === auction.id || !adminMinPriceInputs[auction.id]}
                            onClick={() => handleSaveMinPrice(auction.id)}
                          >
                            {savingMinPrice === auction.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><Send className="w-4 h-4 mr-1" /> Speichern</>
                            )}
                          </Button>
                        </div>
                      </Card>

                      {/* Angebot im Namen des Händlers erstellen */}
                      <Card className="p-4 border-2 border-blue-200">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-700">
                          <UserPlus className="w-4 h-4" /> Angebot im Namen eines Händlers erstellen
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Erstellen Sie manuell ein Kaufangebot im Namen eines eingeladenen Händlers (z.B. nach telefonischer Absprache).
                        </p>

                        {/* Eingeladene Händler als Auswahl */}
                        {kaufchanceInvitations.length > 0 && (
                          <div className="mb-3">
                            <Label className="text-xs text-muted-foreground mb-1 block">Eingeladener Händler auswählen:</Label>
                            <div className="flex flex-wrap gap-2">
                              {kaufchanceInvitations.map((inv) => {
                                const bidder = profileMap[inv.bidder_id];
                                const name = bidder
                                  ? (bidder.company_name || `${bidder.first_name || ''} ${bidder.last_name || ''}`.trim() || bidder.email || inv.bidder_id.substring(0, 8))
                                  : inv.bidder_id.substring(0, 8) + '...';
                                const isSelected = adminOfferDealerId === inv.bidder_id;

                                return (
                                  <Button
                                    key={inv.id}
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    className={`text-xs ${isSelected ? '' : 'hover:bg-blue-50'}`}
                                    onClick={() => setAdminOfferDealerId(inv.bidder_id)}
                                  >
                                    #{inv.rank} {name} ({Number(inv.highest_bid).toLocaleString('de-DE')} €)
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Händler-ID (oder oben auswählen)</Label>
                              <Input
                                placeholder="UUID des Händlers"
                                value={adminOfferDealerId}
                                onChange={(e) => setAdminOfferDealerId(e.target.value)}
                                className="font-mono text-xs"
                              />
                            </div>
                            <div className="w-40">
                              <Label className="text-xs">Betrag (€)</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Betrag"
                                value={adminOfferAmount}
                                onChange={(e) => setAdminOfferAmount(e.target.value.replace(/\D/g, ''))}
                              />
                            </div>
                          </div>
                          <Textarea
                            placeholder="Nachricht (optional, z.B. 'Telefonisches Angebot vom 07.04.')"
                            value={adminOfferMessage}
                            onChange={(e) => setAdminOfferMessage(e.target.value)}
                            rows={2}
                            className="resize-none"
                          />
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={adminOfferLoading || !adminOfferDealerId || !adminOfferAmount}
                            onClick={() => handleAdminCreateOffer(auction.id)}
                          >
                            {adminOfferLoading ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4 mr-1" />
                            )}
                            Angebot erstellen
                          </Button>
                        </div>
                      </Card>

                      {/* Im Namen des Verkäufers handeln */}
                      <Card className="p-4 border-2 border-purple-200">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-700">
                          <User className="w-4 h-4" /> Im Namen des Verkäufers handeln
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Senden Sie eine Preisvorstellung an alle eingeladenen Bieter oder kontern Sie offene Angebote im Namen des Verkäufers.
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Preisvorstellung / Gegenangebot an alle Bieter:</Label>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Betrag in €"
                                value={sellerActionCounterAmount}
                                onChange={(e) => setSellerActionCounterAmount(e.target.value.replace(/\D/g, ''))}
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                className="border-purple-500 text-purple-700 hover:bg-purple-50"
                                disabled={sellerActionLoading || !sellerActionCounterAmount}
                                onClick={() => handleAdminSellerCounterAll(auction.id)}
                              >
                                {sellerActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                                Gegenangebot senden
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            placeholder="Nachricht an Bieter (optional, z.B. 'Der Verkäufer erwartet mindestens ...')"
                            value={sellerActionMessage}
                            onChange={(e) => setSellerActionMessage(e.target.value)}
                            rows={2}
                            className="resize-none"
                          />
                          <Separator />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            disabled={sellerActionLoading}
                            onClick={() => handleAdminRejectAllPending(auction.id)}
                          >
                            {sellerActionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                            Alle offenen Angebote ablehnen (im Namen des Verkäufers)
                          </Button>
                        </div>
                      </Card>

                      {/* Frist verlängern */}
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <CalendarPlus className="w-4 h-4" /> Kaufchance-Frist verlängern
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            disabled={extendingKaufchance === auction.id}
                            onClick={() => handleExtendKaufchance(auction.id, 1)}
                          >
                            +1 Tag
                          </Button>
                          <Button
                            variant="outline"
                            disabled={extendingKaufchance === auction.id}
                            onClick={() => handleExtendKaufchance(auction.id, 3)}
                          >
                            +3 Tage
                          </Button>
                          <Button
                            variant="outline"
                            disabled={extendingKaufchance === auction.id}
                            onClick={() => handleExtendKaufchance(auction.id, 7)}
                          >
                            +7 Tage
                          </Button>
                        </div>
                      </Card>

                      {/* Zurück in Auktion */}
                      <Card className="p-4 border-2 border-green-200">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700">
                          <RotateCcw className="w-4 h-4" /> Zurück in Auktion
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Wenn sich Verkäufer und Käufer nicht einig werden, kann das Wohnmobil zurück in eine neue Auktion.
                          Die aktuelle Kaufchance wird beendet, alle ausstehenden Angebote abgelehnt, und eine neue aktive Auktion (7 Tage) gestartet.
                        </p>
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          disabled={backToAuctionLoading === auction.id}
                          onClick={() => openBackToAuctionDialog(
                            auction.id,
                            vehicleName,
                            effectiveReservePrice
                          )}
                        >
                          {backToAuctionLoading === auction.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4 mr-2" />
                          )}
                          Zurück in Auktion (sofort starten)
                        </Button>
                      </Card>

                      {/* Kaufchance beenden */}
                      <Card className="p-4 border-2 border-destructive/20">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                          <Ban className="w-4 h-4" /> Kaufchance endgültig beenden
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Beendet die Kaufchance ohne Verkauf. Das Wohnmobil wird als "nicht verkauft" markiert.
                        </p>
                        <Button
                          variant="destructive"
                          className="w-full"
                          disabled={endingKaufchance === auction.id}
                          onClick={() => setEndKaufchanceConfirm({ auctionId: auction.id, vehicleName })}
                        >
                          {endingKaufchance === auction.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Ban className="w-4 h-4 mr-2" />
                          )}
                          Kaufchance beenden (nicht verkauft)
                        </Button>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Single Offer Detail Dialog */}
      {/* ================================================================== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOffer && (() => {
            const auction = auctionMap[selectedOffer.auction_id];
            const buyer = profileMap[selectedOffer.buyer_id];
            const seller = auction?.motorhome?.seller_id ? profileMap[auction.motorhome.seller_id] : null;
            const isExpired = selectedOffer.expires_at && isPast(new Date(selectedOffer.expires_at)) && selectedOffer.status === "pending";
            const canAct = (selectedOffer.status === 'pending' && !isExpired) || selectedOffer.status === 'countered';

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <HandshakeIcon className="w-5 h-5" />
                    Nachauktions-Angebot
                  </DialogTitle>
                  <DialogDescription>
                    <OfferStatusBadge status={selectedOffer.status} expiresAt={selectedOffer.expires_at} />
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Fahrzeug-Karte (Thumbnail + Link zur Auktion) */}
                  {auction && (
                    <Card className="p-3 bg-muted/40">
                      <div className="flex items-center gap-3">
                        <MotorhomeThumb auctionId={auction.id} motorhome={auction.motorhome} size="md" />
                        <div className="flex-1 min-w-0">
                          {auction.motorhome ? (
                            <Link
                              to={`/admin/auctions/${auction.id}`}
                              className="font-semibold text-sm hover:text-primary hover:underline block truncate"
                              title="Zur Auktion öffnen"
                            >
                              {auction.motorhome.manufacturer} {auction.motorhome.model}
                            </Link>
                          ) : (
                            <p className="font-semibold text-sm text-muted-foreground">Unbekannte Auktion</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                            {auction.motorhome?.year && <span>Baujahr {auction.motorhome.year}</span>}
                            {auction.motorhome?.listing_number && (
                              <span className="font-mono">#{auction.motorhome.listing_number}</span>
                            )}
                            {auction.status && <span>Status: {auction.status}</span>}
                          </div>
                        </div>
                        {/* Button: auf Mobile nur Icon (Thumbnail + Name sind bereits klickbare Links),
                            ab sm: Icon + Text, spart ca. 70px bei 320-360px-Displays */}
                        <Button
                          size="icon"
                          variant="outline"
                          asChild
                          className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3 flex-shrink-0"
                          title="Auktion in neuem Tab öffnen"
                        >
                          <Link to={`/admin/auctions/${auction.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Öffnen</span>
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Offer Details */}
                  <Card className="p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Angebotsbetrag:</span>
                        <span className="text-lg font-bold text-green-600">
                          {selectedOffer.offer_amount.toLocaleString("de-DE")} €
                        </span>
                      </div>
                      {selectedOffer.counter_offer_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Gegenangebot:</span>
                          <span className="text-lg font-bold text-blue-600">
                            {selectedOffer.counter_offer_amount.toLocaleString("de-DE")} €
                          </span>
                        </div>
                      )}
                      {auction?.current_bid != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Letztes Auktionsgebot:</span>
                          <span className="font-medium">{Number(auction.current_bid).toLocaleString("de-DE")} €</span>
                        </div>
                      )}
                      {auction?.kaufchance_min_price != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mindestgebot (Admin):</span>
                          <span className="font-medium text-amber-600">{Number(auction.kaufchance_min_price).toLocaleString("de-DE")} €</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Parties */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" /> Beteiligte
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Käufer (Bieter):</span>
                        <div className="text-right">
                          <p className="font-medium">{getProfileName(selectedOffer.buyer_id)}</p>
                          {buyer?.email && <p className="text-xs text-muted-foreground">{buyer.email}</p>}
                          {buyer?.phone && (
                            <a href={`tel:${buyer.phone}`} className="text-xs text-primary hover:underline flex items-center justify-end gap-1">
                              <Phone className="w-3 h-3" /> {buyer.phone}
                            </a>
                          )}
                          {buyer?.customer_number && <p className="text-xs font-mono text-muted-foreground">#{buyer.customer_number}</p>}
                        </div>
                      </div>
                      {seller && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Verkäufer:</span>
                          <div className="text-right">
                            <p className="font-medium">{getProfileName(auction!.motorhome!.seller_id)}</p>
                            {seller.email && <p className="text-xs text-muted-foreground">{seller.email}</p>}
                            {seller.phone && (
                              <a href={`tel:${seller.phone}`} className="text-xs text-primary hover:underline flex items-center justify-end gap-1">
                                <Phone className="w-3 h-3" /> {seller.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Message */}
                  {selectedOffer.message && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Nachricht des Käufers
                      </h3>
                      <p className="text-sm">{selectedOffer.message}</p>
                    </Card>
                  )}

                  {/* Seller Response */}
                  {selectedOffer.seller_response && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Antwort des Verkäufers
                      </h3>
                      <p className="text-sm">{selectedOffer.seller_response}</p>
                      {selectedOffer.responded_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Beantwortet: {format(new Date(selectedOffer.responded_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Timeline */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Zeitverlauf
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Erstellt:</span>
                        <span>{format(new Date(selectedOffer.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                      </div>
                      {selectedOffer.expires_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Läuft ab:</span>
                          <span className={isExpired ? "text-destructive font-medium" : ""}>
                            {format(new Date(selectedOffer.expires_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            {isExpired && " (abgelaufen)"}
                          </span>
                        </div>
                      )}
                      {selectedOffer.responded_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Beantwortet:</span>
                          <span>{format(new Date(selectedOffer.responded_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Admin Actions */}
                  {canAct && (
                    <Card className="p-4 border-2 border-primary/30">
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                        <HandshakeIcon className="w-4 h-4" /> Admin-Aktionen
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 flex-1"
                            disabled={adminActionLoading}
                            onClick={() => handleAdminAcceptOffer(selectedOffer.id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {selectedOffer.status === 'countered'
                              ? `Annehmen (${Number(selectedOffer.counter_offer_amount).toLocaleString('de-DE')} €)`
                              : 'Annehmen (Verkauf abschließen)'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            disabled={adminActionLoading}
                            onClick={() => handleAdminRejectOffer(selectedOffer.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Ablehnen
                          </Button>
                        </div>
                        {selectedOffer.status === 'pending' && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium">Gegenangebot im Namen des Verkäufers:</p>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Betrag in €"
                                value={adminCounterAmount}
                                onChange={(e) => setAdminCounterAmount(e.target.value.replace(/\D/g, ''))}
                              />
                              <Textarea
                                placeholder="Nachricht (optional)"
                                value={adminCounterMessage}
                                onChange={(e) => setAdminCounterMessage(e.target.value)}
                                rows={2}
                                className="resize-none"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-blue-500 text-blue-700 hover:bg-blue-50"
                                disabled={adminActionLoading || !adminCounterAmount}
                                onClick={() => handleAdminCounterOffer(selectedOffer.id)}
                              >
                                {adminActionLoading ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-1" />
                                )}
                                Gegenangebot senden
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Zurück in Auktion Dialog */}
      <Dialog open={backToAuctionDialogOpen} onOpenChange={setBackToAuctionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              Zurück in Auktion
            </DialogTitle>
            <DialogDescription>
              <strong>{backToAuctionVehicleName}</strong> wird zurück in eine neue aktive Auktion gesetzt.
              Die Kaufchance wird beendet und alle ausstehenden Angebote abgelehnt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Neue Auktion wird sofort gestartet</p>
              <p className="text-xs text-green-600 dark:text-green-400">Laufzeit: 7 Tage ab jetzt</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backToAuctionReservePrice" className="text-sm font-medium">
                Mindestpreis / Reservepreis (optional)
              </Label>
              <div className="relative">
                <Input
                  id="backToAuctionReservePrice"
                  type="text"
                  inputMode="numeric"
                  placeholder="Leer lassen = alter Preis beibehalten"
                  value={backToAuctionReservePrice}
                  onChange={(e) => setBackToAuctionReservePrice(e.target.value.replace(/\D/g, ''))}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              </div>
              {backToAuctionLowestOffer ? (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Vorausgefüllt mit dem niedrigsten Verkäufer-Gegenangebot: {Number(backToAuctionLowestOffer).toLocaleString('de-DE')} €
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Geben Sie einen neuen Mindestpreis ein oder lassen Sie das Feld leer, um den bisherigen Preis beizubehalten.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setBackToAuctionDialogOpen(false)}
              disabled={!!backToAuctionLoading}
            >
              Abbrechen
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!!backToAuctionLoading}
              onClick={handleBackToAuction}
            >
              {backToAuctionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Auktion starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteIds.length === 1 ? "Angebot löschen" : `${deleteIds.length} Angebote löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length === 1
                ? "Möchten Sie dieses Nachauktions-Angebot wirklich löschen?"
                : `Möchten Sie wirklich ${deleteIds.length} Nachauktions-Angebote löschen?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOffers.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOffers.mutate(deleteIds)}
              disabled={deleteOffers.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteOffers.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!endKaufchanceConfirm} onOpenChange={(open) => { if (!open) setEndKaufchanceConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-destructive" />
              Kaufchance beenden
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kaufchance für "{endKaufchanceConfirm?.vehicleName}" wirklich beenden? Alle ausstehenden Angebote werden abgelehnt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (endKaufchanceConfirm) {
                  handleEndKaufchance(endKaufchanceConfirm.auctionId);
                  setEndKaufchanceConfirm(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Ban className="w-4 h-4 mr-2" />
              Ja, beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
