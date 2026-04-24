/**
 * Admin Motorhome Detail Page
 * Comprehensive view of motorhome with photos, specifications, and related data
 */

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cancelAuctionAsAdmin } from "@/lib/adminAuctionCancel";
import { activateAuctionForMotorhome } from "@/lib/activate-auction";
import { AUCTION_PUBLIC_COLUMNS } from "@/lib/auction-columns";

import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Car,
  User,
  Calendar,
  Gauge,
  Fuel,
  Settings,
  Ruler,
  Weight,
  Bed,
  Users,
  Droplets,
  Sun,
  Wind,
  Tv,
  Camera,
  ParkingCircle,
  Lock,
  Bike,
  Warehouse,
  Edit,
  Trash2,
  Gavel,
  Image as ImageIcon,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  FileText,
  Euro,
  Send,
  Play,
  Ban,
  Clock,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminDetailLayout,
  DetailSection,
  InfoGrid,
  InfoItem,
  StatsCard,
} from "@/components/admin/AdminDetailLayout";
import { MotorhomeEditDialog } from "@/components/admin/MotorhomeEditDialog";
import { AdminPhotoManager } from "@/components/admin/AdminPhotoManager";
import { SendOwnerEmailDialog } from "@/components/admin/SendOwnerEmailDialog";
import { AdminPriceHistoryCard } from "@/components/admin/AdminPriceHistoryCard";
import { logger } from "@/lib/logger";

export default function AdminMotorhomeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Fetch motorhome with all related data
  const { data: motorhome, isLoading, error } = useQuery({
    queryKey: ["adminMotorhomeDetail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          *,
          motorhome_photos(id, url, card_url, medium_url, display_order),
          damage_photos(id, photo_url, damage_location, damage_severity, damage_description),
          seller:profiles!left (
            id,
            first_name,
            last_name,
            email,
            phone,
            company_name,
            created_at
          ),
          auctions(
            ${AUCTION_PUBLIC_COLUMNS},
            auction_addenda(id, content, created_at),
            bids(
              id,
              amount,
              created_at,
              is_autobid,
              max_autobid_amount,
              bidder:profiles!bids_bidder_id_fkey(
                id,
                first_name,
                last_name,
                email,
                company_name
              )
            )
          ),
          appointments(
            id,
            status,
            appointment_date,
            station:purchase_stations(name, city)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Delete motorhome mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("motorhomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wohnmobil erfolgreich gelöscht");
      navigate("/admin/motorhomes");
    },
    onError: (error) => {
      logger.error("Delete motorhome error:", error);
      toast.error("Fehler beim Löschen des Wohnmobils");
    },
  });

  // Auction mutations — MÜSSEN vor jedem early return stehen, sonst
  // verletzt der frühe `if (error) return` die Hook-Order und produziert
  // den Minified React #300 ("Rendered fewer hooks than previous render").
  // Aktivierung über zentralen Helper (3-Tage-Dauer + Random-Startbid +
  // seller_initial_* + Marketing-Trigger).
  const activateAuctionMutation = useMutation({
    mutationFn: async () => {
      if (!motorhome?.id) throw new Error("No motorhome");
      await activateAuctionForMotorhome(motorhome.id);
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomeDetail", id] });
    },
    onError: (e: Error) => {
      if (e.message === "PLZ_MISSING") {
        toast.error("Bitte zuerst die PLZ eintragen, bevor die Auktion aktiviert wird.");
      } else if (e.message === "RESERVE_MISSING") {
        toast.error("Bitte zuerst den Reservepreis eintragen, bevor die Auktion aktiviert wird.");
      } else {
        toast.error("Fehler beim Aktivieren der Auktion");
      }
    },
  });

  const cancelAuctionMutation = useMutation({
    mutationFn: async () => {
      // relevantAuction ist erst weiter unten berechnet, aber der Mutation-
      // Handler wird nur ausgeführt wenn der Button geklickt wird (also nach
      // Render-Zeit). Wir greifen über das motorhome auf die aktuelle Auktion
      // zu, ohne auf relevantAuction zu warten.
      const auctionData = motorhome?.auctions;
      const auctionsArr = Array.isArray(auctionData) ? auctionData : auctionData ? [auctionData] : [];
      const target = auctionsArr.find((a: any) => a?.status === 'active')
        || auctionsArr.find((a: any) => a?.status === 'kaufchance')
        || auctionsArr.find((a: any) => a?.status === 'draft')
        || auctionsArr[0];
      if (!target?.id) throw new Error("No auction");
      return cancelAuctionAsAdmin(target.id);
    },
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
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomeDetail", id] });
    },
    onError: () => toast.error("Fehler beim Abbrechen der Auktion"),
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Wohnmobil nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Das angeforderte Wohnmobil existiert nicht oder wurde gelöscht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/motorhomes")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy", { locale: de });
  };

  const formatMonthYear = (date: string | null) => {
    if (!date) return "—";
    const m = /^(\d{4})-(\d{2})/.exec(date);
    if (m) return `${m[2]}.${m[1]}`;
    return format(new Date(date), "MM.yyyy", { locale: de });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      available: { label: "Verfügbar", variant: "default" },
      pending: { label: "Ausstehend", variant: "secondary" },
      sold: { label: "Verkauft", variant: "outline" },
      reserved: { label: "Reserviert", variant: "secondary" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  const getSaleChannelBadge = (channel: string) => {
    const hasInstantBuy = motorhome?.instant_price && Number(motorhome.instant_price) > 0;
    const channelConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      instant_price: { label: "Nur Festpreis", variant: "default" },
      auction: hasInstantBuy ? { label: "Auktion + Sofortkauf", variant: "default" } : { label: "Auktion", variant: "secondary" },
      station: { label: "Station", variant: "outline" },
    };
    return channelConfig[channel] || { label: channel, variant: "outline" };
  };

  const sortedPhotos = Array.isArray(motorhome?.motorhome_photos)
    ? [...motorhome.motorhome_photos].sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
      )
    : [];

  const auctionData = motorhome?.auctions;
  const relevantAuction = (() => {
    if (!auctionData || typeof auctionData === 'string') return null;
    if (Array.isArray(auctionData)) {
      return auctionData.find((a: any) => a?.status === 'active')
        || auctionData.find((a: any) => a?.status === 'kaufchance')
        || auctionData.find((a: any) => a?.status === 'draft')
        || auctionData.find((a: any) => a?.status === 'sold')
        || auctionData.find((a: any) => a?.status === 'ended')
        || auctionData.find((a: any) => a?.status === 'cancelled')
        || auctionData[0]
        || null;
    }
    if (typeof auctionData === 'object') return auctionData;
    return null;
  })();

  const sortedBids = (() => {
    const bids = (relevantAuction as any)?.bids;
    if (!bids || !Array.isArray(bids)) return [];
    return [...bids].sort((a: any, b: any) => b.amount - a.amount);
  })();

  const uniqueBidderCount = new Set(
    sortedBids.map((b: any) => b.bidder?.id).filter(Boolean)
  ).size;

  const addenda = (() => {
    const items = (relevantAuction as any)?.auction_addenda;
    if (!items || !Array.isArray(items)) return [];
    return [...items].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  })();

  // (activateAuctionMutation + cancelAuctionMutation sind weiter oben
  // definiert — hochgezogen wegen Hook-Order vor dem `if (error) return`.)

  return (
    <AdminDetailLayout
      title={motorhome ? `${motorhome.manufacturer} ${motorhome.model}` : "Wohnmobil"}
      subtitle={motorhome ? `${motorhome.year} • ${motorhome.body_type} • ${motorhome.listing_number || "—"}` : undefined}
      status={motorhome ? getStatusBadge(motorhome.status) : undefined}
      backUrl="/admin/motorhomes"
      backLabel="Alle Wohnmobile"
      isLoading={isLoading}
      icon={<Car className="w-6 h-6" />}
      actions={
        motorhome && (
          <div className="flex gap-2">
            {motorhome.seller?.email && (
              <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                E-Mail senden
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
            {relevantAuction?.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    Aktivieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion aktivieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird für 7 Tage aktiviert und ist dann öffentlich sichtbar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => activateAuctionMutation.mutate()}>
                      Aktivieren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(relevantAuction?.status === "active" || relevantAuction?.status === "draft" || relevantAuction?.status === "kaufchance") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Ban className="w-4 h-4 mr-2" />
                    Auktion abbrechen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion abbrechen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird abgebrochen. Keine Benachrichtigungen werden versendet.
                      Der Verkäufer kann sein Inserat danach wieder bearbeiten und Fotos hochladen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zurück</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelAuctionMutation.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Abbrechen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(!relevantAuction || relevantAuction.status === "ended" || relevantAuction.status === "cancelled") && (
              <Button
                size="sm"
                onClick={() => navigate(`/admin/auctions?create=${motorhome.id}`)}
              >
                <Gavel className="w-4 h-4 mr-2" />
                {relevantAuction ? "Erneut in Auktion" : "Auktion erstellen"}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Wohnmobil löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Fotos
                    und Daten werden ebenfalls gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )
      }
    >
      {motorhome && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Preis"
              value={formatPrice(motorhome.instant_price || motorhome.reserve_price)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Kilometerstand"
              value={motorhome.mileage ? `${motorhome.mileage.toLocaleString()} km` : "—"}
              icon={<Gauge className="w-5 h-5" />}
            />
            <StatsCard
              label="Fotos"
              value={sortedPhotos.length}
              icon={<ImageIcon className="w-5 h-5" />}
            />
            <StatsCard
              label="Verkaufsweg"
              value={getSaleChannelBadge(motorhome.sale_channel).label}
              icon={<Settings className="w-5 h-5" />}
            />
          </div>

          <AdminPriceHistoryCard
            motorhomeId={motorhome.id}
            auctionId={relevantAuction?.id}
          />

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo Manager */}
              <AdminPhotoManager
                motorhomeId={motorhome.id}
                photos={sortedPhotos}
                queryKey={["adminMotorhomeDetail", id!]}
              />

              {/* Tabs for Details */}
              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">Grunddaten</TabsTrigger>
                  <TabsTrigger value="technical">Technik</TabsTrigger>
                  <TabsTrigger value="interior">Ausstattung</TabsTrigger>
                  <TabsTrigger value="equipment">Extras</TabsTrigger>
                  <TabsTrigger value="condition">Zustand</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <DetailSection title="Grundinformationen" icon={<Car className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Hersteller" value={motorhome.manufacturer} />
                      <InfoItem label="Modell" value={motorhome.model} />
                      <InfoItem label="Baujahr" value={motorhome.year} />
                      <InfoItem label="Aufbauart" value={motorhome.body_type} />
                      <InfoItem label="Zustand" value={motorhome.condition} />
                      <InfoItem label="Kilometerstand" value={motorhome.mileage ? `${motorhome.mileage.toLocaleString()} km` : "—"} />
                      <InfoItem label="Fahrgestellnr." value={motorhome.vehicle_identification_number} />
                      <InfoItem label="Kennzeichen" value={motorhome.license_plate} />
                      <InfoItem label="Listennummer" value={motorhome.listing_number} />
                      <InfoItem label="PLZ (Standort)" value={motorhome.postal_code || "—"} />
                      <InfoItem label="Stadt" value={motorhome.city || "—"} />
                      <InfoItem label="Basisfahrzeug" value={motorhome.base_vehicle || "—"} />
                    </InfoGrid>
                    {motorhome.description && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Beschreibung</p>
                        <p className="text-sm whitespace-pre-wrap">{motorhome.description}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="technical">
                  <DetailSection title="Technische Daten" icon={<Settings className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Kraftstoff" value={motorhome.fuel_type} icon={<Fuel className="w-3 h-3" />} />
                      <InfoItem label="Leistung" value={motorhome.engine_power_hp ? `${motorhome.engine_power_hp} PS${motorhome.power_kw ? ` (${motorhome.power_kw} kW)` : ''}` : "—"} />
                      <InfoItem label="Getriebe" value={motorhome.transmission} />
                      <InfoItem label="Abgasnorm" value={motorhome.emission_class} />
                      <InfoItem label="Erstzulassung" value={formatMonthYear(motorhome.first_registration)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="TÜV bis" value={formatMonthYear(motorhome.tuev_valid_until)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="Vorbesitzer" value={motorhome.previous_owners?.toString()} />
                      <InfoItem label="Hubraum" value={motorhome.engine_displacement_ccm ? `${motorhome.engine_displacement_ccm} ccm` : "—"} />
                      <InfoItem label="Tankinhalt" value={motorhome.fuel_tank_capacity_liters ? `${motorhome.fuel_tank_capacity_liters} L` : "—"} />
                      <InfoItem label="Gassystem" value={motorhome.gas_system || "—"} />
                      <InfoItem label="Hauptreifen" value={motorhome.main_tires || "—"} />
                      <InfoItem label="Zweitreifen" value={motorhome.second_tires || "—"} />
                      <InfoItem label="Letzter TÜV" value={formatMonthYear(motorhome.last_tuev_date)} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {motorhome.accident_free && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Unfallfrei
                        </Badge>
                      )}
                      {motorhome.non_smoker && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Nichtraucher
                        </Badge>
                      )}
                      {motorhome.service_history_available && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" />
                          Scheckheft
                        </Badge>
                      )}
                      {motorhome.has_tuev && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          TÜV vorhanden
                        </Badge>
                      )}
                    </div>

                    <Separator className="my-6" />

                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Abmessungen & Gewicht
                    </h4>
                    <InfoGrid columns={4}>
                      <InfoItem label="Länge" value={motorhome.length_m ? `${motorhome.length_m} cm` : "—"} />
                      <InfoItem label="Breite" value={motorhome.width_m ? `${motorhome.width_m} cm` : "—"} />
                      <InfoItem label="Höhe" value={motorhome.height_m ? `${motorhome.height_m} cm` : "—"} />
                      <InfoItem label="Achsen" value={motorhome.number_of_axles?.toString()} />
                      <InfoItem label="Gesamtgewicht" value={motorhome.weight_kg ? `${motorhome.weight_kg} kg` : "—"} icon={<Weight className="w-3 h-3" />} />
                      <InfoItem label="Zuladung" value={motorhome.payload_kg ? `${motorhome.payload_kg} kg` : "—"} />
                      <InfoItem label="Sitzplätze" value={motorhome.seats?.toString()} icon={<Users className="w-3 h-3" />} />
                      <InfoItem label="Schlafplätze" value={motorhome.sleeping_places?.toString()} icon={<Bed className="w-3 h-3" />} />
                    </InfoGrid>
                    {motorhome.beds_description && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Betten:</strong> {motorhome.beds_description}
                      </p>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="interior">
                  <DetailSection title="Innenausstattung" icon={<Bed className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Heizung" value={motorhome.heating_type} />
                      <InfoItem label="Klimaanlage" value={motorhome.air_conditioning_type} icon={<Wind className="w-3 h-3" />} />
                      <InfoItem label="Frischwasser" value={motorhome.water_tank_liters ? `${motorhome.water_tank_liters} L` : "—"} icon={<Droplets className="w-3 h-3" />} />
                      <InfoItem label="Grauwasser" value={motorhome.grey_water_capacity_liters ? `${motorhome.grey_water_capacity_liters} L` : "—"} />
                      <InfoItem label="Kühlschrank" value={motorhome.refrigerator_type} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {motorhome.has_kitchen && <Badge variant="outline">Küche</Badge>}
                      {motorhome.has_bathroom && <Badge variant="outline">Bad</Badge>}
                      {motorhome.has_toilet && <Badge variant="outline">Toilette</Badge>}
                      {motorhome.has_shower && <Badge variant="outline">Dusche</Badge>}
                      {motorhome.has_swivel_seats && <Badge variant="outline">Drehsitze</Badge>}
                      {motorhome.has_roof_ac && <Badge variant="outline">Dach-Klimaanlage</Badge>}
                      {motorhome.has_stand_ac && <Badge variant="outline">Stand-Klimaanlage</Badge>}
                    </div>
                  </DetailSection>
                </TabsContent>

                <TabsContent value="equipment">
                  <DetailSection title="Zusatzausstattung" icon={<Sun className="w-5 h-5" />}>
                    <div className="flex flex-wrap gap-2">
                      {motorhome.has_solar && (
                        <Badge variant="outline" className="gap-1">
                          <Sun className="w-3 h-3" />
                          Solar {motorhome.solar_power_watts ? `(${motorhome.solar_power_watts}W)` : ''}
                        </Badge>
                      )}
                      {motorhome.has_awning && (
                        <Badge variant="outline">
                          Markise {motorhome.awning_length_m ? `(${motorhome.awning_length_m}cm)` : ''}
                        </Badge>
                      )}
                      {motorhome.has_inverter && <Badge variant="outline">Wechselrichter</Badge>}
                      {motorhome.has_tv && (
                        <Badge variant="outline" className="gap-1">
                          <Tv className="w-3 h-3" /> TV/SAT
                        </Badge>
                      )}
                      {motorhome.has_backup_camera && (
                        <Badge variant="outline" className="gap-1">
                          <Camera className="w-3 h-3" /> Rückfahrkamera
                        </Badge>
                      )}
                      {motorhome.has_parking_sensors && (
                        <Badge variant="outline" className="gap-1">
                          <ParkingCircle className="w-3 h-3" /> Parksensoren
                        </Badge>
                      )}
                      {motorhome.has_cruise_control && <Badge variant="outline">Tempomat</Badge>}
                      {motorhome.has_central_locking && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" /> Zentralverriegelung
                        </Badge>
                      )}
                      {motorhome.has_bike_rack && (
                        <Badge variant="outline" className="gap-1">
                          <Bike className="w-3 h-3" /> Fahrradträger
                        </Badge>
                      )}
                      {motorhome.has_garage && (
                        <Badge variant="outline" className="gap-1">
                          <Warehouse className="w-3 h-3" /> Heckgarage
                        </Badge>
                      )}
                      {motorhome.has_esp && <Badge variant="outline">ESP</Badge>}
                      {motorhome.has_airbag && <Badge variant="outline">Airbag</Badge>}
                      {motorhome.has_alarm && <Badge variant="outline">Alarmanlage</Badge>}
                      {motorhome.has_navigation && <Badge variant="outline">Navigation</Badge>}
                      {motorhome.has_satellite && <Badge variant="outline">Satellitenanlage</Badge>}
                      {motorhome.has_awning_tent && <Badge variant="outline">Vorzelt</Badge>}
                    </div>
                    {motorhome.battery_capacity_ah && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Batterie:</strong> {motorhome.battery_capacity_ah} Ah
                      </p>
                    )}
                    {motorhome.additional_equipment && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Zusatzausstattung</p>
                        <p className="text-sm whitespace-pre-wrap">{motorhome.additional_equipment}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="condition">
                  <DetailSection title="Fahrzeugzustand" icon={<Shield className="w-5 h-5" />}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`p-3 rounded-lg border text-center ${motorhome.accident_free ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : motorhome.accident_free === false ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-muted/50'}`}>
                        {motorhome.accident_free ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : motorhome.accident_free === false ? (
                          <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                        ) : (
                          <Car className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {motorhome.accident_free ? "Unfallfrei" : motorhome.accident_free === false ? "Unfall vorhanden" : "Keine Angabe"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${motorhome.non_smoker ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : motorhome.non_smoker === false ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-muted/50'}`}>
                        {motorhome.non_smoker ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : motorhome.non_smoker === false ? (
                          <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                        ) : (
                          <Car className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {motorhome.non_smoker ? "Nichtraucher" : motorhome.non_smoker === false ? "Raucherfahrzeug" : "Keine Angabe"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${motorhome.service_history_available ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-muted/50'}`}>
                        {motorhome.service_history_available ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : (
                          <FileText className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {motorhome.service_history_available ? "Scheckheft vorhanden" : "Kein Scheckheft"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${motorhome.has_tuev ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-muted/50'}`}>
                        {motorhome.has_tuev ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : (
                          <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {motorhome.tuev_valid_until ? `TÜV bis ${formatMonthYear(motorhome.tuev_valid_until)}` : motorhome.has_tuev ? "TÜV vorhanden" : "Kein TÜV"}
                        </p>
                      </div>
                    </div>

                    {motorhome.damage_summary ? (
                      <div className="mt-4 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Bekannte Mängel
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{motorhome.damage_summary}</p>
                      </div>
                    ) : !motorhome.has_damage ? (
                      <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <p className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          Keine bekannten Mängel angegeben
                        </p>
                      </div>
                    ) : null}
                  </DetailSection>
                </TabsContent>
              </Tabs>

              {/* Nachträge des Verkäufers */}
              {addenda.length > 0 && (
                <DetailSection title="Nachträge des Verkäufers" icon={<FileText className="w-5 h-5 text-blue-600" />}>
                  <div className="space-y-3">
                    {addenda.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                      >
                        <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Hinzugefügt am{" "}
                          {format(new Date(item.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                        </p>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Damage Photos */}
              {Array.isArray(motorhome.damage_photos) && motorhome.damage_photos.length > 0 && (
                <DetailSection title="Schäden dokumentiert" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {motorhome.damage_photos.map((damage: any) => (
                      <div key={damage.id} className="rounded-lg border overflow-hidden">
                        <img
                          src={damage.photo_url}
                          alt={damage.damage_location}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={damage.damage_severity === "schwer" ? "destructive" : damage.damage_severity === "mittel" ? "secondary" : "outline"}>
                              {damage.damage_severity}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{damage.damage_location}</p>
                          {damage.damage_description && (
                            <p className="text-xs text-muted-foreground mt-1">{damage.damage_description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Gebote */}
              {sortedBids.length > 0 && (
                <DetailSection title={`Gebote (${sortedBids.length})`} icon={<Gavel className="w-5 h-5" />}>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bieter</TableHead>
                          <TableHead>Betrag</TableHead>
                          <TableHead>Max Auto</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Zeitpunkt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedBids.map((bid: any, idx: number) => (
                          <TableRow key={bid.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {bid.bidder?.first_name} {bid.bidder?.last_name}
                                  {idx === 0 && (
                                    <Badge variant="default" className="ml-2 text-xs">Höchstgebot</Badge>
                                  )}
                                </p>
                                {bid.bidder?.company_name && (
                                  <p className="text-xs text-muted-foreground">{bid.bidder.company_name}</p>
                                )}
                                <a
                                  href={`mailto:${bid.bidder?.email}`}
                                  className="text-xs text-muted-foreground hover:text-primary"
                                >
                                  {bid.bidder?.email}
                                </a>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{formatPrice(bid.amount)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {bid.max_autobid_amount ? formatPrice(bid.max_autobid_amount) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={bid.is_autobid ? "secondary" : "outline"}>
                                {bid.is_autobid ? "Auto" : "Manuell"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Gebote</p>
                      <p className="text-lg font-semibold">{sortedBids.length}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Bieter</p>
                      <p className="text-lg font-semibold">{uniqueBidderCount}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Höchstgebot</p>
                      <p className="text-lg font-semibold">{formatPrice(sortedBids[0]?.amount)}</p>
                    </div>
                  </div>
                </DetailSection>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Seller Info */}
              <DetailSection title="Verkäufer" icon={<User className="w-5 h-5" />}>
                {motorhome.seller ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {motorhome.seller.first_name} {motorhome.seller.last_name}
                      </p>
                      {motorhome.seller.company_name && (
                        <p className="text-sm text-muted-foreground">{motorhome.seller.company_name}</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <a
                        href={`mailto:${motorhome.seller.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {motorhome.seller.email}
                      </a>
                      {motorhome.seller.phone && (
                        <a
                          href={`tel:${motorhome.seller.phone}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {motorhome.seller.phone}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Registriert: {formatDate(motorhome.seller.created_at)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/admin/users/${motorhome.seller?.id}`)}
                      >
                        Profil anzeigen
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setShowEmailDialog(true)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        E-Mail
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Kein Verkäufer zugeordnet</p>
                )}
              </DetailSection>

              {/* Auction Info */}
              {relevantAuction && (
                <DetailSection
                  title={
                    relevantAuction.status === "active" ? "Aktive Auktion" :
                    relevantAuction.status === "draft" ? "Auktionsentwurf" :
                    relevantAuction.status === "kaufchance" ? "Kaufchance" :
                    relevantAuction.status === "sold" ? "Verkauft (Auktion)" :
                    relevantAuction.status === "ended" ? "Auktion beendet" :
                    relevantAuction.status === "cancelled" ? "Auktion abgebrochen" :
                    "Auktion"
                  }
                  icon={<Gavel className="w-5 h-5" />}
                >
                  <div className="space-y-4">
                    {relevantAuction.status === "active" && (
                      <div className={`p-3 rounded-lg ${motorhome.sale_channel === 'instant_price' ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
                        <p className="text-sm text-muted-foreground">{motorhome.sale_channel === 'instant_price' ? 'Festpreis' : 'Aktuelles Gebot'}</p>
                        <p className={`text-2xl font-bold ${motorhome.sale_channel === 'instant_price' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {formatPrice(motorhome.sale_channel === 'instant_price' ? motorhome.instant_price : (relevantAuction.current_bid || relevantAuction.starting_bid))}
                        </p>
                      </div>
                    )}
                    {relevantAuction.status === "draft" && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                          Entwurf — noch nicht aktiviert
                        </p>
                      </div>
                    )}
                    {(relevantAuction.status === "ended" || relevantAuction.status === "cancelled") && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <Badge variant={relevantAuction.status === "cancelled" ? "destructive" : "secondary"}>
                          {relevantAuction.status === "cancelled" ? "Abgebrochen" : "Beendet"}
                        </Badge>
                      </div>
                    )}
                    {relevantAuction.status === "kaufchance" && (
                      <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                        <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                          Kaufchance-Phase aktiv
                        </p>
                      </div>
                    )}
                    {relevantAuction.status === "sold" && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                          Erfolgreich verkauft
                        </p>
                        {relevantAuction.current_bid && (
                          <p className="text-2xl font-bold text-green-600 mt-1">
                            {formatPrice(relevantAuction.current_bid)}
                          </p>
                        )}
                      </div>
                    )}
                    <InfoGrid columns={2}>
                      <InfoItem label="Startgebot" value={formatPrice(relevantAuction.starting_bid)} />
                      <InfoItem label="Endet" value={formatDate(relevantAuction.end_time)} />
                    </InfoGrid>
                    {relevantAuction.reserve_price != null && motorhome.sale_channel !== 'instant_price' && (
                      <div className={`p-2 rounded text-sm ${
                        (relevantAuction.current_bid || 0) >= relevantAuction.reserve_price
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                      }`}>
                        {(relevantAuction.current_bid || 0) >= relevantAuction.reserve_price
                          ? `✓ Reservepreis erreicht (${formatPrice(relevantAuction.reserve_price)})`
                          : `Reservepreis: ${formatPrice(relevantAuction.reserve_price)} — fehlen noch ${formatPrice(relevantAuction.reserve_price - (relevantAuction.current_bid || 0))}`
                        }
                      </div>
                    )}
                    {sortedBids.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {sortedBids.length} Gebote von {uniqueBidderCount} Bietern
                      </p>
                    )}
                    {relevantAuction.auction_round > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Auktionsrunde {relevantAuction.auction_round}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/admin/auctions/${relevantAuction.id}`)}
                    >
                      <Gavel className="w-4 h-4 mr-2" />
                      Auktion anzeigen
                    </Button>
                  </div>
                </DetailSection>
              )}

              {/* Appointment Info */}
              {Array.isArray(motorhome.appointments) && motorhome.appointments.length > 0 && (
                <DetailSection title="Termine" icon={<Calendar className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {motorhome.appointments.slice(0, 3).map((appointment: any) => (
                      <Link
                        key={appointment.id}
                        to={`/admin/appointments/${appointment.id}`}
                        className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={appointment.status === "confirmed" ? "default" : "outline"}>
                            {appointment.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(appointment.appointment_date)}
                          </span>
                        </div>
                        {appointment.station && (
                          <p className="text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {appointment.station.name}, {appointment.station.city}
                          </p>
                        )}
                      </Link>
                    ))}
                    {motorhome.appointments.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{motorhome.appointments.length - 3} weitere Termine
                      </p>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Pricing Info */}
              <DetailSection title="Preisgestaltung" icon={<Euro className="w-5 h-5" />}>
                <div className="space-y-3">
                  <InfoItem label="Verkaufsweg" value={getSaleChannelBadge(motorhome.sale_channel).label} />
                  {motorhome.instant_price != null && (
                    <InfoItem label={motorhome.sale_channel === 'instant_price' ? 'Festpreis' : 'Sofortpreis'} value={formatPrice(motorhome.instant_price)} />
                  )}
                  {motorhome.reserve_price != null && (
                    <InfoItem label="Reservepreis" value={formatPrice(motorhome.reserve_price)} />
                  )}
                  {motorhome.price != null && (
                    <InfoItem label="Verkaufspreis" value={formatPrice(motorhome.price)} />
                  )}
                  <Separator className="my-2" />
                  <InfoItem
                    label="Kontoart"
                    value={motorhome.account_type === "dealer" ? "Händler" : motorhome.account_type === "private" ? "Privat" : motorhome.account_type || "—"}
                  />
                  <InfoItem
                    label="MwSt ausweisbar"
                    value={motorhome.mwst_ausweisbar === true ? "Ja" : motorhome.mwst_ausweisbar === false ? "Nein" : "Nicht angegeben"}
                  />
                </div>
              </DetailSection>

              {/* Vertragsdaten */}
              {(motorhome.contract_number || motorhome.contract_url || motorhome.sold_to || motorhome.sold_at) && (
                <DetailSection title="Vertragsdaten" icon={<FileText className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {motorhome.contract_number && (
                      <InfoItem label="Vertragsnr." value={motorhome.contract_number} />
                    )}
                    {motorhome.contract_url && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Vertrag</span>
                        <a
                          href={motorhome.contract_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Vertrag öffnen →
                        </a>
                      </div>
                    )}
                    {motorhome.sold_to && (
                      <InfoItem label="Verkauft an" value={motorhome.sold_to} />
                    )}
                    {motorhome.sold_at && (
                      <InfoItem label="Verkauft am" value={formatDate(motorhome.sold_at)} />
                    )}
                    {motorhome.sale_type && (
                      <InfoItem label="Verkaufstyp" value={motorhome.sale_type} />
                    )}
                    {motorhome.available_from && (
                      <InfoItem label="Verfügbar ab" value={formatDate(motorhome.available_from)} />
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Meta Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Metadaten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-xs">{motorhome.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Erstellt</span>
                    <span>{formatDate(motorhome.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aktualisiert</span>
                    <span>{formatDate(motorhome.updated_at)}</span>
                  </div>
                  {motorhome.country && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land</span>
                      <span>{motorhome.country}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {motorhome && (
        <MotorhomeEditDialog
          motorhome={motorhome}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* E-Mail Dialog */}
      {motorhome && motorhome.seller && (
        <SendOwnerEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          seller={{
            id: motorhome.seller.id,
            first_name: motorhome.seller.first_name,
            last_name: motorhome.seller.last_name,
            email: motorhome.seller.email,
            phone: motorhome.seller.phone,
          }}
          motorhome={{
            id: motorhome.id,
            manufacturer: motorhome.manufacturer,
            model: motorhome.model,
            year: motorhome.year,
            listing_number: motorhome.listing_number,
          }}
        />
      )}
    </AdminDetailLayout>
  );
}
