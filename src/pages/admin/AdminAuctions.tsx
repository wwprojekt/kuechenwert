import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, ensureValidRLSSession } from "@/lib/sessionGuard";
import { cancelAuctionAsAdmin } from "@/lib/adminAuctionCancel";
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
  Car, Clock, TrendingUp, RotateCw, Ban, Play, Edit, Trash2,
  Loader2, Mail, AlertTriangle, FileEdit, Radio,
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
import { activateAuctionForKitchen } from "@/lib/activate-auction";
import { MARKETING_CONFIG } from "@/lib/marketing-config";
import { AUCTION_PUBLIC_COLUMNS } from "@/lib/auction-columns";

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

async function sendRegistrationInviteIfNeeded(kitchenId: string) {
  try {
    const { data: kitchen, error: mhError } = await supabase
      .from("kitchens")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name)")
      .eq("id", kitchenId)
      .maybeSingle();

    if (mhError || !kitchen) {
      logger.warn("Could not load kitchen for invite check:", mhError?.message);
      return;
    }

    const seller = kitchen.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping invite");
      return;
    }

    const customerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ");
    const { data, error } = await invokeWithAuth("send-registration-invite", {
      body: {
        email: seller.email,
        customerName: customerName || undefined,
        kitchenId: kitchen.id,
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
    logger.info(`Registration invite sent to ${seller.email} for kitchen ${kitchen.id}`);
  } catch (err: any) {
    logger.error("Error in sendRegistrationInviteIfNeeded:", err);
  }
}

// ============================================================================
// Helper: Send relist notification to seller (instead of registration invite)
// ============================================================================

async function sendRelistNotification(kitchenId: string, endTime: Date) {
  try {
    const { data: kitchen, error: mhError } = await supabase
      .from("kitchens")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name, customer_number)")
      .eq("id", kitchenId)
      .maybeSingle();

    if (mhError || !kitchen) {
      logger.warn("Could not load kitchen for relist notification:", mhError?.message);
      return;
    }

    const seller = kitchen.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping relist notification");
      return;
    }

    const sellerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ") || "";
    const vehicleName = [kitchen.manufacturer, kitchen.model].filter(Boolean).join(" ") || "Ihr Fahrzeug";
    const formattedEndTime = format(endTime, "dd.MM.yyyy HH:mm", { locale: de });

    const { error } = await invokeWithAuth("send-auction-notification", {
      body: {
        email: seller.email,
        name: sellerName,
        type: "seller_relisted",
        kitchenModel: vehicleName,
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
    logger.info(`Relist notification sent to ${seller.email} for kitchen ${kitchen.id}`);
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
  const bidderFilter = searchParams.get("bidder")?.trim() ?? "";
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("draft");

  // ---- Sortierung ----
  const { sortField, sortDirection, handleSort, sortData } = useTableSort('end_time', 'asc');

  const sortAccessors: Record<string, (a: any) => unknown> = {
    vehicle: (a) => `${a.kitchen?.manufacturer || ''} ${a.kitchen?.model || ''}`.trim().toLowerCase(),
    seller: (a) => `${a.kitchen?.seller?.first_name || ''} ${a.kitchen?.seller?.last_name || ''}`.trim().toLowerCase(),
    current_bid: (a) => a.kitchen?.sale_channel === 'instant_price'
      ? Number(a.kitchen?.instant_price || 0)
      : Number(a.current_bid || a.starting_bid || 0),
    bids_count: (a) => Number(a.bids?.[0]?.count || 0),
    end_time: (a) => a.end_time || '',
    created_at: (a) => a.created_at || '',
  };

  // ---- Data Query ----
  const { data: auctions, isLoading, error: queryError } = useQuery({
    queryKey: ["adminAuctions", bidderFilter],
    queryFn: async () => {
      // P4-Hardening: explizite Spalten statt '*' (Tabellen-SELECT auf
      // public.auctions ist für authenticated revoked, '*' wirft 42501).
      // Owner-only Felder werden weiter unten via Bulk-RPC nachgeladen.
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          ${AUCTION_PUBLIC_COLUMNS},
          kitchen:kitchens (
            id,
            manufacturer,
            model,
            year,
            postal_code,
            city,
            sale_channel,
            instant_price,
            kitchen_photos(url, card_url, medium_url, display_order),
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
      let list = data || [];
      if (bidderFilter) {
        const { data: bidRows, error: bidErr } = await supabase
          .from("bids")
          .select("auction_id")
          .eq("bidder_id", bidderFilter);
        if (bidErr) throw bidErr;
        const ids = new Set((bidRows || []).map((r) => r.auction_id));
        list = list.filter((a) => ids.has(a.id));
      }

      // P4-Hardening (Audit Round 3, Bug #14/#15): owner-only Felder
      // (auto_relist, dynamic_pricing, marketing_phase_max_until,
      // agb_version_at_start) sind seit column-REVOKE NICHT mehr direkt
      // selectable für authenticated/anon. select("*") liefert sie
      // PostgREST-bedingt einfach nicht zurück. Admin braucht sie aber
      // für Status-Anzeigen und Toggles → via Bulk-RPC nachladen.
      const auctionIds = list.map((a) => a.id).filter(Boolean) as string[];
      if (auctionIds.length > 0) {
        const { data: metaRows } = await supabase.rpc(
          "get_auctions_owner_meta_bulk",
          { p_auction_ids: auctionIds },
        );
        const metaByAuction = new Map<string, {
          auto_relist: boolean | null;
          dynamic_pricing: boolean | null;
          marketing_phase_max_until: string | null;
          agb_version_at_start: string | null;
          seller_initial_reserve: number | null;
          seller_initial_instant_price: number | null;
        }>();
        for (const row of (metaRows || []) as Array<{
          auction_id: string;
          auto_relist: boolean | null;
          dynamic_pricing: boolean | null;
          marketing_phase_max_until: string | null;
          agb_version_at_start: string | null;
          seller_initial_reserve: number | null;
          seller_initial_instant_price: number | null;
        }>) {
          metaByAuction.set(row.auction_id, {
            auto_relist: row.auto_relist,
            dynamic_pricing: row.dynamic_pricing,
            marketing_phase_max_until: row.marketing_phase_max_until,
            agb_version_at_start: row.agb_version_at_start,
            seller_initial_reserve: row.seller_initial_reserve,
            seller_initial_instant_price: row.seller_initial_instant_price,
          });
        }
        for (const a of list) {
          const meta = metaByAuction.get(a.id);
          if (meta) {
            (a as Record<string, unknown>).auto_relist = meta.auto_relist;
            (a as Record<string, unknown>).dynamic_pricing = meta.dynamic_pricing;
            (a as Record<string, unknown>).marketing_phase_max_until = meta.marketing_phase_max_until;
            (a as Record<string, unknown>).agb_version_at_start = meta.agb_version_at_start;
            (a as Record<string, unknown>).seller_initial_reserve = meta.seller_initial_reserve;
            (a as Record<string, unknown>).seller_initial_instant_price = meta.seller_initial_instant_price;
          }
        }
      }

      return list;
    },
  });

  const overdueActiveCount = useMemo(() => {
    if (!auctions) return 0;
    return auctions.filter(
      (a) =>
        a.status === "active" &&
        a.end_time &&
        isPast(new Date(a.end_time)),
    ).length;
  }, [auctions]);

  // ---- Filter auctions by tab ----
  function getAuctionsForTab(tab: TabDef) {
    if (!auctions) return [];
    let list = auctions.filter((a) => tab.statuses.includes(a.status));
    if (tab.key === "active") {
      list = [...list].sort((a, b) => {
        const aOd =
          a.status === "active" && a.end_time && isPast(new Date(a.end_time))
            ? 0
            : 1;
        const bOd =
          b.status === "active" && b.end_time && isPast(new Date(b.end_time))
            ? 0
            : 1;
        if (aOd !== bOd) return aOd - bOd;
        const ae = a.end_time ? new Date(a.end_time).getTime() : 0;
        const be = b.end_time ? new Date(b.end_time).getTime() : 0;
        return ae - be;
      });
    }
    return list;
  }

  // ---- Count per tab ----
  function getCountForTab(tab: TabDef): number {
    if (!auctions) return 0;
    return auctions.filter((a) => tab.statuses.includes(a.status)).length;
  }

  // ---- Handle ?create=kitchenId URL parameter ----
  // Aktivierung läuft über den zentralen Helper `activateAuctionForKitchen`,
  // der MARKETING_CONFIG (3-Tage-Dauer, Random-Startbid 40-60 %, seller_initial_*)
  // anwendet. NICHT inline duplizieren – alle Aktivierungen müssen identisch sein.
  const createAuctionMutation = useMutation({
    mutationFn: async (kitchenId: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session expired");

      const result = await activateAuctionForKitchen(kitchenId);
      return {
        id: result.auctionId,
        kitchenId,
        alreadyExists: result.alreadyActive,
        recycled: result.recycled,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      if (result.alreadyExists) {
        toast.info("Es existiert bereits eine laufende Auktion für dieses Fahrzeug");
      } else if (result.recycled) {
        toast.success(`Auktion wurde zurückgesetzt und ist jetzt live (${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage)`);
      } else {
        toast.success(`Auktion erfolgreich erstellt und ist jetzt live (${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage)`);
      }
      setSearchParams({});
      setActiveTab("active");

      // Registrierungseinladung senden falls nötig
      if (result.kitchenId) {
        sendRegistrationInviteIfNeeded(result.kitchenId);
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
    const createForKitchen = searchParams.get("create");
    if (createForKitchen && !createAuctionMutation.isPending) {
      createAuctionMutation.mutate(createForKitchen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---- Export ----
  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "auktionen",
    columns: [
      { key: "id", label: "ID" },
      {
        key: "kitchen",
        label: "Fahrzeug",
        format: (value: any) => value ? `${value.manufacturer} ${value.model} (${value.year})` : "",
      },
      {
        key: "kitchen",
        label: "Verkäufer",
        format: (value: any) => value?.seller ? `${value.seller.first_name} ${value.seller.last_name}` : "",
      },
      {
        key: "kitchen",
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
      const { data, error } = await invokeWithAuth('check-expired-auctions', {
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

  const cancelAuctionMutation = useMutation({
    mutationFn: (auctionId: string) => cancelAuctionAsAdmin(auctionId),
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.expiredOffersCount > 0) parts.push(`${result.expiredOffersCount} Angebote storniert`);
      if (result.uniqueBiddersNotified > 0) parts.push(`${result.uniqueBiddersNotified} Bieter informiert`);
      if (result.sellerMailSent) parts.push("Verkäufer informiert");
      const suffix = parts.length ? ` · ${parts.join(" · ")}` : "";
      toast.success(`Auktion erfolgreich abgebrochen${suffix}`);
      if (result.bidderMailsFailed > 0 || (!result.sellerMailSent && result.sellerMailError)) {
        toast.warning("Einige Benachrichtigungen konnten nicht versendet werden – siehe Error Logs");
      }
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminPostAuctionOffers"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Abbrechen der Auktion");
      logger.error(error);
    },
  });

  // Aktiviert eine bestehende (Draft-)Auktion. Verwendet den zentralen
  // Helper, damit MARKETING_CONFIG-Dauer + Random-Startbid + seller_initial_*
  // konsistent gesetzt werden – auch wenn diese Auktion vom auto-convert-
  // wizard angelegt wurde.
  const activateAuctionMutation = useMutation({
    mutationFn: async (auction: { id: string; kitchen_id: string }) => {
      await activateAuctionForKitchen(auction.kitchen_id);
      return auction;
    },
    onSuccess: (auction) => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });

      if (auction.kitchen_id) {
        sendRegistrationInviteIfNeeded(auction.kitchen_id);
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
  // Manueller Admin-Relist eines beendeten Inserats. Nutzt activateAuctionForKitchen
  // für 3-Tage-Dauer + Random-Startbid; auction_round wird vom DB-Trigger NICHT
  // hochgesetzt – wir machen das hier explizit, damit der Soft-Brake greift.
  const relistAuctionMutation = useMutation({
    mutationFn: async (auction: { id: string; kitchen_id: string }) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session expired");

      // Aktuelle Runde lesen (für Auto-Increment)
      const { data: currentAuction } = await supabase
        .from('auctions')
        .select('auction_round')
        .eq('id', auction.id)
        .single();

      // Hauptaktivierung über zentralen Helper (resettet inkl. bids/invitations/offers)
      const result = await activateAuctionForKitchen(auction.kitchen_id);

      // auction_round + auto_relist nachziehen (Helper resettet auf 1 –
      // das ist für reine Recyles korrekt, beim manuellen Relist wollen
      // wir aber die Runde fortsetzen, damit Soft-Brake greift).
      const nextRound = (currentAuction?.auction_round ?? 1) + 1;
      const { error: roundErr } = await supabase
        .from('auctions')
        .update({ auction_round: nextRound, auto_relist: true })
        .eq('id', result.auctionId);
      if (roundErr) throw roundErr;

      // endTime (3 Tage ab now) für Notification rekonstruieren
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + MARKETING_CONFIG.AUCTION_DURATION_DAYS);

      return { ...auction, endTime };
    },
    onSuccess: (result) => {
      toast.success("Auktion erfolgreich erneut gestartet");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminKitchens"] });

      // Send relist notification to seller (NOT registration invite)
      if (result.kitchen_id) {
        sendRelistNotification(result.kitchen_id, result.endTime);
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
      case "kaufchance":
        return <Badge className="bg-amber-600 hover:bg-amber-700">Kaufchance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ---- Render a single auction row ----
  const renderAuctionRow = (auction: any) => {
    const firstPhotoObj = [...(auction.kitchen?.kitchen_photos || [])]
      .sort((a: any, b: any) => a.display_order - b.display_order)[0];
    const firstPhoto = firstPhotoObj?.card_url || firstPhotoObj?.url;

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
                alt={`${auction.kitchen?.manufacturer} ${auction.kitchen?.model}`}
                loading="lazy"
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
              {auction.kitchen?.manufacturer} {auction.kitchen?.model}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm text-muted-foreground">{auction.kitchen?.year}</span>
              {auction.kitchen?.sale_channel === 'instant_price' && (
                <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Festpreis</Badge>
              )}
              {auction.kitchen?.sale_channel === 'auction' && auction.kitchen?.instant_price > 0 && (
                <Badge className="bg-purple-500 text-white text-[10px] px-1.5 py-0">+Sofortkauf</Badge>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="text-sm">
              {auction.kitchen?.seller?.first_name}{" "}
              {auction.kitchen?.seller?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {auction.kitchen?.seller?.email}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {getStatusBadge(auction.status)}
            {(auction.auction_round ?? 1) > 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">R{auction.auction_round}</Badge>
            )}
            {auction.status === 'kaufchance' && auction.auto_relist === false && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">kein Relist</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-4 h-4 ${(auction as any).kitchen?.sale_channel === 'instant_price' ? 'text-yellow-500' : 'text-primary'}`} />
            <span className="font-medium">
              €{Number((auction as any).kitchen?.sale_channel === 'instant_price'
                ? ((auction as any).kitchen?.instant_price || 0)
                : (auction.current_bid || auction.starting_bid)
              ).toLocaleString()}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {(auction as any).kitchen?.sale_channel === 'instant_price'
            ? <Badge variant="outline" className="text-yellow-600 border-yellow-300">—</Badge>
            : <Badge variant="outline">{auction.bids?.[0]?.count || 0}</Badge>
          }
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
                        {!auction.kitchen?.postal_code && (
                          <span className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Achtung: Es wurde noch keine PLZ für den Fahrzeugstandort eingetragen. Bitte zuerst über &quot;Bearbeiten&quot; die PLZ eintragen.</span>
                          </span>
                        )}
                        {auction.kitchen?.seller?.email && (
                          <>
                            <br /><br />
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Mail className="w-3.5 h-3.5" />
                              Ein Registrierungslink wird automatisch an <strong>{auction.kitchen.seller.email}</strong> gesendet.
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
                        kitchen_id: auction.kitchen_id,
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
                      Der Auktionsentwurf für "{auction.kitchen?.manufacturer} {auction.kitchen?.model}" wird endgültig gelöscht.
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
                        Das Fahrzeug &quot;{auction.kitchen?.manufacturer} {auction.kitchen?.model}&quot; wird erneut f\u00fcr 7 Tage in die Auktion aufgenommen.
                        Alle bisherigen Gebote werden zur\u00fcckgesetzt.
                        {!auction.kitchen?.postal_code && (
                          <span className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Achtung: Es wurde noch keine PLZ f\u00fcr den Fahrzeugstandort eingetragen.</span>
                          </span>
                        )}
                        {auction.kitchen?.seller?.email && (
                          <>
                            <br /><br />
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Mail className="w-3.5 h-3.5" />
                              Der Verk\u00e4ufer <strong>{auction.kitchen.seller.email}</strong> wird automatisch per E-Mail informiert.
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
                        kitchen_id: auction.kitchen_id,
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

            {/* Abbrechen - bei Laufend oder Kaufchance */}
            {(auction.status === "active" || auction.status === "kaufchance") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Auktion abbrechen">
                    <Ban className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion abbrechen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird abgebrochen. Es werden keine Benachrichtigungen an Bieter oder Verkäufer versendet.
                      Der Verkäufer kann sein Inserat danach wieder bearbeiten und Fotos hochladen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zurück</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelAuctionMutation.mutate(auction.id)}
                      disabled={cancelAuctionMutation.isPending}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Abbrechen
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
        const vehicle = `${a.kitchen?.manufacturer || ""} ${a.kitchen?.model || ""}`.toLowerCase();
        const seller = `${a.kitchen?.seller?.first_name || ""} ${a.kitchen?.seller?.last_name || ""} ${a.kitchen?.seller?.email || ""}`.toLowerCase();
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
            onExportCSV={() =>
              exportCSV(
                getFilteredAuctionsForTab(TABS.find((t) => t.key === activeTab)!),
              )
            }
            onExportExcel={() =>
              exportExcel(
                getFilteredAuctionsForTab(TABS.find((t) => t.key === activeTab)!),
              )
            }
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

      {/* Error state */}
      {queryError && (
        <Card className="p-4 border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Fehler beim Laden der Auktionen
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {queryError.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-400 text-red-700 shrink-0"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["adminAuctions"] })}
            >
              <RotateCw className="w-4 h-4 mr-1" />
              Erneut laden
            </Button>
          </div>
        </Card>
      )}

      {overdueActiveCount > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-700 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-950 dark:text-amber-50">
                <strong>{overdueActiveCount}</strong> Auktion(en) sind abgelaufen, stehen aber noch auf „Laufend“. In der
                Datenbank gibt es noch keinen Kaufchance-Status und keine Einladungen – das passiert erst nach dem Schließen.
                Händler finden diese Fälle unter <strong>Dashboard → Kaufchancen</strong> („Auswertung ausstehend“) und{" "}
                <strong>Meine Gebote</strong>, nicht mehr in der Liste „Aktive Auktionen“.                 Normalerweise schließt der Server diese Auktionen automatisch (pg_cron ruft jede Minute
                „check-expired-auctions“ auf). Wenn der Hinweis länger bleibt, bitte einmal „Abgelaufene prüfen“
                ausführen oder die Logs der Edge Functions prüfen.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-700 text-amber-950 shrink-0 dark:text-amber-50"
              onClick={() => checkExpiredAuctionsMutation.mutate()}
              disabled={checkExpiredAuctionsMutation.isPending}
            >
              <RotateCw className={`w-4 h-4 mr-2 ${checkExpiredAuctionsMutation.isPending ? "animate-spin" : ""}`} />
              Jetzt prüfen
            </Button>
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
        <TabsList className="flex h-auto gap-1 flex-nowrap overflow-x-auto no-scrollbar w-full justify-start sm:flex-wrap sm:justify-center">
          {TABS.map((tab) => {
            const count = getCountForTab(tab);
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-1.5 py-2 px-3 data-[state=active]:shadow-sm text-sm flex-shrink-0 whitespace-nowrap"
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.key ? "" : tab.color}`} />
                <span>{tab.label}</span>
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
