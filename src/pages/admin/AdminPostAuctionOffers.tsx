import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  title: string | null;
  motorhome_id: string | null;
  seller_id: string | null;
  final_price: number | null;
  status: string | null;
  current_bid: number | null;
  kaufchance_expires_at: string | null;
  kaufchance_min_price: number | null;
}

interface ProfileInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  customer_number: string | null;
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

  // Admin action state
  const [adminCounterAmount, setAdminCounterAmount] = useState("");
  const [adminCounterMessage, setAdminCounterMessage] = useState("");
  const [adminMinPriceInputs, setAdminMinPriceInputs] = useState<Record<string, string>>({});
  const [savingMinPrice, setSavingMinPrice] = useState<string | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["adminPostAuctionOffers"],
    queryFn: async () => {
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
      const { data } = await supabase
        .from("auctions")
        .select("id, title, motorhome_id, seller_id, final_price, status, current_bid, kaufchance_expires_at, kaufchance_min_price")
        .in("id", auctionIds);
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
          id, title, motorhome_id, seller_id, status, current_bid,
          kaufchance_expires_at, kaufchance_min_price,
          motorhome:motorhomes (manufacturer, model)
        `)
        .eq("status", "kaufchance")
        .order("kaufchance_expires_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["adminOfferProfiles", offers.map(o => o.buyer_id)],
    queryFn: async () => {
      const allIds = new Set<string>();
      offers.forEach(o => {
        if (o.buyer_id) allIds.add(o.buyer_id);
      });
      Object.values(auctionMap).forEach((a: AuctionInfo) => {
        if (a.seller_id) allIds.add(a.seller_id);
      });
      kaufchanceAuctions.forEach((a: any) => {
        if (a.seller_id) allIds.add(a.seller_id);
      });
      if (allIds.size === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_name, email, customer_number")
        .in("id", Array.from(allIds));
      const map: Record<string, ProfileInfo> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: offers.length > 0 || kaufchanceAuctions.length > 0,
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
        const auctionTitle = auction?.title?.toLowerCase() || "";
        return (
          buyerName.includes(q) ||
          auctionTitle.includes(q) ||
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

  // ---- Admin Actions ----

  const handleAdminAcceptOffer = async (offerId: string) => {
    setAdminActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept-kaufchance-offer', {
        body: { offerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');

      toast({ title: 'Angebot angenommen', description: 'Kaufvertrag wird erstellt.' });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      setDetailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminRejectOffer = async (offerId: string) => {
    setAdminActionLoading(true);
    try {
      const { error } = await supabase
        .from('post_auction_offers')
        .update({ status: 'rejected', seller_response: 'Abgelehnt durch Admin', updated_at: new Date().toISOString() })
        .eq('id', offerId);
      if (error) throw error;
      toast({ title: 'Angebot abgelehnt' });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
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
    setAdminActionLoading(true);
    try {
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
      toast({ title: 'Gegenangebot gesendet', description: `${amount.toLocaleString('de-DE')} \u20ac` });
      setAdminCounterAmount("");
      setAdminCounterMessage("");
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
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
      toast({ title: 'Mindestgebot gespeichert', description: `${amount.toLocaleString('de-DE')} \u20ac` });
      queryClient.invalidateQueries({ queryKey: ["adminKaufchanceAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminOfferAuctions"] });
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSavingMinPrice(null);
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
          value={`${stats.avgOffer.toLocaleString("de-DE")} \u20ac`}
          icon={Euro}
          description={`${stats.totalOfferValue.toLocaleString("de-DE")} \u20ac gesamt`}
          color="bg-purple-500"
        />
      </div>

      {/* ================================================================== */}
      {/* Active Kaufchancen Overview */}
      {/* ================================================================== */}
      {kaufchanceAuctions.length > 0 && (
        <Card className="border-2 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Gavel className="w-5 h-5 text-amber-600" />
              Aktive Kaufchancen – Auktionsübersicht
            </h2>
            <div className="space-y-4">
              {kaufchanceAuctions.map((auction: any) => {
                const motorhome = auction.motorhome;
                const vehicleName = motorhome
                  ? `${motorhome.manufacturer} ${motorhome.model}`
                  : (auction.title || 'Unbekannt');
                const seller = auction.seller_id ? profileMap[auction.seller_id] : null;
                const sellerName = seller
                  ? (seller.company_name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'Unbekannt')
                  : 'Unbekannt';
                const auctionOffers = offers.filter(o => o.auction_id === auction.id);
                const pendingOffers = auctionOffers.filter(o => o.status === 'pending');
                const isExpired = auction.kaufchance_expires_at && isPast(new Date(auction.kaufchance_expires_at));

                return (
                  <div key={auction.id} className={`p-4 rounded-lg border ${isExpired ? 'bg-muted/50 opacity-70' : 'bg-card'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{vehicleName}</h3>
                          {isExpired ? (
                            <Badge variant="outline" className="text-destructive border-destructive">Abgelaufen</Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white">Aktiv</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span>Verkäufer: <strong>{sellerName}</strong></span>
                          <span>Letztes Gebot: <strong>{Number(auction.current_bid || 0).toLocaleString('de-DE')} \u20ac</strong></span>
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

                      {/* Admin: Mindestgebot setzen */}
                      <div className="flex items-center gap-2 min-w-[280px]">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Mindestgebot (Admin)</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              type="number"
                              placeholder={auction.kaufchance_min_price ? `Aktuell: ${Number(auction.kaufchance_min_price).toLocaleString('de-DE')} \u20ac` : 'Betrag in \u20ac'}
                              value={adminMinPriceInputs[auction.id] || ''}
                              onChange={(e) => setAdminMinPriceInputs(prev => ({ ...prev, [auction.id]: e.target.value }))}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingMinPrice === auction.id || !adminMinPriceInputs[auction.id]}
                              onClick={() => handleSaveMinPrice(auction.id)}
                            >
                              {savingMinPrice === auction.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          {auction.kaufchance_min_price && (
                            <p className="text-xs text-amber-600 mt-1">
                              Aktuelles Mindestgebot: {Number(auction.kaufchance_min_price).toLocaleString('de-DE')} \u20ac
                            </p>
                          )}
                        </div>
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
      <Card>
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{auction?.title || "Unbekannte Auktion"}</p>
                        {auction?.status && (
                          <p className="text-xs text-muted-foreground">
                            Status: {auction.status}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">
                        {offer.offer_amount.toLocaleString("de-DE")} \u20ac
                      </span>
                    </TableCell>
                    <TableCell>
                      {offer.counter_offer_amount != null ? (
                        <span className="text-sm font-medium text-blue-600">
                          {offer.counter_offer_amount.toLocaleString("de-DE")} \u20ac
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OfferStatusBadge status={offer.status} expiresAt={offer.expires_at} />
                    </TableCell>
                    <TableCell>
                      {offer.expires_at ? (
                        <div>
                          <span className={`text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                            {isExpired ? "Abgelaufen" : formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true, locale: de })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true, locale: de })}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
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
                          size="sm"
                          onClick={() => {
                            setDeleteIds([offer.id]);
                            setDeleteDialogOpen(true);
                          }}
                          title="Löschen"
                          className="hover:text-destructive"
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
      {/* Detail Dialog with Admin Actions */}
      {/* ================================================================== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOffer && (() => {
            const auction = auctionMap[selectedOffer.auction_id];
            const buyer = profileMap[selectedOffer.buyer_id];
            const seller = auction?.seller_id ? profileMap[auction.seller_id] : null;
            const isExpired = selectedOffer.expires_at && isPast(new Date(selectedOffer.expires_at)) && selectedOffer.status === "pending";
            const canAct = selectedOffer.status === 'pending' && !isExpired;

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
                          {selectedOffer.offer_amount.toLocaleString("de-DE")} \u20ac
                        </span>
                      </div>
                      {selectedOffer.counter_offer_amount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Gegenangebot:</span>
                          <span className="text-lg font-bold text-blue-600">
                            {selectedOffer.counter_offer_amount.toLocaleString("de-DE")} \u20ac
                          </span>
                        </div>
                      )}
                      {auction?.current_bid != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Letztes Auktionsgebot:</span>
                          <span className="font-medium">{Number(auction.current_bid).toLocaleString("de-DE")} \u20ac</span>
                        </div>
                      )}
                      {auction?.kaufchance_min_price != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mindestgebot (Admin):</span>
                          <span className="font-medium text-amber-600">{Number(auction.kaufchance_min_price).toLocaleString("de-DE")} \u20ac</span>
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
                          {buyer?.customer_number && <p className="text-xs font-mono text-muted-foreground">#{buyer.customer_number}</p>}
                        </div>
                      </div>
                      {seller && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Verkäufer:</span>
                          <div className="text-right">
                            <p className="font-medium">{getProfileName(auction!.seller_id!)}</p>
                            {seller.email && <p className="text-xs text-muted-foreground">{seller.email}</p>}
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
                            Annehmen (Verkauf abschließen)
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
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs font-medium">Gegenangebot im Namen des Verkäufers:</p>
                          <Input
                            type="number"
                            placeholder="Betrag in \u20ac"
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
                      </div>
                    </Card>
                  )}
                </div>
              </>
            );
          })()}
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
