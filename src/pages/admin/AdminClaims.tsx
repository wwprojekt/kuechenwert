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
  AlertTriangle,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Euro,
  FileWarning,
  Shield,
  Trash2,
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Claim {
  id: string;
  auction_id: string;
  dealer_id: string;
  motorhome_id: string;
  claim_type: string;
  title: string;
  description: string;
  claim_amount: number | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  resolution_notes: string | null;
  approved_amount: number | null;
  commission_charged_to_seller: boolean | null;
  commission_charge_amount: number | null;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface DealerProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "submitted":
      return <Badge className="bg-blue-500 text-white">Eingereicht</Badge>;
    case "in_review":
      return <Badge className="bg-yellow-500 text-white">In Prüfung</Badge>;
    case "approved":
      return <Badge className="bg-green-500 text-white">Genehmigt</Badge>;
    case "rejected":
      return <Badge variant="destructive">Abgelehnt</Badge>;
    case "resolved":
      return <Badge className="bg-emerald-600 text-white">Erledigt</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Storniert</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "high":
      return <Badge variant="destructive" className="text-xs">Hoch</Badge>;
    case "medium":
      return <Badge className="bg-orange-500 text-white text-xs">Mittel</Badge>;
    case "low":
      return <Badge variant="outline" className="text-xs">Niedrig</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{priority}</Badge>;
  }
}

function ClaimTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    damage: "Schaden",
    misrepresentation: "Falschdarstellung",
    mechanical: "Mechanisch",
    documentation: "Dokumentation",
    other: "Sonstiges",
  };
  return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>;
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

export default function AdminClaims() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["adminClaims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Claim[];
    },
    refetchInterval: 30000,
  });

  const { data: dealerProfiles = {} } = useQuery({
    queryKey: ["adminClaimDealers", claims.map(c => c.dealer_id)],
    queryFn: async () => {
      const dealerIds = [...new Set(claims.map(c => c.dealer_id).filter(Boolean))];
      if (dealerIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_name")
        .in("id", dealerIds);
      const map: Record<string, DealerProfile> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: claims.length > 0,
  });

  // ---- Statistics ----

  const stats = useMemo(() => {
    const total = claims.length;
    const submitted = claims.filter(c => c.status === "submitted").length;
    const inReview = claims.filter(c => c.status === "in_review").length;
    const approved = claims.filter(c => c.status === "approved" || c.status === "resolved").length;
    const rejected = claims.filter(c => c.status === "rejected").length;
    const totalClaimAmount = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
    const totalApproved = claims.reduce((sum, c) => sum + (c.approved_amount || 0), 0);
    const highPriority = claims.filter(c => c.priority === "high" && c.status !== "resolved" && c.status !== "rejected").length;

    return { total, submitted, inReview, approved, rejected, totalClaimAmount, totalApproved, highPriority };
  }, [claims]);

  // ---- Filtering ----

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (statusFilter !== "all" && claim.status !== statusFilter) return false;
      if (priorityFilter !== "all" && claim.priority !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dealer = dealerProfiles[claim.dealer_id];
        const dealerName = dealer
          ? `${dealer.first_name || ""} ${dealer.last_name || ""} ${dealer.company_name || ""}`.toLowerCase()
          : "";
        return (
          claim.title.toLowerCase().includes(q) ||
          claim.description.toLowerCase().includes(q) ||
          claim.claim_type.toLowerCase().includes(q) ||
          dealerName.includes(q) ||
          claim.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [claims, statusFilter, priorityFilter, searchQuery, dealerProfiles]);

  // ---- Mutations ----

  const updateClaimStatus = useMutation({
    mutationFn: async ({ id, status, extras }: { id: string; status: string; extras?: Record<string, any> }) => {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "resolved" || status === "rejected") {
        updateData.resolved_at = new Date().toISOString();
      }
      if (status === "in_review") {
        updateData.reviewed_at = new Date().toISOString();
      }
      if (extras) Object.assign(updateData, extras);

      const { error } = await supabase
        .from("claims")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["adminClaims"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const saveAdminNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("claims")
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notizen gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["adminClaims"] });
    },
  });

  const deleteClaims = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("claims")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast({
        title: `${ids.length} Reklamation${ids.length > 1 ? "en" : ""} gelöscht`,
      });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["adminClaims"] });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler beim Löschen", description: error.message, variant: "destructive" });
    },
  });

  // ---- Handlers ----

  const openDetail = (claim: Claim) => {
    setSelectedClaim(claim);
    setAdminNotes(claim.admin_notes || "");
    setResolutionNotes(claim.resolution_notes || "");
    setApprovedAmount(claim.approved_amount?.toString() || "");
    setDetailDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedClaim) return;
    const extras: Record<string, any> = {
      resolution_notes: resolutionNotes,
      admin_notes: adminNotes,
    };
    if (approvedAmount) {
      extras.approved_amount = parseFloat(approvedAmount);
    }
    updateClaimStatus.mutate({ id: selectedClaim.id, status: "approved", extras });
    setDetailDialogOpen(false);
  };

  const handleReject = () => {
    if (!selectedClaim) return;
    updateClaimStatus.mutate({
      id: selectedClaim.id,
      status: "rejected",
      extras: { resolution_notes: resolutionNotes, admin_notes: adminNotes },
    });
    setDetailDialogOpen(false);
  };

  const handleStartReview = (id: string) => {
    updateClaimStatus.mutate({ id, status: "in_review" });
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
    if (selectedIds.size === filteredClaims.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClaims.map((c) => c.id)));
    }
  };

  const getDealerName = (dealerId: string) => {
    const dealer = dealerProfiles[dealerId];
    if (!dealer) return "Unbekannt";
    if (dealer.company_name) return dealer.company_name;
    return `${dealer.first_name || ""} ${dealer.last_name || ""}`.trim() || "Unbekannt";
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileWarning className="w-6 h-6 text-primary" />
            Reklamationen
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie Händler-Reklamationen und Schadensansprüche
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["adminClaims"] })}
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
          icon={FileWarning}
          description={`${stats.highPriority} mit hoher Priorität`}
          color="bg-blue-500"
        />
        <StatCard
          title="Offen"
          value={stats.submitted + stats.inReview}
          icon={Clock}
          description={`${stats.submitted} neu, ${stats.inReview} in Prüfung`}
          color="bg-orange-500"
        />
        <StatCard
          title="Genehmigt"
          value={stats.approved}
          icon={CheckCircle2}
          description={`${stats.totalApproved.toLocaleString("de-DE")} € genehmigt`}
          color="bg-green-500"
        />
        <StatCard
          title="Gefordert"
          value={`${stats.totalClaimAmount.toLocaleString("de-DE")} €`}
          icon={Euro}
          description={`${stats.rejected} abgelehnt`}
          color="bg-purple-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Titel, Beschreibung, Händler..."
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
            <SelectItem value="submitted">Eingereicht</SelectItem>
            <SelectItem value="in_review">In Prüfung</SelectItem>
            <SelectItem value="approved">Genehmigt</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            <SelectItem value="resolved">Erledigt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
            <SelectItem value="medium">Mittel</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 animate-fade-in">
          <span className="text-sm font-medium">
            {selectedIds.size} Reklamation{selectedIds.size > 1 ? "en" : ""} ausgewählt
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
                  checked={filteredClaims.length > 0 && selectedIds.size === filteredClaims.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Händler</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Betrag</TableHead>
              <TableHead>Priorität</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Eingereicht</TableHead>
              <TableHead className="w-28">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Lade Reklamationen...
                </TableCell>
              </TableRow>
            ) : filteredClaims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Keine Reklamationen gefunden
                </TableCell>
              </TableRow>
            ) : (
              filteredClaims.map((claim) => (
                <TableRow
                  key={claim.id}
                  className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(claim.id) ? "bg-primary/5" : ""}`}
                  onClick={() => openDetail(claim)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(claim.id)}
                      onCheckedChange={() => toggleSelection(claim.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{claim.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{claim.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{getDealerName(claim.dealer_id)}</span>
                  </TableCell>
                  <TableCell>
                    <ClaimTypeBadge type={claim.claim_type} />
                  </TableCell>
                  <TableCell>
                    {claim.claim_amount != null ? (
                      <span className="text-sm font-medium">
                        {claim.claim_amount.toLocaleString("de-DE")} €
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    {claim.approved_amount != null && (
                      <p className="text-xs text-green-600">
                        Genehmigt: {claim.approved_amount.toLocaleString("de-DE")} €
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={claim.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {claim.created_at
                        ? formatDistanceToNow(new Date(claim.created_at), { addSuffix: true, locale: de })
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(claim)} title="Details">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {claim.status === "submitted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartReview(claim.id)}
                          title="Prüfung starten"
                        >
                          <Shield className="w-4 h-4 text-yellow-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteIds([claim.id]);
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ================================================================== */}
      {/* Detail Dialog */}
      {/* ================================================================== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClaim && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileWarning className="w-5 h-5" />
                  {selectedClaim.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  <StatusBadge status={selectedClaim.status} />
                  <PriorityBadge priority={selectedClaim.priority} />
                  <ClaimTypeBadge type={selectedClaim.claim_type} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Claim Details */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Reklamationsdetails
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Beschreibung:</span>
                      <p className="mt-1">{selectedClaim.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Händler:</span>
                        <p className="font-medium">{getDealerName(selectedClaim.dealer_id)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Auktion-ID:</span>
                        <p className="font-mono text-xs">{selectedClaim.auction_id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Geforderter Betrag:</span>
                        <p className="font-medium">
                          {selectedClaim.claim_amount != null
                            ? `${selectedClaim.claim_amount.toLocaleString("de-DE")} €`
                            : "Nicht angegeben"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Eingereicht:</span>
                        <p>
                          {selectedClaim.created_at
                            ? format(new Date(selectedClaim.created_at), "dd.MM.yyyy HH:mm", { locale: de })
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Resolution */}
                {(selectedClaim.status === "submitted" || selectedClaim.status === "in_review") && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Bearbeitung
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Genehmigter Betrag (€)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={approvedAmount}
                          onChange={(e) => setApprovedAmount(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Begründung / Lösung</Label>
                        <Textarea
                          placeholder="Beschreiben Sie die Entscheidung..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </Card>
                )}

                {/* Show resolution if already resolved */}
                {(selectedClaim.status === "approved" || selectedClaim.status === "rejected" || selectedClaim.status === "resolved") && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Entscheidung
                    </h3>
                    <div className="space-y-2 text-sm">
                      {selectedClaim.approved_amount != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Genehmigter Betrag:</span>
                          <span className="font-medium text-green-600">
                            {selectedClaim.approved_amount.toLocaleString("de-DE")} €
                          </span>
                        </div>
                      )}
                      {selectedClaim.resolution_notes && (
                        <div>
                          <span className="text-muted-foreground">Begründung:</span>
                          <p className="mt-1">{selectedClaim.resolution_notes}</p>
                        </div>
                      )}
                      {selectedClaim.resolved_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entschieden am:</span>
                          <span>{format(new Date(selectedClaim.resolved_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Admin Notes */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Admin-Notizen
                  </h3>
                  <Textarea
                    placeholder="Interne Notizen zur Reklamation..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => saveAdminNotes.mutate({ id: selectedClaim.id, notes: adminNotes })}
                    disabled={saveAdminNotes.isPending}
                  >
                    {saveAdminNotes.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Notizen speichern
                  </Button>
                </Card>
              </div>

              <DialogFooter className="mt-4 gap-2">
                {(selectedClaim.status === "submitted" || selectedClaim.status === "in_review") && (
                  <>
                    <Button variant="destructive" onClick={handleReject} disabled={updateClaimStatus.isPending}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Ablehnen
                    </Button>
                    {selectedClaim.status === "submitted" && (
                      <Button
                        variant="outline"
                        onClick={() => handleStartReview(selectedClaim.id)}
                        disabled={updateClaimStatus.isPending}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        In Prüfung nehmen
                      </Button>
                    )}
                    <Button onClick={handleApprove} disabled={updateClaimStatus.isPending} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Genehmigen
                    </Button>
                  </>
                )}
                {selectedClaim.status === "approved" && (
                  <Button
                    onClick={() => {
                      updateClaimStatus.mutate({ id: selectedClaim.id, status: "resolved" });
                      setDetailDialogOpen(false);
                    }}
                    disabled={updateClaimStatus.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Als erledigt markieren
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
              {deleteIds.length === 1 ? "Reklamation löschen" : `${deleteIds.length} Reklamationen löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length === 1
                ? "Möchten Sie diese Reklamation wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden."
                : `Möchten Sie wirklich ${deleteIds.length} Reklamationen löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClaims.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClaims.mutate(deleteIds)}
              disabled={deleteClaims.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteClaims.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
