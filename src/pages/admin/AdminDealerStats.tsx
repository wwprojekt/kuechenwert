import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Building2,
  Gavel,
  TrendingUp,
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Heart,
  CreditCard,
  Clock,
  Trophy,
  Activity,
  Users,
  DollarSign,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// Types
// ============================================================================

interface DealerApplication {
  id: string;
  user_id: string;
  company_name: string;
  company_city: string | null;
  status: string;
  created_at: string;
  contact_person_name: string | null;
  phone: string | null;
}

interface BidStats {
  bidder_id: string;
  bid_count: number;
  auction_count: number;
  max_bid: number;
  avg_bid: number;
  total_volume: number;
  last_bid_at: string | null;
  autobid_count: number;
}

interface WonAuction {
  winner_id: string;
  won_count: number;
  total_won_value: number;
}

interface InvoiceStats {
  dealer_id: string;
  total_invoices: number;
  paid_invoices: number;
  open_invoices: number;
  total_revenue: number;
  outstanding_amount: number;
}

interface FavoriteStats {
  user_id: string;
  favorite_count: number;
}

interface RatingStats {
  dealer_id: string;
  average_rating: number;
  total_reviews: number;
}

interface DealerStatsRow {
  id: string;
  user_id: string;
  company_name: string;
  company_city: string | null;
  status: string;
  created_at: string;
  contact_person_name: string | null;
  phone: string | null;
  bid_count: number;
  auction_count: number;
  max_bid: number;
  avg_bid: number;
  total_volume: number;
  last_bid_at: string | null;
  autobid_count: number;
  won_count: number;
  total_won_value: number;
  total_invoices: number;
  paid_invoices: number;
  open_invoices: number;
  total_revenue: number;
  outstanding_amount: number;
  favorite_count: number;
  average_rating: number;
  total_reviews: number;
  win_rate: number;
}

type SortField =
  | "company_name"
  | "bid_count"
  | "auction_count"
  | "won_count"
  | "avg_bid"
  | "max_bid"
  | "total_volume"
  | "favorite_count"
  | "last_bid_at"
  | "total_revenue"
  | "outstanding_amount"
  | "average_rating"
  | "created_at"
  | "win_rate";

type SortDirection = "asc" | "desc";

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "–";
  try {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
  } catch {
    return "–";
  }
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "–";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: de });
  } catch {
    return "–";
  }
}

// ============================================================================
// Summary Card Component
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "text-primary",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg bg-muted ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sortable Header Component
// ============================================================================

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 w-full text-left"
      >
        <span className="text-xs font-semibold">{label}</span>
        {isActive ? (
          currentDirection === "asc" ? (
            <ArrowUp className="w-3 h-3 text-primary" />
          ) : (
            <ArrowDown className="w-3 h-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminDealerStats() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("bid_count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // ---- Data Fetching ----

  const { data: dealers = [], isLoading: dealersLoading, refetch: refetchDealers } = useQuery({
    queryKey: ["adminDealerStatsApplications"],
    queryFn: async (): Promise<DealerApplication[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("dealer_applications")
        .select("id, user_id, company_name, company_city, status, created_at, contact_person_name, phone")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DealerApplication[];
    },
    staleTime: 60_000,
  });

  const { data: bidStats = [], isLoading: bidsLoading } = useQuery({
    queryKey: ["adminDealerStatsBids"],
    queryFn: async (): Promise<BidStats[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data, error } = await supabase
        .from("bids")
        .select("bidder_id, amount, auction_id, created_at, is_autobid");
      if (error) throw error;

      // Aggregate client-side
      const map = new Map<string, BidStats>();
      for (const bid of data || []) {
        const existing = map.get(bid.bidder_id);
        const amount = Number(bid.amount) || 0;
        if (existing) {
          existing.bid_count++;
          if (!existing._auctions.has(bid.auction_id)) {
            existing._auctions.add(bid.auction_id);
            existing.auction_count++;
          }
          existing.max_bid = Math.max(existing.max_bid, amount);
          existing.total_volume += amount;
          if (bid.created_at && (!existing.last_bid_at || bid.created_at > existing.last_bid_at)) {
            existing.last_bid_at = bid.created_at;
          }
          if (bid.is_autobid) existing.autobid_count++;
        } else {
          map.set(bid.bidder_id, {
            bidder_id: bid.bidder_id,
            bid_count: 1,
            auction_count: 1,
            max_bid: amount,
            avg_bid: amount,
            total_volume: amount,
            last_bid_at: bid.created_at,
            autobid_count: bid.is_autobid ? 1 : 0,
            _auctions: new Set([bid.auction_id]),
          } as any);
        }
      }

      // Calculate averages
      return Array.from(map.values()).map((s: any) => {
        delete s._auctions;
        s.avg_bid = s.bid_count > 0 ? Math.round(s.total_volume / s.bid_count) : 0;
        return s as BidStats;
      });
    },
    staleTime: 60_000,
  });

  const { data: wonAuctions = [], isLoading: wonsLoading } = useQuery({
    queryKey: ["adminDealerStatsWonAuctions"],
    queryFn: async (): Promise<WonAuction[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data: soldAuctions, error: aErr } = await supabase
        .from("auctions")
        .select("id, current_bid")
        .in("status", ["sold"]);
      if (aErr) throw aErr;

      if (!soldAuctions || soldAuctions.length === 0) return [];

      // For each sold auction, find the highest bidder
      const auctionIds = soldAuctions.map((a) => a.id);
      const { data: allBids, error: bErr } = await supabase
        .from("bids")
        .select("auction_id, bidder_id, amount")
        .in("auction_id", auctionIds);
      if (bErr) throw bErr;

      // Find winner per auction (highest bid)
      const winnerMap = new Map<string, { bidder_id: string; amount: number }>();
      for (const bid of allBids || []) {
        const existing = winnerMap.get(bid.auction_id);
        const amount = Number(bid.amount) || 0;
        if (!existing || amount > existing.amount) {
          winnerMap.set(bid.auction_id, { bidder_id: bid.bidder_id, amount });
        }
      }

      // Aggregate per dealer
      const dealerWins = new Map<string, WonAuction>();
      for (const [, winner] of winnerMap) {
        const existing = dealerWins.get(winner.bidder_id);
        if (existing) {
          existing.won_count++;
          existing.total_won_value += winner.amount;
        } else {
          dealerWins.set(winner.bidder_id, {
            winner_id: winner.bidder_id,
            won_count: 1,
            total_won_value: winner.amount,
          });
        }
      }

      return Array.from(dealerWins.values());
    },
    staleTime: 60_000,
  });

  const { data: invoiceStats = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["adminDealerStatsInvoices"],
    queryFn: async (): Promise<InvoiceStats[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("invoices")
        .select("dealer_id, gross_amount, payment_status, amount_paid");
      if (error) throw error;

      const map = new Map<string, InvoiceStats>();
      for (const inv of data || []) {
        if (!inv.dealer_id) continue;
        const existing = map.get(inv.dealer_id);
        const gross = Number(inv.gross_amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        const isPaid = inv.payment_status === "paid";

        if (existing) {
          existing.total_invoices++;
          if (isPaid) existing.paid_invoices++;
          else existing.open_invoices++;
          existing.total_revenue += paid;
          existing.outstanding_amount += isPaid ? 0 : gross - paid;
        } else {
          map.set(inv.dealer_id, {
            dealer_id: inv.dealer_id,
            total_invoices: 1,
            paid_invoices: isPaid ? 1 : 0,
            open_invoices: isPaid ? 0 : 1,
            total_revenue: paid,
            outstanding_amount: isPaid ? 0 : gross - paid,
          });
        }
      }

      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  const { data: favoriteStats = [], isLoading: favsLoading } = useQuery({
    queryKey: ["adminDealerStatsFavorites"],
    queryFn: async (): Promise<FavoriteStats[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("user_favorites")
        .select("user_id");
      if (error) throw error;

      const map = new Map<string, number>();
      for (const fav of data || []) {
        map.set(fav.user_id, (map.get(fav.user_id) || 0) + 1);
      }

      return Array.from(map.entries()).map(([user_id, count]) => ({
        user_id,
        favorite_count: count,
      }));
    },
    staleTime: 60_000,
  });

  const { data: ratingStats = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ["adminDealerStatsRatings"],
    queryFn: async (): Promise<RatingStats[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data, error } = await supabase
        .from("dealer_rating_summary")
        .select("dealer_id, average_rating, total_reviews");
      if (error) throw error;
      return (data || []).map((r) => ({
        dealer_id: r.dealer_id,
        average_rating: Number(r.average_rating) || 0,
        total_reviews: r.total_reviews || 0,
      }));
    },
    staleTime: 60_000,
  });

  // ---- Merge all data ----

  const mergedData: DealerStatsRow[] = useMemo(() => {
    const bidMap = new Map(bidStats.map((b) => [b.bidder_id, b]));
    const wonMap = new Map(wonAuctions.map((w) => [w.winner_id, w]));
    const invMap = new Map(invoiceStats.map((i) => [i.dealer_id, i]));
    const favMap = new Map(favoriteStats.map((f) => [f.user_id, f]));
    const ratMap = new Map(ratingStats.map((r) => [r.dealer_id, r]));

    return dealers.map((d) => {
      const bid = bidMap.get(d.user_id);
      const won = wonMap.get(d.user_id);
      const inv = invMap.get(d.user_id);
      const fav = favMap.get(d.user_id);
      const rat = ratMap.get(d.user_id);

      const auctionCount = bid?.auction_count || 0;
      const wonCount = won?.won_count || 0;

      return {
        id: d.id,
        user_id: d.user_id,
        company_name: d.company_name,
        company_city: d.company_city,
        status: d.status,
        created_at: d.created_at,
        contact_person_name: d.contact_person_name,
        phone: d.phone,
        bid_count: bid?.bid_count || 0,
        auction_count: auctionCount,
        max_bid: bid?.max_bid || 0,
        avg_bid: bid?.avg_bid || 0,
        total_volume: bid?.total_volume || 0,
        last_bid_at: bid?.last_bid_at || null,
        autobid_count: bid?.autobid_count || 0,
        won_count: wonCount,
        total_won_value: won?.total_won_value || 0,
        total_invoices: inv?.total_invoices || 0,
        paid_invoices: inv?.paid_invoices || 0,
        open_invoices: inv?.open_invoices || 0,
        total_revenue: inv?.total_revenue || 0,
        outstanding_amount: inv?.outstanding_amount || 0,
        favorite_count: fav?.favorite_count || 0,
        average_rating: rat?.average_rating || 0,
        total_reviews: rat?.total_reviews || 0,
        win_rate: auctionCount > 0 ? Math.round((wonCount / auctionCount) * 100) : 0,
      };
    });
  }, [dealers, bidStats, wonAuctions, invoiceStats, favoriteStats, ratingStats]);

  // ---- Filter & Sort ----

  const filteredAndSorted = useMemo(() => {
    let result = mergedData;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.company_name?.toLowerCase().includes(term) ||
          d.company_city?.toLowerCase().includes(term) ||
          d.contact_person_name?.toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nulls
      if (aVal == null) aVal = sortField === "company_name" ? "" : -Infinity;
      if (bVal == null) bVal = sortField === "company_name" ? "" : -Infinity;

      // String comparison
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal, "de")
          : bVal.localeCompare(aVal, "de");
      }

      // Numeric comparison
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [mergedData, searchTerm, statusFilter, sortField, sortDirection]);

  // ---- Sort handler ----

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  // ---- Summary stats ----

  const summary = useMemo(() => {
    const approved = mergedData.filter((d) => d.status === "approved");
    const totalBids = mergedData.reduce((s, d) => s + d.bid_count, 0);
    const totalVolume = mergedData.reduce((s, d) => s + d.total_volume, 0);
    const dealersWithBids = mergedData.filter((d) => d.bid_count > 0).length;
    const avgBidsPerDealer = dealersWithBids > 0 ? Math.round(totalBids / dealersWithBids) : 0;
    const totalWon = mergedData.reduce((s, d) => s + d.won_count, 0);
    const totalRevenue = mergedData.reduce((s, d) => s + d.total_revenue, 0);

    return {
      activeCount: approved.length,
      totalBids,
      totalVolume,
      avgBidsPerDealer,
      dealersWithBids,
      totalWon,
      totalRevenue,
    };
  }, [mergedData]);

  // ---- CSV Export ----

  const handleExport = useCallback(() => {
    const headers = [
      "Firma",
      "Stadt",
      "Status",
      "Registriert",
      "Gebote",
      "Auktionen",
      "Gewonnen",
      "Win-Rate %",
      "Durchschn. Gebot",
      "Max. Gebot",
      "Gesamtvolumen",
      "Autobids",
      "Favoriten",
      "Letztes Gebot",
      "Rechnungen",
      "Bezahlt",
      "Offen",
      "Umsatz",
      "Ausstehend",
      "Bewertung",
      "Bewertungen",
    ];

    const rows = filteredAndSorted.map((d) => [
      d.company_name,
      d.company_city || "",
      d.status,
      formatDate(d.created_at),
      d.bid_count,
      d.auction_count,
      d.won_count,
      d.win_rate,
      d.avg_bid,
      d.max_bid,
      d.total_volume,
      d.autobid_count,
      d.favorite_count,
      d.last_bid_at ? formatDate(d.last_bid_at) : "",
      d.total_invoices,
      d.paid_invoices,
      d.open_invoices,
      d.total_revenue,
      d.outstanding_amount,
      d.average_rating,
      d.total_reviews,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `haendler-statistik_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  // ---- Loading state ----

  const isLoading = dealersLoading || bidsLoading || wonsLoading || invoicesLoading || favsLoading || ratingsLoading;

  // ---- Status badge helper ----

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Aktiv</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px]">Ausstehend</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">Abgelehnt</Badge>;
      case "suspended":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-[10px]">Gesperrt</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Händler-Statistik
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Umfassende Übersicht über Aktivitäten, Gebote und Performance aller Händler
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDealers()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard
          title="Aktive Händler"
          value={formatNumber(summary.activeCount)}
          subtitle={`${mergedData.length} gesamt`}
          icon={Building2}
          color="text-blue-600"
        />
        <StatCard
          title="Gebote gesamt"
          value={formatNumber(summary.totalBids)}
          subtitle={`${summary.dealersWithBids} Händler aktiv`}
          icon={Gavel}
          color="text-orange-600"
        />
        <StatCard
          title="Gebote/Händler"
          value={formatNumber(summary.avgBidsPerDealer)}
          subtitle="Durchschnitt (aktive)"
          icon={Activity}
          color="text-purple-600"
        />
        <StatCard
          title="Gesamtvolumen"
          value={formatCurrency(summary.totalVolume)}
          subtitle="Summe aller Gebote"
          icon={TrendingUp}
          color="text-green-600"
        />
        <StatCard
          title="Gewonnene Auktionen"
          value={formatNumber(summary.totalWon)}
          icon={Trophy}
          color="text-amber-600"
        />
        <StatCard
          title="Umsatz"
          value={formatCurrency(summary.totalRevenue)}
          subtitle="Bezahlte Rechnungen"
          icon={DollarSign}
          color="text-emerald-600"
        />
        <StatCard
          title="Händler mit Geboten"
          value={`${summary.dealersWithBids}`}
          subtitle={`${summary.activeCount > 0 ? Math.round((summary.dealersWithBids / summary.activeCount) * 100) : 0}% der aktiven`}
          icon={Users}
          color="text-cyan-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Firma, Stadt oder Ansprechpartner suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="approved">Aktiv</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
                <SelectItem value="suspended">Gesperrt</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredAndSorted.length} von {mergedData.length} Händlern
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <SortableHeader label="Firma" field="company_name" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} className="min-w-[180px] sticky left-0 bg-muted/30 z-10" />
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <SortableHeader label="Gebote" field="bid_count" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Auktionen" field="auction_count" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Gewonnen" field="won_count" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Win-Rate" field="win_rate" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Durchschn." field="avg_bid" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Max. Gebot" field="max_bid" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Volumen" field="total_volume" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Favoriten" field="favorite_count" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Letztes Gebot" field="last_bid_at" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Umsatz" field="total_revenue" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Ausstehend" field="outstanding_amount" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Bewertung" field="average_rating" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Registriert" field="created_at" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Daten werden geladen...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                      Keine Händler gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSorted.map((d) => (
                    <TableRow
                      key={d.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/dealers/${d.id}`)}
                    >
                      {/* Firma */}
                      <TableCell className="sticky left-0 bg-background z-10 min-w-[180px]">
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]" title={d.company_name}>
                            {d.company_name}
                          </p>
                          {d.company_city && (
                            <p className="text-xs text-muted-foreground">{d.company_city}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>{statusBadge(d.status)}</TableCell>

                      {/* Gebote */}
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className={`font-semibold text-sm ${d.bid_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                {formatNumber(d.bid_count)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{d.bid_count} Gebote, davon {d.autobid_count} Autobids</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      {/* Auktionen */}
                      <TableCell className="text-sm">{formatNumber(d.auction_count)}</TableCell>

                      {/* Gewonnen */}
                      <TableCell>
                        <span className={`text-sm font-medium ${d.won_count > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                          {d.won_count}
                        </span>
                      </TableCell>

                      {/* Win-Rate */}
                      <TableCell>
                        {d.auction_count > 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              d.win_rate >= 50
                                ? "border-green-300 text-green-700 bg-green-50"
                                : d.win_rate >= 25
                                ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                                : "border-gray-200"
                            }`}
                          >
                            {d.win_rate}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>

                      {/* Durchschn. Gebot */}
                      <TableCell className="text-sm">{d.avg_bid > 0 ? formatCurrency(d.avg_bid) : "–"}</TableCell>

                      {/* Max. Gebot */}
                      <TableCell className="text-sm font-medium">{d.max_bid > 0 ? formatCurrency(d.max_bid) : "–"}</TableCell>

                      {/* Volumen */}
                      <TableCell className="text-sm">{d.total_volume > 0 ? formatCurrency(d.total_volume) : "–"}</TableCell>

                      {/* Favoriten */}
                      <TableCell>
                        {d.favorite_count > 0 ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Heart className="w-3 h-3 text-red-400" />
                            {d.favorite_count}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>

                      {/* Letztes Gebot */}
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeDate(d.last_bid_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{d.last_bid_at ? formatDate(d.last_bid_at) : "Kein Gebot"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      {/* Umsatz */}
                      <TableCell>
                        <span className={`text-sm ${d.total_revenue > 0 ? "font-medium text-green-700" : "text-muted-foreground"}`}>
                          {d.total_revenue > 0 ? formatCurrency(d.total_revenue) : "–"}
                        </span>
                      </TableCell>

                      {/* Ausstehend */}
                      <TableCell>
                        {d.outstanding_amount > 0 ? (
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(d.outstanding_amount)}
                          </span>
                        ) : d.total_invoices > 0 ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Bezahlt</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>

                      {/* Bewertung */}
                      <TableCell>
                        {d.total_reviews > 0 ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {d.average_rating.toFixed(1)}
                            <span className="text-[10px] text-muted-foreground">({d.total_reviews})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>

                      {/* Registriert */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(d.created_at)}
                      </TableCell>

                      {/* Link */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/dealers/${d.id}`);
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
