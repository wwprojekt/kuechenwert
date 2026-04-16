import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MoreHorizontal, Eye, Edit, Trash2, Gavel, Car, Phone,
  Search, Package, Radio, XCircle, CheckCircle2, ArrowUpDown,
  ArrowUp, ArrowDown, ImageOff, Camera, AlertTriangle,
  Play, Ban,
} from "lucide-react";
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
import { MotorhomeDetailDialog } from "@/components/admin/MotorhomeDetailDialog";
import { MotorhomeEditDialog } from "@/components/admin/MotorhomeEditDialog";
import { DeleteMotorhomeDialog } from "@/components/admin/DeleteMotorhomeDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

// ============================================================================
// Types
// ============================================================================

interface AuctionInfo {
  id: string;
  status: string;
  current_bid: number | null;
  starting_bid: number;
  start_time: string | null;
  end_time: string | null;
}

interface MotorhomeWithRelations {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  body_type: string;
  description: string | null;
  sale_channel: string;
  instant_price: number | null;
  reserve_price: number | null;
  fuel_type: string | null;
  power_kw: number | null;
  engine_power_hp: number | null;
  transmission: string | null;
  emission_class: string | null;
  first_registration: string | null;
  tuev_valid_until: string | null;
  previous_owners: number | null;
  accident_free: boolean | null;
  non_smoker: boolean | null;
  service_history_available: boolean | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  payload_kg: number | null;
  number_of_axles: number | null;
  seats: number | null;
  sleeping_places: number | null;
  beds_description: string | null;
  has_kitchen: boolean | null;
  heating_type: string | null;
  air_conditioning_type: string | null;
  has_toilet: boolean | null;
  has_shower: boolean | null;
  has_bathroom: boolean;
  water_tank_liters: number | null;
  grey_water_capacity_liters: number | null;
  has_solar: boolean;
  solar_power_watts: number | null;
  battery_capacity_ah: number | null;
  has_inverter: boolean | null;
  has_awning: boolean;
  awning_length_m: number | null;
  has_bike_rack: boolean | null;
  has_garage: boolean | null;
  has_tv: boolean | null;
  has_backup_camera: boolean | null;
  has_parking_sensors: boolean | null;
  has_cruise_control: boolean | null;
  has_central_locking: boolean | null;
  additional_equipment: string | null;
  vehicle_identification_number: string | null;
  license_plate: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  sold_at: string | null;
  sold_to: string | null;
  seller_id?: string;
  seller?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
  } | null;
  motorhome_photos?: Array<{ url: string; display_order: number }>;
  auctions?: AuctionInfo | AuctionInfo[] | null;
}

type TabKey = "alle" | "vorbereitung" | "in_auktion" | "kaufchance" | "nicht_verkauft" | "verkauft";
type SortKey = "created_at" | "year" | "mileage" | "manufacturer";
type SortDir = "asc" | "desc";

// ============================================================================
// Helpers
// ============================================================================

/** Extracts the most relevant auction from the Supabase relation (may be object or array). */
function getActiveAuction(auctions: AuctionInfo | AuctionInfo[] | null | undefined): AuctionInfo | null {
  if (!auctions || typeof auctions === "string") return null;
  if (Array.isArray(auctions)) {
    // Prefer active, then kaufchance, then draft, then ended/sold
    return (
      auctions.find((a) => a.status === "active") ||
      auctions.find((a) => a.status === "kaufchance") ||
      auctions.find((a) => a.status === "sold") ||
      auctions.find((a) => a.status === "ended") ||
      auctions.find((a) => a.status === "cancelled") ||
      auctions.find((a) => a.status === "draft") ||
      auctions[0] ||
      null
    );
  }
  return auctions;
}

/** Determines the "real" combined status of a motorhome. */
function getRealStatus(m: MotorhomeWithRelations): string {
  if (m.status === "sold") return "verkauft";
  if (m.status === "reserved") return "reserviert";

  const auction = getActiveAuction(m.auctions);
  if (!auction) return "vorbereitung"; // No auction at all
  if (auction.status === "draft") return "vorbereitung";
  if (auction.status === "active") return "in_auktion";
  if (auction.status === "kaufchance") return "kaufchance";
  if (auction.status === "sold") return "verkauft";
  if (auction.status === "ended" || auction.status === "cancelled") return "nicht_verkauft";

  return "vorbereitung";
}

/** Returns a badge for the combined real status. */
function getStatusBadge(realStatus: string) {
  switch (realStatus) {
    case "vorbereitung":
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Vorbereitung</Badge>;
    case "in_auktion":
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">In Auktion</Badge>;
    case "nicht_verkauft":
      return <Badge className="bg-red-500 hover:bg-red-600 text-white">Nicht verkauft</Badge>;
    case "verkauft":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">Verkauft</Badge>;
    case "kaufchance":
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Kaufchance</Badge>;
    case "reserviert":
      return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Reserviert</Badge>;
    default:
      return <Badge variant="outline">{realStatus}</Badge>;
  }
}

/** Returns a condition badge with color coding. */
function getConditionBadge(condition: string) {
  const colorMap: Record<string, string> = {
    Neuwertig: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Sehr gut": "bg-green-100 text-green-800 border-green-200",
    "Sehr gepflegt": "bg-green-100 text-green-800 border-green-200",
    Gut: "bg-lime-100 text-lime-800 border-lime-200",
    Gepflegt: "bg-lime-100 text-lime-800 border-lime-200",
    Befriedigend: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Gebrauchsspuren: "bg-orange-100 text-orange-800 border-orange-200",
    "Reparaturbedürftig": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={colorMap[condition] || ""}>
      {condition}
    </Badge>
  );
}

// ============================================================================
// Tab configuration
// ============================================================================

const TABS: { key: TabKey; label: string; icon: typeof Package; color: string }[] = [
  { key: "alle", label: "Alle", icon: Car, color: "text-gray-500" },
  { key: "vorbereitung", label: "Vorbereitung", icon: Package, color: "text-amber-500" },
  { key: "in_auktion", label: "In Auktion", icon: Radio, color: "text-blue-500" },
  { key: "kaufchance", label: "Kaufchance", icon: AlertTriangle, color: "text-orange-500" },
  { key: "nicht_verkauft", label: "Nicht verkauft", icon: XCircle, color: "text-red-500" },
  { key: "verkauft", label: "Verkauft", icon: CheckCircle2, color: "text-green-500" },
];

// ============================================================================
// Component
// ============================================================================

export default function AdminMotorhomes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sellerFilter = searchParams.get("seller")?.trim() || "";
  const [selectedMotorhome, setSelectedMotorhome] = useState<MotorhomeWithRelations | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [auctionActionTarget, setAuctionActionTarget] = useState<{ auction: AuctionInfo; motorhomeName: string } | null>(null);
  const [auctionActionType, setAuctionActionType] = useState<"activate" | "cancel" | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<TabKey>("alle");
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [saleChannelFilter, setSaleChannelFilter] = useState<string>("all");
  const [photoFilter, setPhotoFilter] = useState<string>("all");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ---- Data Query ----
  const { data: motorhomes, isLoading } = useQuery({
    queryKey: ["adminMotorhomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          *,
          seller:profiles!left (
            first_name,
            last_name,
            email,
            phone
          ),
          motorhome_photos(url, display_order),
          auctions(
            id,
            status,
            current_bid,
            starting_bid,
            start_time,
            end_time
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MotorhomeWithRelations[];
    },
  });

  // ---- Auction Mutations ----
  const activateAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);
      const { error } = await supabase
        .from("auctions")
        .update({
          status: "active",
          start_time: new Date().toISOString(),
          end_time: endTime.toISOString(),
        })
        .eq("id", auctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
    },
    onError: () => toast.error("Fehler beim Aktivieren der Auktion"),
  });

  const cancelAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error } = await supabase
        .from("auctions")
        .update({ status: "cancelled" })
        .eq("id", auctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich abgebrochen");
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
    },
    onError: () => toast.error("Fehler beim Abbrechen der Auktion"),
  });

  const handleAuctionAction = () => {
    if (!auctionActionTarget || !auctionActionType) return;
    const aId = auctionActionTarget.auction.id;
    if (auctionActionType === "activate") activateAuctionMutation.mutate(aId);
    else if (auctionActionType === "cancel") cancelAuctionMutation.mutate(aId);
    setAuctionActionTarget(null);
    setAuctionActionType(null);
  };

  // ---- Export ----
  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "wohnmobile",
    columns: [
      { key: "id", label: "ID" },
      { key: "manufacturer", label: "Hersteller" },
      { key: "model", label: "Modell" },
      { key: "body_type", label: "Aufbauart" },
      { key: "year", label: "Baujahr" },
      { key: "mileage", label: "Kilometerstand", format: (v: any) => v ? `${Number(v).toLocaleString()} km` : "" },
      { key: "condition", label: "Zustand" },
      { key: "sale_channel", label: "Verkaufsweg" },
      { key: "status", label: "Motorhome-Status" },
      {
        key: "seller",
        label: "Verkäufer",
        format: (v: any) => v ? `${v.first_name || ""} ${v.last_name || ""}`.trim() : "",
      },
      {
        key: "seller",
        label: "E-Mail",
        format: (v: any) => v?.email || "",
      },
      {
        key: "motorhome_photos",
        label: "Fotos",
        format: (v: any) => v ? String(v.length) : "0",
      },
      { key: "created_at", label: "Erstellt am", format: (v: any) => v ? format(new Date(v), "dd.MM.yyyy", { locale: de }) : "" },
    ],
  });

  // ---- Filtering & Sorting ----
  const { filteredMotorhomes, tabCounts } = useMemo(() => {
    if (!motorhomes) return { filteredMotorhomes: [], tabCounts: { alle: 0, vorbereitung: 0, in_auktion: 0, nicht_verkauft: 0, verkauft: 0 } };

    // Calculate real status for each motorhome
    const withRealStatus = motorhomes.map((m) => ({
      ...m,
      _realStatus: getRealStatus(m),
    }));

    // Tab counts (before search/filter)
    const tabCounts = {
      alle: withRealStatus.length,
      vorbereitung: withRealStatus.filter((m) => m._realStatus === "vorbereitung").length,
      in_auktion: withRealStatus.filter((m) => m._realStatus === "in_auktion").length,
      nicht_verkauft: withRealStatus.filter((m) => m._realStatus === "nicht_verkauft").length,
      verkauft: withRealStatus.filter((m) => m._realStatus === "verkauft" || m._realStatus === "reserviert").length,
    };

    // Tab filter
    let filtered = withRealStatus;
    if (sellerFilter) {
      filtered = filtered.filter((m) => m.seller_id === sellerFilter);
    }
    if (activeTab !== "alle") {
      if (activeTab === "verkauft") {
        filtered = filtered.filter((m) => m._realStatus === "verkauft" || m._realStatus === "reserviert");
      } else {
        filtered = filtered.filter((m) => m._realStatus === activeTab);
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((m) =>
        `${m.manufacturer} ${m.model}`.toLowerCase().includes(q) ||
        `${m.seller?.first_name || ""} ${m.seller?.last_name || ""}`.toLowerCase().includes(q) ||
        (m.seller?.email || "").toLowerCase().includes(q) ||
        (m.body_type || "").toLowerCase().includes(q)
      );
    }

    // Condition filter
    if (conditionFilter !== "all") {
      filtered = filtered.filter((m) => m.condition === conditionFilter);
    }

    // Sale channel filter
    if (saleChannelFilter !== "all") {
      filtered = filtered.filter((m) => m.sale_channel === saleChannelFilter);
    }

    // Photo filter
    if (photoFilter === "no_photos") {
      filtered = filtered.filter((m) => !m.motorhome_photos || m.motorhome_photos.length === 0);
    } else if (photoFilter === "has_photos") {
      filtered = filtered.filter((m) => m.motorhome_photos && m.motorhome_photos.length > 0);
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at":
          cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case "year":
          cmp = (a.year || 0) - (b.year || 0);
          break;
        case "mileage":
          cmp = (a.mileage || 0) - (b.mileage || 0);
          break;
        case "manufacturer":
          cmp = `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return { filteredMotorhomes: filtered, tabCounts };
  }, [motorhomes, activeTab, sellerFilter, searchQuery, conditionFilter, saleChannelFilter, photoFilter, sortKey, sortDir]);

  // ---- Quick Stats ----
  const stats = useMemo(() => {
    if (!motorhomes) return { total: 0, noPhotos: 0, inAuction: 0, kaufchance: 0, nichtVerkauft: 0, sold: 0 };
    return {
      total: motorhomes.length,
      noPhotos: motorhomes.filter((m) => !m.motorhome_photos || m.motorhome_photos.length === 0).length,
      inAuction: motorhomes.filter((m) => getRealStatus(m) === "in_auktion").length,
      kaufchance: motorhomes.filter((m) => getRealStatus(m) === "kaufchance").length,
      nichtVerkauft: motorhomes.filter((m) => getRealStatus(m) === "nicht_verkauft").length,
      sold: motorhomes.filter((m) => m.status === "sold").length,
    };
  }, [motorhomes]);

  // ---- Sort handler ----
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "manufacturer" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // ---- Actions ----
  const handleViewDetails = (motorhome: MotorhomeWithRelations) => {
    navigate(`/admin/motorhomes/${motorhome.id}`);
  };

  const handleEdit = (motorhome: MotorhomeWithRelations) => {
    setSelectedMotorhome(motorhome);
    setShowEditDialog(true);
  };

  const handleDelete = (motorhome: MotorhomeWithRelations) => {
    setSelectedMotorhome(motorhome);
    setShowDeleteDialog(true);
  };

  const handleCreateAuction = (motorhome: MotorhomeWithRelations) => {
    navigate(`/admin/auctions?create=${motorhome.id}`);
  };

  // ---- Sale channel badge ----
  const getSaleChannelBadge = (motorhome: MotorhomeWithRelations) => {
    const channel = motorhome.sale_channel;
    const hasInstantBuy = motorhome.instant_price && Number(motorhome.instant_price) > 0;
    switch (channel) {
      case "auction":
        return hasInstantBuy
          ? <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">Auktion + Sofortkauf</Badge>
          : <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs">Auktion</Badge>;
      case "instant_price":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Nur Festpreis</Badge>;
      case "station":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">Station</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  // ---- Pagination ----
  const [mhPage, setMhPage] = useState(1);
  const MH_PAGE_SIZE = 20;

  // Reset Seite bei Filter-Änderung
  useEffect(() => { setMhPage(1); }, [activeTab, searchQuery, conditionFilter, saleChannelFilter, photoFilter]);

  // ---- Render Table ----
  const renderTable = (items: (MotorhomeWithRelations & { _realStatus: string })[]) => {
    const totalItems = items.length;
    const pageItems = items.slice((mhPage - 1) * MH_PAGE_SIZE, mhPage * MH_PAGE_SIZE);
    return (
    <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
      <div className="overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Bild</TableHead>
            <TableHead>
              <button
                className="flex items-center font-medium hover:text-primary transition-colors"
                onClick={() => handleSort("manufacturer")}
              >
                Fahrzeug <SortIcon column="manufacturer" />
              </button>
            </TableHead>
            <TableHead>Verkäufer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <button
                className="flex items-center font-medium hover:text-primary transition-colors"
                onClick={() => handleSort("year")}
              >
                Jahr <SortIcon column="year" />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center font-medium hover:text-primary transition-colors"
                onClick={() => handleSort("mileage")}
              >
                km <SortIcon column="mileage" />
              </button>
            </TableHead>
            <TableHead>Zustand</TableHead>
            <TableHead>Verkaufsweg</TableHead>
            <TableHead>Fotos</TableHead>
            <TableHead>
              <button
                className="flex items-center font-medium hover:text-primary transition-colors"
                onClick={() => handleSort("created_at")}
              >
                Erstellt <SortIcon column="created_at" />
              </button>
            </TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Car className="w-8 h-8" />
                  <p>Keine Wohnmobile in dieser Kategorie</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            pageItems.map((motorhome) => {
              const firstPhoto = motorhome.motorhome_photos
                ?.sort((a, b) => a.display_order - b.display_order)[0]?.url;
              const photoCount = motorhome.motorhome_photos?.length || 0;
              const auction = getActiveAuction(motorhome.auctions);

              return (
                <TableRow
                  key={motorhome.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewDetails(motorhome)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="w-14 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {firstPhoto ? (
                        <img
                          src={firstPhoto}
                          alt={`${motorhome.manufacturer} ${motorhome.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">
                        {motorhome.manufacturer} {motorhome.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {motorhome.body_type}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">
                        {motorhome.seller?.first_name} {motorhome.seller?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {motorhome.seller?.email}
                      </p>
                      {motorhome.seller?.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <a
                            href={`tel:${motorhome.seller.phone}`}
                            className="hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {motorhome.seller.phone}
                          </a>
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(motorhome._realStatus)}
                      {auction && auction.status === "active" && auction.current_bid != null && (
                        <span className="text-xs text-muted-foreground">
                          {Number(auction.current_bid).toLocaleString("de-DE")} €
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{motorhome.year}</TableCell>
                  <TableCell className="text-sm">{motorhome.mileage.toLocaleString()} km</TableCell>
                  <TableCell>{getConditionBadge(motorhome.condition)}</TableCell>
                  <TableCell>{getSaleChannelBadge(motorhome)}</TableCell>
                  <TableCell>
                    {photoCount === 0 ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <ImageOff className="w-3 h-3" />
                        0
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Camera className="w-3 h-3" />
                        {photoCount}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {motorhome.created_at
                      ? format(new Date(motorhome.created_at), "dd.MM.yy", { locale: de })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(motorhome)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Details anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(motorhome)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(() => {
                          const mAuction = getActiveAuction(motorhome.auctions);
                          if (!mAuction || mAuction.status === "ended" || mAuction.status === "cancelled") {
                            return (
                              <DropdownMenuItem onClick={() => handleCreateAuction(motorhome)}>
                                <Gavel className="w-4 h-4 mr-2" />
                                {mAuction ? "Erneut in Auktion" : "Auktion erstellen"}
                              </DropdownMenuItem>
                            );
                          }
                          const mName = `${motorhome.manufacturer} ${motorhome.model}`;
                          return (
                            <>
                              <DropdownMenuItem onClick={() => navigate(`/admin/auctions/${mAuction.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Auktion anzeigen
                              </DropdownMenuItem>
                              {mAuction.status === "draft" && (
                                <DropdownMenuItem onClick={() => { setAuctionActionTarget({ auction: mAuction, motorhomeName: mName }); setAuctionActionType("activate"); }}>
                                  <Play className="w-4 h-4 mr-2" />
                                  Auktion aktivieren
                                </DropdownMenuItem>
                              )}
                              {(mAuction.status === "active" || mAuction.status === "draft" || mAuction.status === "kaufchance") && (
                                <DropdownMenuItem
                                  onClick={() => { setAuctionActionTarget({ auction: mAuction, motorhomeName: mName }); setAuctionActionType("cancel"); }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Auktion abbrechen
                                </DropdownMenuItem>
                              )}
                            </>
                          );
                        })()}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(motorhome)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
      {totalItems > MH_PAGE_SIZE && (
        <div className="px-4 pb-4">
          <AdminPagination
            page={mhPage}
            pageSize={MH_PAGE_SIZE}
            totalItems={totalItems}
            onPageChange={setMhPage}
          />
        </div>
      )}
    </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Wohnmobilverwaltung</h1>
          <p className="text-muted-foreground">
            Übersicht aller Wohnmobile auf der Plattform
          </p>
        </div>
        <ExportButton
          onExportCSV={() => exportCSV(filteredMotorhomes)}
          onExportExcel={() => exportExcel(filteredMotorhomes)}
          isExporting={isExporting}
          size="sm"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Car className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </div>
        </Card>
        <Card className={`p-4 flex items-center gap-3 ${stats.noPhotos > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
          <div className={`p-2 rounded-lg ${stats.noPhotos > 0 ? "bg-red-100" : "bg-gray-100"}`}>
            <ImageOff className={`w-5 h-5 ${stats.noPhotos > 0 ? "text-red-600" : "text-gray-600"}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.noPhotos}</p>
            <p className="text-xs text-muted-foreground">Ohne Fotos</p>
          </div>
          {stats.noPhotos > 0 && (
            <AlertTriangle className="w-4 h-4 text-red-500 ml-auto" />
          )}
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Radio className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.inAuction}</p>
            <p className="text-xs text-muted-foreground">In Auktion</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.sold}</p>
            <p className="text-xs text-muted-foreground">Verkauft</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.key];
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-2 py-2.5 text-xs sm:text-sm"
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.key ? "" : tab.color}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <Badge
                  variant={activeTab === tab.key ? "secondary" : "outline"}
                  className="text-xs px-1.5 py-0"
                >
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Hersteller, Modell, Verkäufer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={conditionFilter} onValueChange={setConditionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Zustand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Zustände</SelectItem>
              <SelectItem value="Neuwertig">Neuwertig</SelectItem>
              <SelectItem value="Sehr gut">Sehr gut</SelectItem>
              <SelectItem value="Sehr gepflegt">Sehr gepflegt</SelectItem>
              <SelectItem value="Gut">Gut</SelectItem>
              <SelectItem value="Gepflegt">Gepflegt</SelectItem>
              <SelectItem value="Befriedigend">Befriedigend</SelectItem>
              <SelectItem value="Gebrauchsspuren">Gebrauchsspuren</SelectItem>
              <SelectItem value="Reparaturbedürftig">Reparaturbedürftig</SelectItem>
            </SelectContent>
          </Select>
          <Select value={saleChannelFilter} onValueChange={setSaleChannelFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Verkaufsweg" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Verkaufswege</SelectItem>
              <SelectItem value="auction">Auktion</SelectItem>
              <SelectItem value="instant_price">Sofortkauf</SelectItem>
              <SelectItem value="station">Station</SelectItem>
            </SelectContent>
          </Select>
          <Select value={photoFilter} onValueChange={setPhotoFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Fotos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="no_photos">Ohne Fotos</SelectItem>
              <SelectItem value="has_photos">Mit Fotos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between mt-2 mb-1">
              <p className="text-sm text-muted-foreground">
                {filteredMotorhomes.length} Ergebnis{filteredMotorhomes.length !== 1 ? "se" : ""}
                {(searchQuery || conditionFilter !== "all" || saleChannelFilter !== "all" || photoFilter !== "all") && (
                  <span> (gefiltert)</span>
                )}
              </p>
              {(searchQuery || conditionFilter !== "all" || saleChannelFilter !== "all" || photoFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setConditionFilter("all");
                    setSaleChannelFilter("all");
                    setPhotoFilter("all");
                  }}
                >
                  Filter zurücksetzen
                </Button>
              )}
            </div>

            {/* Tab Contents */}
            {TABS.map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-2">
                {renderTable(filteredMotorhomes)}
              </TabsContent>
            ))}
          </>
        )}
      </Tabs>

      {/* Dialogs */}
      <MotorhomeDetailDialog
        motorhome={selectedMotorhome}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />

      <MotorhomeEditDialog
        motorhome={selectedMotorhome}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteMotorhomeDialog
        motorhome={selectedMotorhome}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

      {/* Auction Action Confirmation Dialog */}
      <AlertDialog
        open={!!auctionActionTarget && !!auctionActionType}
        onOpenChange={(open) => { if (!open) { setAuctionActionTarget(null); setAuctionActionType(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {auctionActionType === "activate" && "Auktion aktivieren?"}
              {auctionActionType === "cancel" && "Auktion abbrechen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {auctionActionType === "activate" && (
                <>Die Auktion für <strong>{auctionActionTarget?.motorhomeName}</strong> wird für 7 Tage aktiviert und ist dann öffentlich sichtbar.</>
              )}
              {auctionActionType === "cancel" && (
                <>Die Auktion für <strong>{auctionActionTarget?.motorhomeName}</strong> wird abgebrochen. Keine Benachrichtigungen werden versendet. Der Verkäufer kann sein Inserat danach wieder bearbeiten und Fotos hochladen.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAuctionAction}
              className={auctionActionType === "cancel" ? "bg-destructive hover:bg-destructive/90" : auctionActionType === "activate" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {auctionActionType === "activate" && "Aktivieren"}
              {auctionActionType === "cancel" && "Abbrechen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
