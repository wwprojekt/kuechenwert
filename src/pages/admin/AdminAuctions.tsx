import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car, Clock, TrendingUp, RotateCw, X, Play, Edit, Trash2,
  Loader2, Mail, MapPin, AlertTriangle, FileEdit, Radio,
  XCircle, CheckCircle2,
} from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AuctionEditDialog } from "@/components/admin/AuctionEditDialog";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

// ============================================================================
// Helper: Send registration invite after activating an auction
// ============================================================================

async function sendRegistrationInviteIfNeeded(motorhomeId: string) {
  try {
    const { data: motorhome, error: mhError } = await supabase
      .from("motorhomes")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name)")
      .eq("id", motorhomeId)
      .maybeSingle();

    if (mhError || !motorhome) {
      logger.warn("Could not load motorhome for invite check:", mhError?.message);
      return;
    }

    const seller = motorhome.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping invite");
      return;
    }

    const customerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ");
    const { data, error } = await supabase.functions.invoke("send-registration-invite", {
      body: {
        email: seller.email,
        customerName: customerName || undefined,
        motorhomeId: motorhome.id,
      },
    });

    if (error) {
      logger.error("Failed to send registration invite:", error.message);
      toast.info(
        `Auktion aktiviert. Registrierungslink an ${seller.email} konnte nicht automatisch gesendet werden.`,
        { duration: 6000 }
      );
      return;
    }

    if (data?.error) {
      logger.error("Registration invite error:", data.error);
      toast.info(
        `Auktion aktiviert. Registrierungslink an ${seller.email} konnte nicht automatisch gesendet werden.`,
        { duration: 6000 }
      );
      return;
    }

    toast.success(
      `Registrierungslink automatisch an ${seller.email} gesendet`,
      { duration: 5000 }
    );
    logger.info(`Registration invite sent to ${seller.email} for motorhome ${motorhome.id}`);
  } catch (err: any) {
    logger.error("Error in sendRegistrationInviteIfNeeded:", err);
  }
}

// ============================================================================
// Tab definitions
// ============================================================================

type TabKey = "draft" | "active" | "kaufchance" | "unsold" | "sold";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  statuses: string[];
  emptyText: string;
  color: string;
}

const TABS: TabDef[] = [
  {
    key: "draft",
    label: "Entwurf",
    icon: FileEdit,
    statuses: ["draft"],
    emptyText: "Keine Entwürfe vorhanden",
    color: "text-slate-600",
  },
  {
    key: "active",
    label: "Laufend",
    icon: Radio,
    statuses: ["active"],
    emptyText: "Keine laufenden Auktionen",
    color: "text-blue-600",
  },
  {
    key: "kaufchance",
    label: "Kaufchance",
    icon: AlertTriangle,
    statuses: ["kaufchance"],
    emptyText: "Keine Kaufchancen vorhanden",
    color: "text-orange-600",
  },
  {
    key: "unsold",
    label: "Nicht verkauft",
    icon: XCircle,
    statuses: ["ended", "cancelled"],
    emptyText: "Keine nicht verkauften Auktionen",
    color: "text-red-600",
  },
  {
    key: "sold",
    label: "Verkauft",
    icon: CheckCircle2,
    statuses: ["sold"],
    emptyText: "Keine verkauften Auktionen",
    color: "text-green-600",
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function AdminAuctions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("draft");

  // ---- Sortierung ----
  const { sortField, sortDirection, handleSort, sortData } = useTableSort('end_time', 'asc');

  const sortAccessors: Record<string, (a: any) => unknown> = {
    vehicle: (a) => `${a.motorhome?.manufacturer || ''} ${a.motorhome?.model || ''}`.trim().toLowerCase(),
    seller: (a) => `${a.motorhome?.seller?.first_name || ''} ${a.motorhome?.seller?.last_name || ''}`.trim().toLowerCase(),
    current_bid: (a) => Number(a.current_bid || a.starting_bid || 0),
    bids_count: (a) => Number(a.bids?.[0]?.count || 0),
    end_time: (a) => a.end_time || '',
    created_at: (a) => a.created_at || '',
  };

  // ---- Data Query ----
  const { data: auctions, isLoading } = useQuery({
    queryKey: ["adminAuctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes (
            id,
            manufacturer,
            model,
            year,
            postal_code,
            city,
            motorhome_photos(url, display_order),
            seller:profiles!left (
              first_name,
              last_name,
              email
            )
          ),
          bids (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // ---- Filter auctions by tab ----
  function getAuctionsForTab(tab: TabDef) {
    if (!auctions) return [];
    return auctions.filter((a) => tab.statuses.includes(a.status));
  }

  // ---- Count per tab ----
  function getCountForTab(tab: TabDef): number {
    if (!auctions) return 0;
    return auctions.filter((a) => tab.statuses.includes(a.status)).length;
  }

  // ---- Handle ?create=motorhomeId URL parameter ----
  const createAuctionMutation = useMutation({
    mutationFn: async (motorhomeId: string) => {
      const { data: existing } = await supabase
        .from("auctions")
        .select("id")
        .eq("motorhome_id", motorhomeId)
        .in("status", ["draft", "active"])
        .maybeSingle();

      if (existing) {
        return { id: existing.id, alreadyExists: true };
      }

      // CRITICAL FIX: Fetch motorhome reserve_price and auto-populate on auction
      const { data: motorhome } = await supabase
        .from("motorhomes")
        .select("reserve_price")
        .eq("id", motorhomeId)
        .single();

      const insertData: Record<string, unknown> = {
        motorhome_id: motorhomeId,
        starting_bid: 50,
        status: "draft",
      };

      // Auto-populate reserve_price from motorhome if available
      if (motorhome?.reserve_price) {
        insertData.reserve_price = motorhome.reserve_price;
      }

      const { data: auction, error } = await supabase
        .from("auctions")
        .insert(insertData)
        .select("id")
        .single();

      if (error) throw error;
      return { id: auction.id, alreadyExists: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      if (result.alreadyExists) {
        toast.info("Es existiert bereits eine Auktion für dieses Fahrzeug");
      } else {
        toast.success("Auktionsentwurf erfolgreich erstellt");
      }
      setSearchParams({});
      setActiveTab("draft");
    },
    onError: (error: any) => {
      toast.error(`Fehler beim Erstellen der Auktion: ${error.message}`);
      logger.error("Create auction error:", error);
      setSearchParams({});
    },
  });

  useEffect(() => {
    const createForMotorhome = searchParams.get("create");
    if (createForMotorhome && !createAuctionMutation.isPending) {
      createAuctionMutation.mutate(createForMotorhome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---- Export ----
  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "auktionen",
    columns: [
      { key: "id", label: "ID" },
      {
        key: "motorhome",
        label: "Fahrzeug",
        format: (value: any) => value ? `${value.manufacturer} ${value.model} (${value.year})` : "",
      },
      {
        key: "motorhome",
        label: "Verkäufer",
        format: (value: any) => value?.seller ? `${value.seller.first_name} ${value.seller.last_name}` : "",
      },
      {
        key: "motorhome",
        label: "Verkäufer E-Mail",
        format: (value: any) => value?.seller?.email || "",
      },
      { key: "status", label: "Status" },
      {
        key: "starting_bid",
        label: "Startgebot",
        format: (value: any) => value ? `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : "",
      },
      {
        key: "current_bid",
        label: "Aktuelles Gebot",
        format: (value: any) => value ? `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : "",
      },
      {
        key: "bids",
        label: "Gebote",
        format: (value: any) => String(value?.[0]?.count || 0),
      },
      {
        key: "start_time",
        label: "Startdatum",
        format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "-",
      },
      {
        key: "end_time",
        label: "Enddatum",
        format: (value: any) => value ? new Date(value).toLocaleDateString("de-DE") : "-",
      },
    ],
  });

  // ---- Mutations ----
  const checkExpiredAuctionsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-expired-auctions', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.successCount} Auktionen erfolgreich geschlossen`);
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Prüfen abgelaufener Auktionen");
      logger.error(error);
    },
  });

  const deleteAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      await supabase.from('bids').delete().eq('auction_id', auctionId);
      const { error } = await supabase.from('auctions').delete().eq('id', auctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich gelöscht");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Löschen der Auktion");
      logger.error(error);
    },
  });

  const closeAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const { data, error } = await supabase.functions.invoke('close-auction', {
        body: { auctionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich geschlossen");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Schließen der Auktion");
      logger.error(error);
    },
  });

  const activateAuctionMutation = useMutation({
    mutationFn: async (auction: { id: string; motorhome_id: string }) => {
      const { data: mh } = await supabase
        .from('motorhomes')
        .select('postal_code, city')
        .eq('id', auction.motorhome_id)
        .maybeSingle();

      if (!mh?.postal_code) {
        throw new Error('PLZ_MISSING');
      }

      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);

      const { error } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          end_time: endTime.toISOString(),
          start_time: new Date().toISOString()
        })
        .eq('id', auction.id);

      if (error) throw error;
      return auction;
    },
    onSuccess: (auction) => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });

      if (auction.motorhome_id) {
        sendRegistrationInviteIfNeeded(auction.motorhome_id);
      }
    },
    onError: (error: any) => {
      if (error?.message === 'PLZ_MISSING') {
        toast.error("Bitte zuerst den Fahrzeugstandort (PLZ) eintragen, bevor die Auktion aktiviert wird. Klicken Sie auf 'Bearbeiten'.", { duration: 6000 });
      } else {
        toast.error("Fehler beim Aktivieren der Auktion");
        logger.error(error);
      }
    },
  });

  // ---- Status Badge ----
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Laufend</Badge>;
      case "sold":
        return <Badge className="bg-green-500 hover:bg-green-600">Verkauft</Badge>;
      case "ended":
        return <Badge className="bg-red-500 hover:bg-red-600">Nicht verkauft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Abgebrochen</Badge>;
      case "draft":
        return <Badge variant="secondary">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ---- Render a single auction row ----
  const renderAuctionRow = (auction: any) => {
    const firstPhoto = [...(auction.motorhome?.motorhome_photos || [])]
      .sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;

    return (
      <TableRow
        key={auction.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => navigate(`/admin/auctions/${auction.id}`)}
      >
        <TableCell>
          <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {firstPhoto ? (
              <img
                src={firstPhoto}
                alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Car className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">
              {auction.motorhome?.manufacturer} {auction.motorhome?.model}
            </p>
            <p className="text-sm text-muted-foreground">
              {auction.motorhome?.year}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="text-sm">
              {auction.motorhome?.seller?.first_name}{" "}
              {auction.motorhome?.seller?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {auction.motorhome?.seller?.email}
            </p>
          </div>
        </TableCell>
        <TableCell>{getStatusBadge(auction.status)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-medium">
              €{Number(auction.current_bid || auction.starting_bid).toLocaleString()}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{auction.bids?.[0]?.count || 0}</Badge>
        </TableCell>
        <TableCell>
          {auction.end_time ? (
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-4 h-4" />
              {format(new Date(auction.end_time), "dd.MM.yyyy HH:mm", {
                locale: de,
              })}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Bearbeiten - immer sichtbar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAuction(auction);
                setShowEditDialog(true);
              }}
              title="Bearbeiten"
            >
              <Edit className="w-4 h-4" />
            </Button>

            {/* Aktivieren - nur bei Entwurf */}
            {auction.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" title="Auktion aktivieren">
                    <Play className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion aktivieren?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-sm text-muted-foreground">
                        Die Auktion wird für 7 Tage aktiviert und ist dann auf der Startseite sichtbar.
                        Händler können ab sofort Gebote abgeben.
                        {!auction.motorhome?.postal_code && (
                          <span className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Achtung: Es wurde noch keine PLZ für den Fahrzeugstandort eingetragen. Bitte zuerst über &quot;Bearbeiten&quot; die PLZ eintragen.</span>
                          </span>
                        )}
                        {auction.motorhome?.seller?.email && (
                          <>
                            <br /><br />
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Mail className="w-3.5 h-3.5" />
                              Ein Registrierungslink wird automatisch an <strong>{auction.motorhome.seller.email}</strong> gesendet.
                            </span>
                          </>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => activateAuctionMutation.mutate({
                        id: auction.id,
                        motorhome_id: auction.motorhome_id,
                      })}
                      disabled={activateAuctionMutation.isPending}
                    >
                      {activateAuctionMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aktivieren...</>
                      ) : (
                        "Aktivieren"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Löschen - nur bei Entwurf */}
            {auction.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Entwurf löschen">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Entwurf löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Der Auktionsentwurf für "{auction.motorhome?.manufacturer} {auction.motorhome?.model}" wird endgültig gelöscht.
                      Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAuctionMutation.mutate(auction.id)}
                      disabled={deleteAuctionMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteAuctionMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Löschen...</>
                      ) : (
                        "Endgültig löschen"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Schließen - bei Laufend oder Nicht verkauft (ended) */}
            {(auction.status === "active" || auction.status === "ended") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Auktion manuell schließen">
                    <X className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion manuell schließen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird manuell geschlossen und der Höchstbietende (falls vorhanden) gewinnt.
                      Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => closeAuctionMutation.mutate(auction.id)}
                      disabled={closeAuctionMutation.isPending}
                    >
                      Schließen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ---- Render table for a tab ----
  const renderTable = (tab: TabDef) => {
    const tabAuctions = sortData(getAuctionsForTab(tab), sortAccessors);

    return (
      <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Bild</TableHead>
              <SortableTableHead field="vehicle" label="Fahrzeug" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead field="seller" label="Verkäufer" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead>Status</TableHead>
              <SortableTableHead field="current_bid" label="Aktuelles Gebot" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead field="bids_count" label="Gebote" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead field="end_time" label="Endet am" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Lädt...
                  </div>
                </TableCell>
              </TableRow>
            ) : tabAuctions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <tab.icon className={`w-8 h-8 ${tab.color} opacity-50`} />
                    <p>{tab.emptyText}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tabAuctions.map(renderAuctionRow)
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Auktionsverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Auktionen auf der Plattform
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV(auctions || [])}
            onExportExcel={() => exportExcel(auctions || [])}
            isExporting={isExporting}
          />
          <Button
            onClick={() => checkExpiredAuctionsMutation.mutate()}
            disabled={checkExpiredAuctionsMutation.isPending}
            className="gap-2"
          >
            <RotateCw className={`w-4 h-4 ${checkExpiredAuctionsMutation.isPending ? 'animate-spin' : ''}`} />
            Abgelaufene prüfen
          </Button>
        </div>
      </div>

      {/* Loading indicator for auto-create from URL parameter */}
      {createAuctionMutation.isPending && (
        <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-blue-800 dark:text-blue-200">Auktionsentwurf wird erstellt...</span>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          {TABS.map((tab) => {
            const count = getCountForTab(tab);
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-2 py-3 data-[state=active]:shadow-sm"
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.key ? "" : tab.color}`} />
                <span>{tab.label}</span>
                {count > 0 && (
                  <Badge
                    variant={activeTab === tab.key ? "secondary" : "outline"}
                    className="ml-1 text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            {renderTable(tab)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      {selectedAuction && (
        <AuctionEditDialog
          auction={selectedAuction}
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAuction(null);
          }}
        />
      )}
    </div>
  );
}
