/**
 * Admin Kitchen Detail Page
 * Comprehensive view of kitchen with photos, specifications, and related data
 */

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cancelAuctionAsAdmin } from "@/lib/adminAuctionCancel";
import { activateAuctionForKitchen } from "@/lib/activate-auction";
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
import { KitchenEditDialog } from "@/components/admin/KitchenEditDialog";
import { AdminPhotoManager } from "@/components/admin/AdminPhotoManager";
import { SendOwnerEmailDialog } from "@/components/admin/SendOwnerEmailDialog";
import { AdminPriceHistoryCard } from "@/components/admin/AdminPriceHistoryCard";
import { logger } from "@/lib/logger";

export default function AdminKitchenDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Fetch kitchen with all related data
  const { data: kitchen, isLoading, error } = useQuery({
    queryKey: ["adminKitchenDetail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchens")
        .select(`
          *,
          kitchen_photos(id, url, card_url, medium_url, display_order),
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

  // Delete kitchen mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kitchens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wohnmobil erfolgreich gelöscht");
      navigate("/admin/kitchens");
    },
    onError: (error) => {
      logger.error("Delete kitchen error:", error);
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
      if (!kitchen?.id) throw new Error("No kitchen");
      await activateAuctionForKitchen(kitchen.id);
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminKitchenDetail", id] });
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
      // Render-Zeit). Wir greifen über das kitchen auf die aktuelle Auktion
      // zu, ohne auf relevantAuction zu warten.
      const auctionData = kitchen?.auctions;
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
      queryClient.invalidateQueries({ queryKey: ["adminKitchenDetail", id] });
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
          <Button className="mt-4" onClick={() => navigate("/admin/kitchens")}>
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
    const hasInstantBuy = kitchen?.instant_price && Number(kitchen.instant_price) > 0;
    const channelConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      instant_price: { label: "Nur Festpreis", variant: "default" },
      auction: hasInstantBuy ? { label: "Auktion + Sofortkauf", variant: "default" } : { label: "Auktion", variant: "secondary" },
      station: { label: "Station", variant: "outline" },
    };
    return channelConfig[channel] || { label: channel, variant: "outline" };
  };

  const sortedPhotos = Array.isArray(kitchen?.kitchen_photos)
    ? [...kitchen.kitchen_photos].sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
      )
    : [];

  const auctionData = kitchen?.auctions;
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
      title={kitchen ? `${kitchen.manufacturer} ${kitchen.model}` : "Wohnmobil"}
      subtitle={kitchen ? `${kitchen.year} • ${kitchen.body_type} • ${kitchen.listing_number || "—"}` : undefined}
      status={kitchen ? getStatusBadge(kitchen.status) : undefined}
      backUrl="/admin/kitchens"
      backLabel="Alle Wohnmobile"
      isLoading={isLoading}
      icon={<Car className="w-6 h-6" />}
      actions={
        kitchen && (
          <div className="flex gap-2">
            {kitchen.seller?.email && (
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
                onClick={() => navigate(`/admin/auctions?create=${kitchen.id}`)}
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
      {kitchen && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Preis"
              value={formatPrice(kitchen.instant_price || kitchen.reserve_price)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Küchenform"
              value={kitchen.body_type || "—"}
              icon={<Gauge className="w-5 h-5" />}
            />
            <StatsCard
              label="Fotos"
              value={sortedPhotos.length}
              icon={<ImageIcon className="w-5 h-5" />}
            />
            <StatsCard
              label="Verkaufsweg"
              value={getSaleChannelBadge(kitchen.sale_channel).label}
              icon={<Settings className="w-5 h-5" />}
            />
          </div>

          <AdminPriceHistoryCard
            kitchenId={kitchen.id}
            auctionId={relevantAuction?.id}
          />

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo Manager */}
              <AdminPhotoManager
                kitchenId={kitchen.id}
                photos={sortedPhotos}
                queryKey={["adminKitchenDetail", id!]}
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
                      <InfoItem label="Hersteller" value={kitchen.manufacturer} />
                      <InfoItem label="Modell" value={kitchen.model} />
                      <InfoItem label="Produktionsjahr" value={kitchen.year} />
                      <InfoItem label="Küchenform" value={kitchen.body_type} />
                      <InfoItem label="Zustand" value={kitchen.condition} />
                      <InfoItem label="Listennummer" value={kitchen.listing_number} />
                      <InfoItem label="PLZ (Standort)" value={kitchen.postal_code || "—"} />
                      <InfoItem label="Stadt" value={kitchen.city || "—"} />
                    </InfoGrid>
                    {kitchen.description && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Beschreibung</p>
                        <p className="text-sm whitespace-pre-wrap">{kitchen.description}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="technical">
                  <DetailSection title="Technische Daten" icon={<Settings className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Kraftstoff" value={kitchen.fuel_type} icon={<Fuel className="w-3 h-3" />} />
                      <InfoItem label="Leistung" value={kitchen.engine_power_hp ? `${kitchen.engine_power_hp} PS${kitchen.power_kw ? ` (${kitchen.power_kw} kW)` : ''}` : "—"} />
                      <InfoItem label="Getriebe" value={kitchen.transmission} />
                      <InfoItem label="Abgasnorm" value={kitchen.emission_class} />
                      <InfoItem label="Erstzulassung" value={formatMonthYear(kitchen.first_registration)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="TÜV bis" value={formatMonthYear(kitchen.tuev_valid_until)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="Vorbesitzer" value={kitchen.previous_owners?.toString()} />
                      <InfoItem label="Hubraum" value={kitchen.engine_displacement_ccm ? `${kitchen.engine_displacement_ccm} ccm` : "—"} />
                      <InfoItem label="Tankinhalt" value={kitchen.fuel_tank_capacity_liters ? `${kitchen.fuel_tank_capacity_liters} L` : "—"} />
                      <InfoItem label="Gassystem" value={kitchen.gas_system || "—"} />
                      <InfoItem label="Hauptreifen" value={kitchen.main_tires || "—"} />
                      <InfoItem label="Zweitreifen" value={kitchen.second_tires || "—"} />
                      <InfoItem label="Letzter TÜV" value={formatMonthYear(kitchen.last_tuev_date)} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {kitchen.accident_free && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Unfallfrei
                        </Badge>
                      )}
                      {kitchen.non_smoker && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Nichtraucher
                        </Badge>
                      )}
                      {kitchen.service_history_available && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" />
                          Scheckheft
                        </Badge>
                      )}
                      {kitchen.has_tuev && (
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
                      <InfoItem label="Länge" value={kitchen.length_m ? `${kitchen.length_m} cm` : "—"} />
                      <InfoItem label="Breite" value={kitchen.width_m ? `${kitchen.width_m} cm` : "—"} />
                      <InfoItem label="Höhe" value={kitchen.height_m ? `${kitchen.height_m} cm` : "—"} />
                      <InfoItem label="Achsen" value={kitchen.number_of_axles?.toString()} />
                      <InfoItem label="Gesamtgewicht" value={kitchen.weight_kg ? `${kitchen.weight_kg} kg` : "—"} icon={<Weight className="w-3 h-3" />} />
                      <InfoItem label="Zuladung" value={kitchen.payload_kg ? `${kitchen.payload_kg} kg` : "—"} />
                      <InfoItem label="Sitzplätze" value={kitchen.seats?.toString()} icon={<Users className="w-3 h-3" />} />
                      <InfoItem label="Schlafplätze" value={kitchen.sleeping_places?.toString()} icon={<Bed className="w-3 h-3" />} />
                    </InfoGrid>
                    {kitchen.beds_description && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Betten:</strong> {kitchen.beds_description}
                      </p>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="interior">
                  <DetailSection title="Innenausstattung" icon={<Bed className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Heizung" value={kitchen.heating_type} />
                      <InfoItem label="Klimaanlage" value={kitchen.air_conditioning_type} icon={<Wind className="w-3 h-3" />} />
                      <InfoItem label="Frischwasser" value={kitchen.water_tank_liters ? `${kitchen.water_tank_liters} L` : "—"} icon={<Droplets className="w-3 h-3" />} />
                      <InfoItem label="Grauwasser" value={kitchen.grey_water_capacity_liters ? `${kitchen.grey_water_capacity_liters} L` : "—"} />
                      <InfoItem label="Kühlschrank" value={kitchen.refrigerator_type} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {kitchen.has_kitchen && <Badge variant="outline">Küche</Badge>}
                      {kitchen.has_bathroom && <Badge variant="outline">Bad</Badge>}
                      {kitchen.has_toilet && <Badge variant="outline">Toilette</Badge>}
                      {kitchen.has_shower && <Badge variant="outline">Dusche</Badge>}
                      {kitchen.has_swivel_seats && <Badge variant="outline">Drehsitze</Badge>}
                      {kitchen.has_roof_ac && <Badge variant="outline">Dach-Klimaanlage</Badge>}
                      {kitchen.has_stand_ac && <Badge variant="outline">Stand-Klimaanlage</Badge>}
                    </div>
                  </DetailSection>
                </TabsContent>

                <TabsContent value="equipment">
                  <DetailSection title="Zusatzausstattung" icon={<Sun className="w-5 h-5" />}>
                    <div className="flex flex-wrap gap-2">
                      {kitchen.has_solar && (
                        <Badge variant="outline" className="gap-1">
                          <Sun className="w-3 h-3" />
                          Solar {kitchen.solar_power_watts ? `(${kitchen.solar_power_watts}W)` : ''}
                        </Badge>
                      )}
                      {kitchen.has_awning && (
                        <Badge variant="outline">
                          Markise {kitchen.awning_length_m ? `(${kitchen.awning_length_m}cm)` : ''}
                        </Badge>
                      )}
                      {kitchen.has_inverter && <Badge variant="outline">Wechselrichter</Badge>}
                      {kitchen.has_tv && (
                        <Badge variant="outline" className="gap-1">
                          <Tv className="w-3 h-3" /> TV/SAT
                        </Badge>
                      )}
                      {kitchen.has_backup_camera && (
                        <Badge variant="outline" className="gap-1">
                          <Camera className="w-3 h-3" /> Rückfahrkamera
                        </Badge>
                      )}
                      {kitchen.has_parking_sensors && (
                        <Badge variant="outline" className="gap-1">
                          <ParkingCircle className="w-3 h-3" /> Parksensoren
                        </Badge>
                      )}
                      {kitchen.has_cruise_control && <Badge variant="outline">Tempomat</Badge>}
                      {kitchen.has_central_locking && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" /> Zentralverriegelung
                        </Badge>
                      )}
                      {kitchen.has_bike_rack && (
                        <Badge variant="outline" className="gap-1">
                          <Bike className="w-3 h-3" /> Fahrradträger
                        </Badge>
                      )}
                      {kitchen.has_garage && (
                        <Badge variant="outline" className="gap-1">
                          <Warehouse className="w-3 h-3" /> Heckgarage
                        </Badge>
                      )}
                      {kitchen.has_esp && <Badge variant="outline">ESP</Badge>}
                      {kitchen.has_airbag && <Badge variant="outline">Airbag</Badge>}
                      {kitchen.has_alarm && <Badge variant="outline">Alarmanlage</Badge>}
                      {kitchen.has_navigation && <Badge variant="outline">Navigation</Badge>}
                      {kitchen.has_satellite && <Badge variant="outline">Satellitenanlage</Badge>}
                      {kitchen.has_awning_tent && <Badge variant="outline">Vorzelt</Badge>}
                    </div>
                    {kitchen.battery_capacity_ah && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Batterie:</strong> {kitchen.battery_capacity_ah} Ah
                      </p>
                    )}
                    {kitchen.additional_equipment && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Zusatzausstattung</p>
                        <p className="text-sm whitespace-pre-wrap">{kitchen.additional_equipment}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="condition">
                  <DetailSection title="Fahrzeugzustand" icon={<Shield className="w-5 h-5" />}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`p-3 rounded-lg border text-center ${kitchen.accident_free ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : kitchen.accident_free === false ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-muted/50'}`}>
                        {kitchen.accident_free ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : kitchen.accident_free === false ? (
                          <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                        ) : (
                          <Car className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {kitchen.accident_free ? "Unfallfrei" : kitchen.accident_free === false ? "Unfall vorhanden" : "Keine Angabe"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${kitchen.non_smoker ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : kitchen.non_smoker === false ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-muted/50'}`}>
                        {kitchen.non_smoker ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : kitchen.non_smoker === false ? (
                          <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                        ) : (
                          <Car className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {kitchen.non_smoker ? "Nichtraucher" : kitchen.non_smoker === false ? "Raucherfahrzeug" : "Keine Angabe"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${kitchen.service_history_available ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-muted/50'}`}>
                        {kitchen.service_history_available ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : (
                          <FileText className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {kitchen.service_history_available ? "Scheckheft vorhanden" : "Kein Scheckheft"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${kitchen.has_tuev ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-muted/50'}`}>
                        {kitchen.has_tuev ? (
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        ) : (
                          <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium">
                          {kitchen.tuev_valid_until ? `TÜV bis ${formatMonthYear(kitchen.tuev_valid_until)}` : kitchen.has_tuev ? "TÜV vorhanden" : "Kein TÜV"}
                        </p>
                      </div>
                    </div>

                    {kitchen.damage_summary ? (
                      <div className="mt-4 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Bekannte Mängel
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{kitchen.damage_summary}</p>
                      </div>
                    ) : !kitchen.has_damage ? (
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
              {Array.isArray(kitchen.damage_photos) && kitchen.damage_photos.length > 0 && (
                <DetailSection title="Schäden dokumentiert" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {kitchen.damage_photos.map((damage: any) => (
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
                {kitchen.seller ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {kitchen.seller.first_name} {kitchen.seller.last_name}
                      </p>
                      {kitchen.seller.company_name && (
                        <p className="text-sm text-muted-foreground">{kitchen.seller.company_name}</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <a
                        href={`mailto:${kitchen.seller.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {kitchen.seller.email}
                      </a>
                      {kitchen.seller.phone && (
                        <a
                          href={`tel:${kitchen.seller.phone}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {kitchen.seller.phone}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Registriert: {formatDate(kitchen.seller.created_at)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/admin/users/${kitchen.seller?.id}`)}
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
                      <div className={`p-3 rounded-lg ${kitchen.sale_channel === 'instant_price' ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
                        <p className="text-sm text-muted-foreground">{kitchen.sale_channel === 'instant_price' ? 'Festpreis' : 'Aktuelles Gebot'}</p>
                        <p className={`text-2xl font-bold ${kitchen.sale_channel === 'instant_price' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {formatPrice(kitchen.sale_channel === 'instant_price' ? kitchen.instant_price : (relevantAuction.current_bid || relevantAuction.starting_bid))}
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
                    {relevantAuction.reserve_price != null && kitchen.sale_channel !== 'instant_price' && (
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
              {Array.isArray(kitchen.appointments) && kitchen.appointments.length > 0 && (
                <DetailSection title="Termine" icon={<Calendar className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {kitchen.appointments.slice(0, 3).map((appointment: any) => (
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
                    {kitchen.appointments.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{kitchen.appointments.length - 3} weitere Termine
                      </p>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Pricing Info */}
              <DetailSection title="Preisgestaltung" icon={<Euro className="w-5 h-5" />}>
                <div className="space-y-3">
                  <InfoItem label="Verkaufsweg" value={getSaleChannelBadge(kitchen.sale_channel).label} />
                  {kitchen.instant_price != null && (
                    <InfoItem label={kitchen.sale_channel === 'instant_price' ? 'Festpreis' : 'Sofortpreis'} value={formatPrice(kitchen.instant_price)} />
                  )}
                  {kitchen.reserve_price != null && (
                    <InfoItem label="Reservepreis" value={formatPrice(kitchen.reserve_price)} />
                  )}
                  {kitchen.price != null && (
                    <InfoItem label="Verkaufspreis" value={formatPrice(kitchen.price)} />
                  )}
                  <Separator className="my-2" />
                  <InfoItem
                    label="Kontoart"
                    value={kitchen.account_type === "dealer" ? "Händler" : kitchen.account_type === "private" ? "Privat" : kitchen.account_type || "—"}
                  />
                  <InfoItem
                    label="MwSt ausweisbar"
                    value={kitchen.mwst_ausweisbar === true ? "Ja" : kitchen.mwst_ausweisbar === false ? "Nein" : "Nicht angegeben"}
                  />
                </div>
              </DetailSection>

              {/* Vertragsdaten */}
              {(kitchen.contract_number || kitchen.contract_url || kitchen.sold_to || kitchen.sold_at) && (
                <DetailSection title="Vertragsdaten" icon={<FileText className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {kitchen.contract_number && (
                      <InfoItem label="Vertragsnr." value={kitchen.contract_number} />
                    )}
                    {kitchen.contract_url && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Vertrag</span>
                        <a
                          href={kitchen.contract_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Vertrag öffnen →
                        </a>
                      </div>
                    )}
                    {kitchen.sold_to && (
                      <InfoItem label="Verkauft an" value={kitchen.sold_to} />
                    )}
                    {kitchen.sold_at && (
                      <InfoItem label="Verkauft am" value={formatDate(kitchen.sold_at)} />
                    )}
                    {kitchen.sale_type && (
                      <InfoItem label="Verkaufstyp" value={kitchen.sale_type} />
                    )}
                    {kitchen.available_from && (
                      <InfoItem label="Verfügbar ab" value={formatDate(kitchen.available_from)} />
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
                    <span className="font-mono text-xs">{kitchen.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Erstellt</span>
                    <span>{formatDate(kitchen.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aktualisiert</span>
                    <span>{formatDate(kitchen.updated_at)}</span>
                  </div>
                  {kitchen.country && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land</span>
                      <span>{kitchen.country}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {kitchen && (
        <KitchenEditDialog
          kitchen={kitchen}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* E-Mail Dialog */}
      {kitchen && kitchen.seller && (
        <SendOwnerEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          seller={{
            id: kitchen.seller.id,
            first_name: kitchen.seller.first_name,
            last_name: kitchen.seller.last_name,
            email: kitchen.seller.email,
            phone: kitchen.seller.phone,
          }}
          kitchen={{
            id: kitchen.id,
            manufacturer: kitchen.manufacturer,
            model: kitchen.model,
            year: kitchen.year,
            listing_number: kitchen.listing_number,
          }}
        />
      )}
    </AdminDetailLayout>
  );
}
