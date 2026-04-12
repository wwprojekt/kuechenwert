import { useState, useMemo, useCallback } from "react";
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
  vehicle_id: string | null;
  status: string | null;
  current_bid: number | null;
  kaufchance_expires_at: string | null;
  kaufchance_min_price: number | null;
  reserve_price: number | null;
  starting_bid: number | null;
  end_time: string | null;
  vehicle: {
    id: string;
    manufacturer: string;
    model: string;
    seller_id: string;
    reserve_price: number | null;
    year: number | null;
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
  const [extendingKaufchance, setExtendingKaufchance] = useState<string | null>(null);
  const [backToAuctionLoading, setBackToAuctionLoading] = useState<string | null>(null);
  const [backToAuctionDialogOpen, setBackToAuctionDialogOpen] = useState(false);
  const [backToAuctionAuctionId, setBackToAuctionAuctionId] = useState<string | null>(null);
  const [backToAuctionReservePrice, setBackToAuctionReservePrice] = useState("");
  const [backToAuctionVehicleName, setBackToAuctionVehicleName] = useState("");

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
    refetchInterval: 30000,
  });

  const { data: auctionMap = {} } = useQuery({
    queryKey: ["adminOfferAuctions", offers.map(o => o.auction_id)],
    queryFn: async () => {
      const auctionIds = [...new Set(offers.map(o => o.auction_id).filter(Boolean))];
      if (auctionIds.length === 0) return {};
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id, vehicle_id, status, current_bid, starting_bid, end_time,
          kaufchance_expires_at, kaufchance_min_price, reserve_price,
          vehicle:vehicles (id, manufacturer, model, seller_id, reserve_price, year)
        `)
        .in("id", auctionIds);
      if (error) throw error;
      const map: Record<string, AuctionInfo> = {};
      (data || []).forEach((a: any) => { map[a.id] = a; });
      return map;
    },
    enabled: offers.length > 0,
  });

  // Also load kaufchance auctions that may not have offers yet
  const { data: kaufchanceAuctions = [] } = useQuery({
    queryKey: ["adminKaufchanceAuctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id, vehicle_id, status, current_bid, starting_bid, end_time,
          kaufchance_expires_at, kaufchance_min_price, reserve_price,
          vehicle:vehicles (id, manufacturer, model, seller_id, reserve_price, year)
        `)
        .eq("status", "kaufchance")
        .order("kaufchance_expires_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AuctionInfo[];
    },
    refetchInterval: 30000,
  });

  // Collect all profile IDs we need (stable dependency for queryKey)
  const allProfileIds = useMemo(() => {
    const ids = new Set<string>();
    offers.forEach(o => {
      if (o.buyer_id) ids.add(o.buyer_id);
    });
    Object.values(auctionMap).forEach((a: AuctionInfo) => {
      if (a.vehicle?.seller_id) ids.add(a.vehicle.seller_id);
    });
    kaufchanceAuctions.forEach((a: any) => {
      if (a.vehicle?.seller_id) ids.add(a.vehicle.seller_id);
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
        const vehicleName = auction?.vehicle
          ? `${auction.vehicle.manufacturer} ${auction.vehicle.model}`.toLowerCase()
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
          const { error: notifyErr } = await supabase.functions.invoke('notify-offer-action', {
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
          const { error: notifyErr } = await supabase.functions.invoke('notify-offer-action', {
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
      const { data: auctionData, error: auctionFetchError } = await supabase
        .from('auctions')
        .select('vehicle_id')
        .eq('id', auctionId)
        .single();
      if (auctionFetchError) throw auctionFetchError;

      const { error: auctionError } = await supabase
        .from('auctions')
        .update({ status: 'ended', updated_at: new Date().toISOString() })
        .eq('id', auctionId);
      if (auctionError) throw auctionError;

      if (auctionData?.vehicle_id) {
        const { error: vhErr } = await supabase
          .from('vehicles')
          .update({ status: 'not_sold', updated_at: new Date().toISOString() })
          .eq('id', auctionData.vehicle_id);
        if (vhErr) throw vhErr;
      }

      // Alle ausstehenden Angebote ablehnen
      const { error: offersRejectErr } = await supabase
        .from('post_auction_offers')
        .update({ status: 'rejected', seller_response: 'Kaufchance beendet durch Admin', updated_at: new Date().toISOString() })
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (offersRejectErr) throw offersRejectErr;

      toast({ title: 'Kaufchance beendet', description: 'Auktion wurde als "nicht verkauft" markiert.' });
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
  const openBackToAuctionDialog = (auctionId: string, vehicleName: string, currentReservePrice: number | null) => {
    setBackToAuctionAuctionId(auctionId);
    setBackToAuctionVehicleName(vehicleName);
    setBackToAuctionReservePrice(currentReservePrice ? String(currentReservePrice) : "");
    setBackToAuctionDialogOpen(true);
  };

  // ---- Zurück in Auktion: Bestehende Auktion recyceln (UPDATE statt INSERT) ----
  // WICHTIG: Die auctions-Tabelle hat einen UNIQUE Constraint auf vehicle_id,
  // daher kann keine zweite Auktion für dasselbe Wohnmobil erstellt werden.
  // Stattdessen wird die bestehende Auktion zurückgesetzt: neuer Status, neue Zeiten,
  // neuer Mindestpreis. Alte Bids und Offers werden archiviert/gelöscht.
  const handleBackToAuction = async () => {
    if (!backToAuctionAuctionId) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    const auctionId = backToAuctionAuctionId;
    setBackToAuctionLoading(auctionId);
    try {
      // 1. Lade aktuelle Auktionsdaten
      const { data: currentAuction, error: fetchErr } = await supabase
        .from('auctions')
        .select('vehicle_id, reserve_price, starting_bid, vehicle:vehicles(reserve_price, postal_code, city)')
        .eq('id', auctionId)
        .single();
      if (fetchErr) throw fetchErr;

      const vehicleId = currentAuction?.vehicle_id;
      if (!vehicleId) throw new Error('Kein Wohnmobil mit dieser Auktion verknüpft.');

      // Prüfe PLZ (wie bei normaler Aktivierung)
      const mh = currentAuction?.vehicle as any;
      if (!mh?.postal_code) {
        throw new Error('Das Wohnmobil hat keine PLZ. Bitte zuerst die Fahrzeugdaten vervollständigen.');
      }

      // 2. Alle ausstehenden Kaufchance-Angebote ablehnen
      const { error: rejectErr } = await supabase
        .from('post_auction_offers')
        .update({ status: 'rejected', seller_response: 'Kaufchance beendet – zurück in Auktion', updated_at: new Date().toISOString() })
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (rejectErr) throw rejectErr;

      // 3. Alle Kaufchance-Einladungen löschen
      const { error: invDelErr } = await supabase
        .from('kaufchance_invitations')
        .delete()
        .eq('auction_id', auctionId);
      if (invDelErr) throw invDelErr;

      // 4. Alle alten Bids löschen (damit die neue Auktion sauber startet)
      const { error: bidsDelErr } = await supabase
        .from('bids')
        .delete()
        .eq('auction_id', auctionId);
      if (bidsDelErr) throw bidsDelErr;

      // 5. Neuen Mindestpreis bestimmen
      const newReservePrice = backToAuctionReservePrice
        ? parseFloat(backToAuctionReservePrice)
        : (currentAuction?.reserve_price || (mh as any)?.reserve_price || null);

      // 6. Bestehende Auktion recyceln: Status auf 'active', neue Zeiten, neuer Mindestpreis
      const startTime = new Date();
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);

      const { error: updateErr } = await supabase
        .from('auctions')
        .update({
          status: 'active' as any,
          current_bid: null,
          reserve_price: newReservePrice && !isNaN(newReservePrice) ? newReservePrice : null,
          starting_bid: currentAuction?.starting_bid || 50,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          kaufchance_expires_at: null,
          kaufchance_min_price: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', auctionId);
      if (updateErr) throw updateErr;

      // 7. Fahrzeug-Status auf 'active' setzen
      const { error: vhActiveErr } = await supabase
        .from('vehicles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', vehicleId);
      if (vhActiveErr) throw vhActiveErr;

      toast({
        title: 'Zurück in Auktion',
        description: `Auktion neu gestartet! Läuft 7 Tage bis ${endTime.toLocaleDateString('de-DE')} ${endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.${newReservePrice ? ` Mindestpreis: ${Number(newReservePrice).toLocaleString('de-DE')} €` : ''}`,
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
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48h Frist

      const { error } = await supabase
        .from('post_auction_offers')
        .insert({
          auction_id: auctionId,
          buyer_id: adminOfferDealerId,
          offer_amount: amount,
          message: adminOfferMessage || 'Angebot erstellt durch Admin',
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        });
      if (error) throw error;

      // Verkäufer benachrichtigen via Edge Function
      try {
        await supabase.functions.invoke('notify-offer-action', {
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
          await supabase.functions.invoke('notify-offer-action', {
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
        toast({ title: 'Hinweis', description: 'Keine offenen Angebote vorhanden.' });
        setSellerActionLoading(false);
        return;
      }

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
          const { error: notifyErr } = await supabase.functions.invoke('notify-offer-action', {
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
                const vehicle = auction.vehicle;
                const vehicleName = vehicle
                  ? `${vehicle.manufacturer} ${vehicle.model}`
                  : 'Unbekannt';
                const seller = vehicle?.seller_id ? profileMap[vehicle.seller_id] : null;
                const sellerName = seller
                  ? (seller.company_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'Unbekannt')
                  : 'Unbekannt';
                const auctionOffers = offers.filter(o => o.auction_id === auction.id);
                const pendingOffers = auctionOffers.filter(o => o.status === 'pending');
                const isExpired = auction.kaufchance_expires_at && isPast(new Date(auction.kaufchance_expires_at));

                return (
                  <div
                    key={auction.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/40 ${isExpired ? 'bg-muted/50 opacity-70' : 'bg-card'}`}
                    onClick={() => loadKaufchanceDetail(auction)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{vehicleName}</h3>
                          {vehicle?.year && <span className="text-sm text-muted-foreground">({vehicle.year})</span>}
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
                          {vehicle?.reserve_price && !auction.reserve_price && (
                            <span>Mindestpreis (WM): <strong className="text-amber-600">{Number(vehicle.reserve_price).toLocaleString('de-DE')} €</strong></span>
                          )}
                          <span>Angebote: <strong>{auctionOffers.length}</strong> ({pendingOffers.length} ausstehend)</span>
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

                      {/* Quick Actions (stop propagation to prevent detail dialog) */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                            auction.reserve_price || vehicle?.reserve_price || null
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
                          onClick={() => {
                            if (window.confirm(`Kaufchance für "${vehicleName}" wirklich beenden? Alle ausstehenden Angebote werden abgelehnt.`)) {
                              handleEndKaufchance(auction.id);
                            }
                          }}
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
          <SelectTrigger className="w-[180px]">
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
                    <TableCell>
                      <div>
                        <p className="text-sm">{auction?.vehicle ? `${auction.vehicle.manufacturer} ${auction.vehicle.model}` : "Unbekannte Auktion"}</p>
                        {auction?.status && (
                          <p className="text-xs text-muted-foreground">
                            Status: {auction.status}
                          </p>
                        )}
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
            const vehicle = auction.vehicle;
            const vehicleName = vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : 'Unbekannt';
            const seller = vehicle?.seller_id ? profileMap[vehicle.seller_id] : null;
            const sellerName = seller
              ? (seller.company_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'Unbekannt')
              : 'Unbekannt';
            const isExpired = auction.kaufchance_expires_at && isPast(new Date(auction.kaufchance_expires_at));
            const effectiveReservePrice = auction.reserve_price || vehicle?.reserve_price || null;
            const displayBids = showAllBids ? kaufchanceBids : kaufchanceBids.slice(0, 10);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Gavel className="w-5 h-5 text-amber-600" />
                    Kaufchance: {vehicleName}
                    {vehicle?.year && <span className="text-muted-foreground font-normal">({vehicle.year})</span>}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-3 flex-wrap">
                    {isExpired ? (
                      <Badge variant="outline" className="text-destructive border-destructive">Abgelaufen</Badge>
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
                  </DialogDescription>
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
                                            type="number"
                                            placeholder="Gegenangebot €"
                                            value={adminCounterAmount}
                                            onChange={(e) => setAdminCounterAmount(e.target.value)}
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
                            type="number"
                            placeholder={auction.kaufchance_min_price ? `Aktuell: ${Number(auction.kaufchance_min_price).toLocaleString('de-DE')} €` : 'Betrag in €'}
                            value={adminMinPriceInputs[auction.id] || ''}
                            onChange={(e) => setAdminMinPriceInputs(prev => ({ ...prev, [auction.id]: e.target.value }))}
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
                                type="number"
                                placeholder="Betrag"
                                value={adminOfferAmount}
                                onChange={(e) => setAdminOfferAmount(e.target.value)}
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
                          Antworten Sie auf alle offenen Angebote im Namen des Verkäufers (z.B. nach telefonischer Absprache mit dem Verkäufer).
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Preisvorstellung / Gegenangebot an alle Bieter:</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="Betrag in €"
                                value={sellerActionCounterAmount}
                                onChange={(e) => setSellerActionCounterAmount(e.target.value)}
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
                          onClick={() => {
                            if (window.confirm(`Kaufchance für "${vehicleName}" wirklich endgültig beenden?`)) {
                              handleEndKaufchance(auction.id);
                            }
                          }}
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
            const seller = auction?.vehicle?.seller_id ? profileMap[auction.vehicle.seller_id] : null;
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
                            <p className="font-medium">{getProfileName(auction!.vehicle!.seller_id)}</p>
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
                                type="number"
                                placeholder="Betrag in €"
                                value={adminCounterAmount}
                                onChange={(e) => setAdminCounterAmount(e.target.value)}
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
                  type="number"
                  placeholder="Leer lassen = alter Preis beibehalten"
                  value={backToAuctionReservePrice}
                  onChange={(e) => setBackToAuctionReservePrice(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Geben Sie einen neuen Mindestpreis ein oder lassen Sie das Feld leer, um den bisherigen Preis beizubehalten.
              </p>
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
    </div>
  );
}
