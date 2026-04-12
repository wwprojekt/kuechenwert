import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  Star,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Trash2,
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  User,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface DealerReview {
  id: string;
  dealer_id: string;
  reviewer_id: string;
  auction_id: string | null;
  rating: number;
  communication_rating: number | null;
  reliability_rating: number | null;
  professionalism_rating: number | null;
  review_text: string | null;
  title: string | null;
  comment: string | null;
  status: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  moderation_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ProfileInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function ReviewStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500 text-white">Freigegeben</Badge>;
    case "rejected":
      return <Badge variant="destructive">Abgelehnt</Badge>;
    case "flagged":
      return <Badge className="bg-orange-500 text-white">Markiert</Badge>;
    case "pending":
    default:
      return <Badge className="bg-yellow-500 text-white">Ausstehend</Badge>;
  }
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
      <span className={`ml-1 font-medium ${size === "lg" ? "text-lg" : "text-xs"}`}>{rating.toFixed(1)}</span>
    </div>
  );
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

export default function AdminReviews() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<DealerReview | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["adminDealerReviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dealer_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DealerReview[];
    },
    refetchInterval: 30000,
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["adminReviewProfiles", reviews.map(r => `${r.dealer_id}-${r.reviewer_id}`)],
    queryFn: async () => {
      const allIds = new Set<string>();
      reviews.forEach(r => {
        if (r.dealer_id) allIds.add(r.dealer_id);
        if (r.reviewer_id) allIds.add(r.reviewer_id);
      });
      if (allIds.size === 0) return {};

      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return {};

      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_name, email")
        .in("id", Array.from(allIds));
      const map: Record<string, ProfileInfo> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: reviews.length > 0,
  });

  // ---- Statistics ----

  const stats = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter(r => !r.status || r.status === "pending").length;
    const approved = reviews.filter(r => r.status === "approved").length;
    const rejected = reviews.filter(r => r.status === "rejected").length;
    const flagged = reviews.filter(r => r.status === "flagged").length;
    const avgRating = total > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
      : "0.0";
    const lowRatings = reviews.filter(r => r.rating <= 2).length;

    return { total, pending, approved, rejected, flagged, avgRating, lowRatings };
  }, [reviews]);

  // ---- Filtering ----

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      if (statusFilter !== "all") {
        const reviewStatus = review.status || "pending";
        if (reviewStatus !== statusFilter) return false;
      }
      if (ratingFilter !== "all") {
        if (ratingFilter === "low" && review.rating > 2) return false;
        if (ratingFilter === "high" && review.rating < 4) return false;
        if (ratingFilter === "medium" && (review.rating < 3 || review.rating > 3)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dealer = profileMap[review.dealer_id];
        const reviewer = profileMap[review.reviewer_id];
        const dealerName = dealer
          ? `${dealer.first_name || ""} ${dealer.last_name || ""} ${dealer.company_name || ""}`.toLowerCase()
          : "";
        const reviewerName = reviewer
          ? `${reviewer.first_name || ""} ${reviewer.last_name || ""} ${reviewer.company_name || ""}`.toLowerCase()
          : "";
        return (
          dealerName.includes(q) ||
          reviewerName.includes(q) ||
          (review.review_text || "").toLowerCase().includes(q) ||
          (review.title || "").toLowerCase().includes(q) ||
          (review.comment || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, statusFilter, ratingFilter, searchQuery, profileMap]);

  // ---- Mutations ----

  const moderateReview = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updateData: Record<string, any> = {
        status,
        moderated_by: user?.id || null,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (reason) updateData.moderation_reason = reason;

      const { error } = await supabase
        .from("dealer_reviews")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      const labels: Record<string, string> = {
        approved: "Bewertung freigegeben",
        rejected: "Bewertung abgelehnt",
        flagged: "Bewertung markiert",
      };
      toast({ title: labels[status] || "Status aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["adminDealerReviews"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const bulkModerate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("dealer_reviews")
        .update({
          status,
          moderated_by: user?.id || null,
          moderated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, status }) => {
      toast({ title: `${ids.length} Bewertung${ids.length > 1 ? "en" : ""} ${status === "approved" ? "freigegeben" : "abgelehnt"}` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["adminDealerReviews"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message || "Bewertungen konnten nicht moderiert werden", variant: "destructive" });
    },
  });

  const deleteReviews = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("dealer_reviews")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({ title: `${ids.length} Bewertung${ids.length > 1 ? "en" : ""} gelöscht` });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["adminDealerReviews"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  // ---- Handlers ----

  const getProfileName = (id: string) => {
    const p = profileMap[id];
    if (!p) return "Unbekannt";
    if (p.company_name) return p.company_name;
    return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Unbekannt";
  };

  const openDetail = (review: DealerReview) => {
    setSelectedReview(review);
    setModerationReason(review.moderation_reason || "");
    setDetailDialogOpen(true);
  };

  const handleApprove = (id: string) => {
    moderateReview.mutate({ id, status: "approved" });
    setDetailDialogOpen(false);
  };

  const handleReject = (id: string) => {
    moderateReview.mutate({ id, status: "rejected", reason: moderationReason });
    setDetailDialogOpen(false);
  };

  const handleFlag = (id: string) => {
    moderateReview.mutate({ id, status: "flagged", reason: moderationReason });
    setDetailDialogOpen(false);
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
    if (selectedIds.size === filteredReviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReviews.map((r) => r.id)));
    }
  };

  const getReviewText = (review: DealerReview) => {
    return review.comment || review.review_text || "";
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" />
            Händler-Bewertungen
          </h1>
          <p className="text-muted-foreground mt-1">
            Bewertungen moderieren, freigeben oder ablehnen
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["adminDealerReviews"] })}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Gesamt"
          value={stats.total}
          icon={Star}
          description={`${stats.avgRating} Durchschnitt`}
          color="bg-blue-500"
        />
        <StatCard
          title="Ausstehend"
          value={stats.pending}
          icon={Clock}
          description={`${stats.flagged} markiert`}
          color="bg-yellow-500"
        />
        <StatCard
          title="Freigegeben"
          value={stats.approved}
          icon={CheckCircle2}
          description={`${stats.rejected} abgelehnt`}
          color="bg-green-500"
        />
        <StatCard
          title="Kritische"
          value={stats.lowRatings}
          icon={AlertTriangle}
          description="Bewertungen mit 1-2 Sternen"
          color="bg-red-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Händler, Bewerter, Text..."
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
            <SelectItem value="approved">Freigegeben</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            <SelectItem value="flagged">Markiert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Bewertung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Bewertungen</SelectItem>
            <SelectItem value="high">Gut (4-5 Sterne)</SelectItem>
            <SelectItem value="medium">Mittel (3 Sterne)</SelectItem>
            <SelectItem value="low">Schlecht (1-2 Sterne)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 animate-fade-in">
          <span className="text-sm font-medium">
            {selectedIds.size} Bewertung{selectedIds.size > 1 ? "en" : ""} ausgewählt
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Auswahl aufheben
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => bulkModerate.mutate({ ids: Array.from(selectedIds), status: "approved" })}
              disabled={bulkModerate.isPending}
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              Alle freigeben
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => bulkModerate.mutate({ ids: Array.from(selectedIds), status: "rejected" })}
              disabled={bulkModerate.isPending}
            >
              <ThumbsDown className="w-4 h-4 mr-2" />
              Alle ablehnen
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
              Löschen
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
                  checked={filteredReviews.length > 0 && selectedIds.size === filteredReviews.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Händler</TableHead>
              <TableHead>Bewerter</TableHead>
              <TableHead>Bewertung</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="w-32">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Lade Bewertungen...
                </TableCell>
              </TableRow>
            ) : filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Keine Bewertungen gefunden
                </TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((review) => (
                <TableRow
                  key={review.id}
                  className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(review.id) ? "bg-primary/5" : ""} ${review.rating <= 2 ? "border-l-2 border-l-red-400" : ""}`}
                  onClick={() => openDetail(review)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(review.id)}
                      onCheckedChange={() => toggleSelection(review.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{getProfileName(review.dealer_id)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{getProfileName(review.reviewer_id)}</p>
                  </TableCell>
                  <TableCell>
                    <StarRating rating={review.rating} />
                    {(review.communication_rating || review.reliability_rating || review.professionalism_rating) && (
                      <div className="flex gap-2 mt-1">
                        {review.communication_rating && (
                          <span className="text-[10px] text-muted-foreground">Komm: {review.communication_rating}</span>
                        )}
                        {review.reliability_rating && (
                          <span className="text-[10px] text-muted-foreground">Zuv: {review.reliability_rating}</span>
                        )}
                        {review.professionalism_rating && (
                          <span className="text-[10px] text-muted-foreground">Prof: {review.professionalism_rating}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[250px]">
                      {review.title && <p className="text-sm font-medium">{review.title}</p>}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {getReviewText(review) || "Kein Text"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReviewStatusBadge status={review.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(review)} title="Details">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {(!review.status || review.status === "pending" || review.status === "flagged") && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(review.id)}
                            title="Freigeben"
                          >
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReview(review);
                              setModerationReason("");
                              handleReject(review.id);
                            }}
                            title="Ablehnen"
                            className="hover:text-destructive"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ================================================================== */}
      {/* Detail Dialog */}
      {/* ================================================================== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Bewertung Details
                </DialogTitle>
                <DialogDescription>
                  <ReviewStatusBadge status={selectedReview.status} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Rating Overview */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Gesamtbewertung</h3>
                    <StarRating rating={selectedReview.rating} size="lg" />
                  </div>
                  {(selectedReview.communication_rating || selectedReview.reliability_rating || selectedReview.professionalism_rating) && (
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                      {selectedReview.communication_rating != null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Kommunikation</p>
                          <StarRating rating={selectedReview.communication_rating} />
                        </div>
                      )}
                      {selectedReview.reliability_rating != null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Zuverlässigkeit</p>
                          <StarRating rating={selectedReview.reliability_rating} />
                        </div>
                      )}
                      {selectedReview.professionalism_rating != null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Professionalität</p>
                          <StarRating rating={selectedReview.professionalism_rating} />
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Parties */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Beteiligte
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bewerteter Händler:</span>
                      <span className="font-medium">{getProfileName(selectedReview.dealer_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bewerter:</span>
                      <span className="font-medium">{getProfileName(selectedReview.reviewer_id)}</span>
                    </div>
                    {selectedReview.auction_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auktion-ID:</span>
                        <span className="font-mono text-xs">{selectedReview.auction_id.slice(0, 8)}...</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Review Text */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Bewertungstext
                  </h3>
                  {selectedReview.title && (
                    <p className="font-medium mb-2">{selectedReview.title}</p>
                  )}
                  <p className="text-sm">
                    {getReviewText(selectedReview) || <span className="text-muted-foreground italic">Kein Text vorhanden</span>}
                  </p>
                </Card>

                {/* Moderation */}
                {(!selectedReview.status || selectedReview.status === "pending" || selectedReview.status === "flagged") && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Moderation
                    </h3>
                    <div>
                      <Label>Begründung (optional, wird bei Ablehnung gespeichert)</Label>
                      <Textarea
                        placeholder="Grund für Ablehnung oder Markierung..."
                        value={moderationReason}
                        onChange={(e) => setModerationReason(e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </Card>
                )}

                {/* Previous Moderation */}
                {selectedReview.moderated_at && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Letzte Moderation
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Moderiert am:</span>
                        <span>{format(new Date(selectedReview.moderated_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                      </div>
                      {selectedReview.moderation_reason && (
                        <div>
                          <span className="text-muted-foreground">Begründung:</span>
                          <p className="mt-1">{selectedReview.moderation_reason}</p>
                        </div>
                      )}
                    </div>
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
                      <span>{format(new Date(selectedReview.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    </div>
                    {selectedReview.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aktualisiert:</span>
                        <span>{format(new Date(selectedReview.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <DialogFooter className="mt-4 gap-2">
                {(!selectedReview.status || selectedReview.status === "pending" || selectedReview.status === "flagged") && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleFlag(selectedReview.id)}
                      disabled={moderateReview.isPending}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Markieren
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedReview.id)}
                      disabled={moderateReview.isPending}
                    >
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Ablehnen
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedReview.id)}
                      disabled={moderateReview.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      Freigeben
                    </Button>
                  </>
                )}
                {selectedReview.status === "approved" && (
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(selectedReview.id)}
                    disabled={moderateReview.isPending}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Doch ablehnen
                  </Button>
                )}
                {selectedReview.status === "rejected" && (
                  <Button
                    onClick={() => handleApprove(selectedReview.id)}
                    disabled={moderateReview.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Doch freigeben
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteIds.length === 1 ? "Bewertung löschen" : `${deleteIds.length} Bewertungen löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length === 1
                ? "Möchten Sie diese Bewertung wirklich endgültig löschen?"
                : `Möchten Sie wirklich ${deleteIds.length} Bewertungen endgültig löschen?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReviews.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReviews.mutate(deleteIds)}
              disabled={deleteReviews.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteReviews.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
