import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/sessionGuard";
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
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  FileText,
  Search,
  Eye,
  XCircle,
  CheckCircle2,
  Euro,
  Loader2,
  RefreshCw,
  Download,
  Send,
  Ban,
  ExternalLink,
  Car,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { useExport } from "@/hooks/useExport";
import { openPrivateDocument } from "@/lib/storageUtils";
import { AdminPagination } from "@/components/admin/AdminPagination";

// ============================================================================
// Types
// ============================================================================

interface PurchaseContract {
  id: string;
  contract_number: string;
  auction_id: string | null;
  motorhome_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  sale_price: number;
  status: string;
  contract_url: string | null;
  buyer_contract_url: string | null;
  storage_path: string | null;
  buyer_storage_path: string | null;
  buyer_customer_number: string | null;
  seller_name: string | null;
  buyer_name: string | null;
  vehicle_description: string | null;
  created_at: string;
  updated_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500 text-white">Aktiv</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Storniert</Badge>;
    case "amended":
      return <Badge className="bg-yellow-500 text-white">Geändert</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color,
}: {
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
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminContracts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContract, setSelectedContract] =
    useState<PurchaseContract | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelContractId, setCancelContractId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Data Fetching ----

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["adminContracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseContract[];
    },
    refetchInterval: 120000,
    staleTime: 60000,
  });

  // ---- Statistics ----

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => c.status === "active").length;
    const cancelled = contracts.filter((c) => c.status === "cancelled").length;
    const totalVolume = contracts
      .filter((c) => c.status === "active")
      .reduce((sum, c) => sum + (c.sale_price || 0), 0);

    return { total, active, cancelled, totalVolume };
  }, [contracts]);

  // ---- Filtering ----

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      if (statusFilter !== "all" && contract.status !== statusFilter)
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (contract.contract_number || "").toLowerCase().includes(q) ||
          (contract.seller_name || "").toLowerCase().includes(q) ||
          (contract.buyer_name || "").toLowerCase().includes(q) ||
          (contract.vehicle_description || "").toLowerCase().includes(q) ||
          (contract.buyer_customer_number || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contracts, statusFilter, searchQuery]);

  const PAGE_SIZE = 20;

  // Reset Seite bei Filter-Änderung
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // ---- Mutations ----

  const cancelContract = useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("purchase_contracts")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vertrag storniert" });
      queryClient.invalidateQueries({ queryKey: ["adminContracts"] });
      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelContractId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("purchase_contracts")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notizen gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["adminContracts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendContract = useMutation({
    mutationFn: async (contract: PurchaseContract) => {
      if (!contract.buyer_id && !contract.seller_id) {
        throw new Error("Kein Käufer oder Verkäufer zugeordnet");
      }

      const { data, error } = await invokeWithAuth("resend-purchase-contract", {
        body: {
          contractId: contract.id,
          targets: "both",
        },
      });
      if (error) throw error;
      if (data && !data.success) {
        const failedTargets = (data.results || [])
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { target: string; error?: string }) => `${r.target}: ${r.error}`)
          .join(", ");
        throw new Error(failedTargets || "Unbekannter Fehler");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Kaufvertrag erneut an Verkäufer und Käufer gesendet (mit PDF)" });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Senden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ---- Export ----

  const exportData = useMemo(() => {
    return filteredContracts.map((c) => ({
      Vertragsnummer: c.contract_number,
      Status: c.status === "active" ? "Aktiv" : c.status === "cancelled" ? "Storniert" : c.status,
      Verkäufer: c.seller_name || "–",
      Käufer: c.buyer_name || "–",
      Kundennummer: c.buyer_customer_number || "–",
      Fahrzeug: c.vehicle_description || "–",
      Kaufpreis: c.sale_price,
      Erstellt: c.created_at ? format(new Date(c.created_at), "dd.MM.yyyy HH:mm", { locale: de }) : "–",
      Storniert: c.cancelled_at ? format(new Date(c.cancelled_at), "dd.MM.yyyy HH:mm", { locale: de }) : "–",
      Stornierungsgrund: c.cancellation_reason || "–",
      Notizen: c.notes || "–",
    }));
  }, [filteredContracts]);

  const { exportCSV, exportExcel } = useExport({
    filename: "kaufvertraege",
    columns: [
      { key: "Vertragsnummer", label: "Vertragsnummer" },
      { key: "Status", label: "Status" },
      { key: "Verkäufer", label: "Verkäufer" },
      { key: "Käufer", label: "Käufer" },
      { key: "Kundennummer", label: "Kundennummer" },
      { key: "Fahrzeug", label: "Fahrzeug" },
      { key: "Kaufpreis", label: "Kaufpreis" },
      { key: "Erstellt", label: "Erstellt" },
      { key: "Storniert", label: "Storniert" },
      { key: "Stornierungsgrund", label: "Stornierungsgrund" },
      { key: "Notizen", label: "Notizen" },
    ],
  });

  // ---- Detail Dialog ----

  const openDetail = (contract: PurchaseContract) => {
    setSelectedContract(contract);
    setNotes(contract.notes || "");
    setDetailDialogOpen(true);
  };

  // ---- Cancel Dialog ----

  const openCancelDialog = (contractId: string) => {
    setCancelContractId(contractId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  // ---- Render ----

  const totalItems = filteredContracts.length;
  const pageContracts = filteredContracts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kaufverträge</h1>
          <p className="text-muted-foreground">
            Alle Kaufverträge verwalten, stornieren und erneut senden
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["adminContracts"] })
            }
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          <ExportButton
            onExportCSV={() => exportCSV(exportData)}
            onExportExcel={() => exportExcel(exportData)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Gesamt"
          value={stats.total}
          icon={FileText}
          color="bg-blue-500"
        />
        <StatCard
          title="Aktiv"
          value={stats.active}
          icon={CheckCircle2}
          color="bg-green-500"
        />
        <StatCard
          title="Storniert"
          value={stats.cancelled}
          icon={XCircle}
          color="bg-red-500"
        />
        <StatCard
          title="Gesamtvolumen"
          value={formatCurrency(stats.totalVolume)}
          icon={Euro}
          color="bg-emerald-600"
          description="Aktive Verträge"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Vertragsnr., Name, Fahrzeug, Kundennr. ..."
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
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
                <SelectItem value="amended">Geändert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vertragsnr.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verkäufer</TableHead>
                <TableHead>Käufer</TableHead>
                <TableHead>Kundennr.</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead className="text-right">Kaufpreis</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== "all"
                        ? "Keine Verträge gefunden"
                        : "Noch keine Kaufverträge vorhanden"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                pageContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono font-medium">
                      {contract.contract_number}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell>{contract.seller_name || "–"}</TableCell>
                    <TableCell>{contract.buyer_name || "–"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {contract.buyer_customer_number || "–"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {contract.vehicle_description || "–"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(contract.sale_price)}
                    </TableCell>
                    <TableCell>
                      {contract.created_at
                        ? format(new Date(contract.created_at), "dd.MM.yyyy", {
                            locale: de,
                          })
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Details anzeigen"
                          onClick={() => openDetail(contract)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {contract.contract_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="PDF herunterladen"
                            onClick={async () => {
                              await openPrivateDocument(contract.contract_url!, "purchase-contracts");
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {contract.status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Erneut senden"
                              onClick={() => resendContract.mutate(contract)}
                              disabled={resendContract.isPending}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Stornieren"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openCancelDialog(contract.id)}
                            >
                              <Ban className="w-4 h-4" />
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
          </div>
          {totalItems > PAGE_SIZE && (
            <div className="px-4 pb-4">
              <AdminPagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Kaufvertrag {selectedContract?.contract_number}
            </DialogTitle>
            <DialogDescription>
              Vertragsdetails und Verwaltung
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedContract.status} />
                {selectedContract.cancelled_at && (
                  <span className="text-sm text-muted-foreground">
                    Storniert am{" "}
                    {format(
                      new Date(selectedContract.cancelled_at),
                      "dd.MM.yyyy HH:mm",
                      { locale: de }
                    )}
                  </span>
                )}
              </div>

              {/* Contract Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Vertragsnummer
                  </Label>
                  <p className="font-mono font-medium">
                    {selectedContract.contract_number}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Kaufpreis
                  </Label>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedContract.sale_price)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Erstellt am
                  </Label>
                  <p>
                    {selectedContract.created_at
                      ? format(
                          new Date(selectedContract.created_at),
                          "dd.MM.yyyy HH:mm",
                          { locale: de }
                        )
                      : "–"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">
                    Kundennummer
                  </Label>
                  <p className="font-mono">
                    {selectedContract.buyer_customer_number || "–"}
                  </p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Users className="w-3 h-3" /> Verkäufer
                  </Label>
                  <p className="font-medium">
                    {selectedContract.seller_name || "–"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Users className="w-3 h-3" /> Käufer
                  </Label>
                  <p className="font-medium">
                    {selectedContract.buyer_name || "–"}
                  </p>
                </div>
              </div>

              {/* Vehicle */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <Label className="text-muted-foreground text-xs flex items-center gap-1">
                  <Car className="w-3 h-3" /> Fahrzeug
                </Label>
                <p className="font-medium">
                  {selectedContract.vehicle_description || "–"}
                </p>
              </div>

              {/* Cancellation Info */}
              {selectedContract.cancellation_reason && (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <Label className="text-destructive text-xs font-medium">
                    Stornierungsgrund
                  </Label>
                  <p className="text-sm mt-1">
                    {selectedContract.cancellation_reason}
                  </p>
                </div>
              )}

              {/* PDF Links */}
              <div className="flex gap-2">
                {selectedContract.contract_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await openPrivateDocument(selectedContract.contract_url!, "purchase-contracts");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Verkäufer-PDF
                  </Button>
                )}
                {selectedContract.buyer_contract_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await openPrivateDocument(selectedContract.buyer_contract_url!, "purchase-contracts");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Käufer-PDF
                  </Button>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Interne Notizen</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Interne Notizen zum Vertrag..."
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    saveNotes.mutate({
                      id: selectedContract.id,
                      notes,
                    })
                  }
                  disabled={saveNotes.isPending}
                >
                  {saveNotes.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Notizen speichern
                </Button>
              </div>

              {/* Actions */}
              <DialogFooter className="flex gap-2">
                {selectedContract.status === "active" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => resendContract.mutate(selectedContract)}
                      disabled={resendContract.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Erneut senden
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        openCancelDialog(selectedContract.id);
                      }}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Stornieren
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vertrag stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vorgang kann nicht rückgängig gemacht werden. Der Vertrag
              wird als storniert markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Stornierungsgrund</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Grund für die Stornierung eingeben..."
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelContractId) {
                  cancelContract.mutate({
                    id: cancelContractId,
                    reason: cancelReason,
                  });
                }
              }}
              disabled={!cancelReason.trim() || cancelContract.isPending}
            >
              {cancelContract.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
