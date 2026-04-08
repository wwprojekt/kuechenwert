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
import { format, differenceInHours, differenceInMinutes, isPast } from "date-fns";
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
import { AdminPagination } from "@/components/admin/AdminPagination";

// ============================================================================
// Live Countdown for active auctions
// ============================================================================

function InlineCountdown({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(endTime);
  if (isPast(end)) return <Badge variant="destructive" className="text-[10px]">Abgelaufen</Badge>;
  const h = differenceInHours(end, now);
  const m = differenceInMinutes(end, now) % 60;
  if (h < 1) return <Badge className="bg-red-500 text-white text-[10px] animate-pulse">{m}min</Badge>;
  if (h < 6) return <Badge className="bg-orange-500 text-white text-[10px]">{h}h {m}m</Badge>;
  if (h < 24) return <Badge className="bg-amber-500 text-white text-[10px]">{h}h {m}m</Badge>;
  return <span className="text-xs text-muted-foreground">{Math.floor(h / 24)}T {h % 24}h</span>;
}

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
// Helper: Send relist notification to seller (instead of registration invite)
// ============================================================================

async function sendRelistNotification(motorhomeId: string, endTime: Date) {
  try {
    const { data: motorhome, error: mhError } = await supabase
      .from("motorhomes")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name, customer_number)")
      .eq("id", motorhomeId)
      .maybeSingle();

    if (mhError || !motorhome) {
      logger.warn("Could not load motorhome for relist notification:", mhError?.message);
      return;
    }

    const seller = motorhome.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping relist notification");
      return;
    }

    const sellerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ") || "";
    const vehicleName = [motorhome.manufacturer, motorhome.model].filter(Boolean).join(" ") || "Ihr Fahrzeug";
    const formattedEndTime = format(endTime, "dd.MM.yyyy HH:mm", { locale: de });

    const { data, error } = await supabase.functions.invoke("send-auction-notification", {
      body: {
        email: seller.email,
        name: sellerName,
        type: "seller_relisted",
        motorhomeModel: vehicleName,
        auctionUrl: "https://caravanwert.de/dashboard",
        endTime: formattedEndTime,
        customerNumber: seller.customer_number || undefined,
      },
    });

    if (error) {
      logger.error("Failed to send relist notification:", error.message);
      toast.info(
        `Auktion erneut gestartet. Benachrichtigung an ${seller.email} konnte nicht gesendet werden.`,
        { duration: 6000 }
      );
      return;
    }

    toast.success(
      `Verk\u00e4ufer ${seller.email} wurde \u00fcber die erneute Auktion informiert`,
      { duration: 5000 }
    );
    logger.info(`Relist notification sent to ${seller.email} for motorhome ${motorhome.id}`);
  } catch (err: any) {
    logger.error("Error in sendRelistNotification:", err);
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
      // Prüfe ob IRGENDEINE Auktion für dieses Motorhome existiert (egal welcher Status)
      const { data: existing } = await supabase
        .from("auctions")
        .select("id, status")
        .eq("motorhome_id", motorhomeId)
        .maybeSingle();

      // Fetch motorhome Daten (reserve_price + PLZ-Check)
      const { data: motorhome } = await supabase
        .from("motorhomes")
        .select("reserve_price, postal_code, city")
        .eq("id", motorhomeId)
        .single();

      // PLZ-Check: Ohne PLZ kann keine Auktion live gehen
      if (!motorhome?.postal_code) {
        throw new Error("PLZ_MISSING");
      }

      // Auktionszeiten: Sofort live, 7 Tage Laufzeit
      const now = new Date();
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);

      if (existing) {
        // Wenn Auktion bereits active ist, einfach dorthin navigieren
        if (existing.status === "active") {
          return { id: existing.id, motorhomeId, alreadyExists: true, recycled: false };
        }

        // Bestehende Auktion recyceln und sofort aktivieren
        const updateData: Record<string, unknown> = {
          status: "active",
          starting_bid: 50,
          current_bid: null,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          kaufchance_expires_at: null,
          kaufchance_min_price: null,
        };

        if (motorhome?.reserve_price) {
          updateData.reserve_price = motorhome.reserve_price;
        }

        const { error: updateError } = await supabase
          .from("auctions")
          .update(updateData)
          .eq("id", existing.id);

        if (updateError) throw updateError;

        // Alte Bids und Kaufchance-Daten aufräumen
        await supabase.from("bids").delete().eq("auction_id", existing.id);
        await supabase.from("kaufchance_invitations").delete().eq("auction_id", existing.id);
        await supabase.from("post_auction_offers").delete().eq("auction_id", existing.id);

        // Motorhome-Status auf active setzen
        await supabase.from("motorhomes").update({ status: "active" }).eq("id", motorhomeId);

        return { id: existing.id, motorhomeId, alreadyExists: false, recycled: true };
      }

      // Keine Auktion vorhanden: Neue erstellen und sofort aktivieren
      const insertData: Record<string, unknown> = {
        motorhome_id: motorhomeId,
        starting_bid: 50,
        status: "active",
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
      };

      if (motorhome?.reserve_price) {
        insertData.reserve_price = motorhome.reserve_price;
      }

      const { data: auction, error } = await supabase
        .from("auctions")
        .insert(insertData)
        .select("id")
        .single();

      if (error) throw error;

      // Motorhome-Status auf active setzen
      await supabase.from("motorhomes").update({ status: "active" }).eq("id", motorhomeId);

      return { id: auction.id, motorhomeId, alreadyExists: false, recycled: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      if (result.alreadyExists) {
        toast.info("Es existiert bereits eine laufende Auktion für dieses Fahrzeug");
      } else if (result.recycled) {
        toast.success("Auktion wurde zurückgesetzt und ist jetzt live (7 Tage)");
      } else {
        toast.success("Auktion erfolgreich erstellt und ist jetzt live (7 Tage)");
      }
      setSearchParams({});
      setActiveTab("active");

      // Registrierungseinladung senden falls nötig
      if (result.motorhomeId) {
        sendRegistrationInviteIfNeeded(result.motorhomeId);
      }
    },
    onError: (error: any) => {
      if (error?.message === "PLZ_MISSING") {
        toast.error("Bitte zuerst den Fahrzeugstandort (PLZ) eintragen, bevor die Auktion gestartet werden kann. Klicken Sie auf 'Bearbeiten'.", { duration: 6000 });
      } else {
        toast.error(`Fehler beim Erstellen der Auktion: ${error.message}`);
        logger.error("Create auction error:", error);
      }
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

  // ---- Relist Auction (ended/cancelled -> active) ----
  const relistAuctionMutation = useMutation({
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

      // Reset auction to active with new 7-day period
      const { error } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          start_time: new Date().toISOString(),
          end_time: endTime.toISOString(),
          current_bid: null,
          kaufchance_expires_at: null,
          kaufchance_min_price: null,
        })
        .eq('id', auction.id);

      if (error) throw error;

      // Update motorhome status back to active
      await supabase
        .from('motorhomes')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', auction.motorhome_id);

      // Delete old bids for a fresh start
      await supabase
        .from('bids')
        .delete()
        .eq('auction_id', auction.id);

      return { ...auction, endTime };
    },
    onSuccess: (result) => {
      toast.success("Auktion erfolgreich erneut gestartet");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });

      // Send relist notification to seller (NOT registration invite)
      if (result.motorhome_id) {
        sendRelistNotification(result.motorhome_id, result.endTime);
      }
    },
    onError: (error: any) => {
      if (error?.message === 'PLZ_MISSING') {
        toast.error("Bitte zuerst den Fahrzeugstandort (PLZ) eintragen, bevor die Auktion erneut gestartet werden kann.", { duration: 6000 });
      } else {
        toast.error("Fehler beim erneuten Starten der Auktion");
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
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(auction.end_time), "dd.MM. HH:mm", { locale: de })}
              </div>
              {auction.status === "active" && <InlineCountdown endTime={auction.end_time} />}
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

            {/* Erneut in die Auktion - bei ended oder cancelled */}
            {(auction.status === "ended" || auction.status === "cancelled") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" title="Erneut in die Auktion">
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Erneut in die Auktion?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-sm text-muted-foreground">
                        Das Fahrzeug &quot;{auction.motorhome?.manufacturer} {auction.motorhome?.model}&quot; wird erneut f\u00fcr 7 Tage in die Auktion aufgenommen.
                        Alle bisherigen Gebote werden zur\u00fcckgesetzt.
                        {!auction.motorhome?.postal_code && (
                          <span className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Achtung: Es wurde noch keine PLZ f\u00fcr den Fahrzeugstandort eingetragen.</span>
                          </span>
                        )}
                        {auction.motorhome?.seller?.email && (
                          <>
                            <br /><br />
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Mail className="w-3.5 h-3.5" />
                              Der Verk\u00e4ufer <strong>{auction.motorhome.seller.email}</strong> wird automatisch per E-Mail informiert.
                            </span>
                          </>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => relistAuctionMutation.mutate({
                        id: auction.id,
                        motorhome_id: auction.motorhome_id,
                      })}
                      disabled={relistAuctionMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {relistAuctionMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starten...</>
                      ) : (
                        <>\u21BB Erneut in die Auktion</>
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
  // ---- Search + Pagination ----
  const [auctionSearch, setAuctionSearch] = useState("");
  const [auctionPage, setAuctionPage] = useState(1);
  const PAGE_SIZE = 20;

  function getFilteredAuctionsForTab(tab: TabDef) {
    let items = getAuctionsForTab(tab);
    if (auctionSearch.trim()) {
      const q = auctionSearch.toLowerCase().trim();
      items = items.filter((a: any) => {
        const vehicle = `${a.motorhome?.manufacturer || ""} ${a.motorhome?.model || ""}`.toLowerCase();
        const seller = `${a.motorhome?.seller?.first_name || ""} ${a.motorhome?.seller?.last_name || ""} ${a.motorhome?.seller?.email || ""}`.toLowerCase();
        return vehicle.includes(q) || seller.includes(q);
      });
    }
    return items;
  }

  // Reset Seite bei Tab-/Suchwechsel
  useEffect(() => { setAuctionPage(1); }, [activeTab, auctionSearch]);

  const renderTable = (tab: TabDef) => {
    const filtered = getFilteredAuctionsForTab(tab);
    const sorted = sortData(filtered, sortAccessors);
    const totalItems = sorted.length;
    const pageItems = sorted.slice((auctionPage - 1) * PAGE_SIZE, auctionPage * PAGE_SIZE);

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
            ) : pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <tab.icon className={`w-8 h-8 ${tab.color} opacity-50`} />
                    <p>{auctionSearch ? "Keine Treffer für diese Suche" : tab.emptyText}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map(renderAuctionRow)
            )}
          </TableBody>
        </Table>
        </div>
        {totalItems > PAGE_SIZE && (
          <div className="px-4 pb-4">
            <AdminPagination
              page={auctionPage}
              pageSize={PAGE_SIZE}
              totalItems={totalItems}
              onPageChange={setAuctionPage}
            />
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Auktionsverwaltung</h1>
          <p className="text-muted-foreground text-sm">
            Verwalten Sie alle Auktionen auf der Plattform
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ExportButton
            onExportCSV={() => exportCSV(auctions || [])}
            onExportExcel={() => exportExcel(auctions || [])}
            isExporting={isExporting}
          />
          <Button
            onClick={() => checkExpiredAuctionsMutation.mutate()}
            disabled={checkExpiredAuctionsMutation.isPending}
            className="gap-2"
            size="sm"
          >
            <RotateCw className={`w-4 h-4 ${checkExpiredAuctionsMutation.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Abgelaufene prüfen</span>
            <span className="sm:hidden">Prüfen</span>
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

      {/* Suchfeld */}
      <div className="relative max-w-sm">
        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Fahrzeug oder Verkäufer suchen…"
          value={auctionSearch}
          onChange={(e) => setAuctionSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TABS.map((tab) => {
            const count = getCountForTab(tab);
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-1.5 py-2 px-3 data-[state=active]:shadow-sm text-sm"
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.key ? "" : tab.color}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <Badge
                    variant={activeTab === tab.key ? "secondary" : "outline"}
                    className="ml-0.5 text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center"
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
